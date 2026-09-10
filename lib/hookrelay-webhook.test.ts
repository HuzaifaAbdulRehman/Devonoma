import { createHmac, randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import type { GithubActivityInput } from "./activities";
import { handleHookRelayWebhook } from "./hookrelay-webhook";

const SECRET = "a-test-secret-that-is-long-enough-for-hmac";

function pushPayload() {
  return {
    ref: "refs/heads/main",
    repository: {
      full_name: "HuzaifaAbdulRehman/Devonoma",
      html_url: "https://github.com/HuzaifaAbdulRehman/Devonoma",
    },
    sender: {
      login: "HuzaifaAbdulRehman",
      html_url: "https://github.com/HuzaifaAbdulRehman",
    },
    head_commit: {
      id: "0123456789abcdef0123456789abcdef01234567",
      message: "add activity receiver",
      url: "https://github.com/HuzaifaAbdulRehman/Devonoma/commit/0123456789abcdef0123456789abcdef01234567",
      timestamp: "2026-09-11T10:30:00Z",
    },
  };
}

function requestFor(
  body: string,
  headers: Record<string, string> = {},
): Request {
  const signature = createHmac("sha256", SECRET).update(Buffer.from(body)).digest("hex");

  return new Request("https://devonoma.example/api/webhooks/hookrelay", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "x-github-event": "push",
      "x-hookrelay-event-id": randomUUID(),
      "x-hub-signature-256": `sha256=${signature}`,
      ...headers,
    },
  });
}

describe("HookRelay webhook receiver", () => {
  it("accepts a signed push and maps only the activity fields", async () => {
    const body = JSON.stringify(pushPayload(), null, 2);
    const saved: GithubActivityInput[] = [];
    const response = await handleHookRelayWebhook(requestFor(body), {
      secret: SECRET,
      saveActivity: async (activity) => {
        saved.push(activity);
        return "saved";
      },
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ accepted: true });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      eventType: "push",
      repositoryFullName: "HuzaifaAbdulRehman/Devonoma",
      branch: "main",
      actorLogin: "HuzaifaAbdulRehman",
      headCommitSha: "0123456789abcdef0123456789abcdef01234567",
      headCommitMessage: "add activity receiver",
      eventAt: new Date("2026-09-11T10:30:00Z"),
    });
  });

  it("rejects a signature made for different bytes", async () => {
    const saveActivity = vi.fn();
    const signedBody = JSON.stringify(pushPayload());
    const request = requestFor(signedBody);
    const alteredRequest = new Request(request, {
      body: `${signedBody} `,
    });

    const response = await handleHookRelayWebhook(alteredRequest, {
      secret: SECRET,
      saveActivity,
    });

    expect(response.status).toBe(401);
    expect(saveActivity).not.toHaveBeenCalled();
  });

  it("ignores a signed event type outside the first slice", async () => {
    const saveActivity = vi.fn();
    const response = await handleHookRelayWebhook(
      requestFor("{}", { "x-github-event": "pull_request" }),
      { secret: SECRET, saveActivity },
    );

    expect(response.status).toBe(204);
    expect(saveActivity).not.toHaveBeenCalled();
  });

  it("rejects malformed push JSON after verifying its signature", async () => {
    const saveActivity = vi.fn();
    const response = await handleHookRelayWebhook(requestFor("{"), {
      secret: SECRET,
      saveActivity,
    });

    expect(response.status).toBe(400);
    expect(saveActivity).not.toHaveBeenCalled();
  });

  it("rejects a body above the Vercel request limit", async () => {
    const saveActivity = vi.fn();
    const response = await handleHookRelayWebhook(
      requestFor("{}", { "content-length": "4500001" }),
      { secret: SECRET, saveActivity },
    );

    expect(response.status).toBe(413);
    expect(saveActivity).not.toHaveBeenCalled();
  });

  it("rejects unsafe links in an otherwise valid push", async () => {
    const saveActivity = vi.fn();
    const payload = pushPayload();
    payload.sender.html_url = "javascript:alert(1)";
    const response = await handleHookRelayWebhook(requestFor(JSON.stringify(payload)), {
      secret: SECRET,
      saveActivity,
    });

    expect(response.status).toBe(422);
    expect(saveActivity).not.toHaveBeenCalled();
  });

  it("returns a retryable response when PostgreSQL is unavailable", async () => {
    const persistenceError = new Error("database unavailable");
    const onPersistenceError = vi.fn();
    const response = await handleHookRelayWebhook(
      requestFor(JSON.stringify(pushPayload())),
      {
        secret: SECRET,
        saveActivity: async () => Promise.reject(persistenceError),
        onPersistenceError,
      },
    );

    expect(response.status).toBe(503);
    expect(onPersistenceError).toHaveBeenCalledWith(persistenceError, expect.any(String));
  });
});
