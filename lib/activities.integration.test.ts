import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { listRecentActivities, saveActivity, type GithubActivityInput } from "./activities";
import { getDatabase } from "./db";
import { handleHookRelayWebhook } from "./hookrelay-webhook";

const database = getDatabase();
const secret = "an-integration-secret-that-is-long-enough";

const activity: GithubActivityInput = {
  relayEventId: randomUUID(),
  eventType: "push",
  repositoryFullName: "HuzaifaAbdulRehman/Devonoma",
  repositoryUrl: "https://github.com/HuzaifaAbdulRehman/Devonoma",
  branch: "main",
  actorLogin: "HuzaifaAbdulRehman",
  actorUrl: "https://github.com/HuzaifaAbdulRehman",
  headCommitSha: "0123456789abcdef0123456789abcdef01234567",
  headCommitMessage: "add activity receiver",
  headCommitUrl:
    "https://github.com/HuzaifaAbdulRehman/Devonoma/commit/0123456789abcdef0123456789abcdef01234567",
  eventAt: new Date("2026-09-11T10:30:00Z"),
};

describe("activity persistence", () => {
  beforeEach(async () => {
    await database.query("TRUNCATE github_activities RESTART IDENTITY");
  });

  afterAll(async () => {
    await database.end();
  });

  it("stores one row when HookRelay delivers the same event twice", async () => {
    await expect(saveActivity(activity)).resolves.toBe("saved");
    await expect(saveActivity(activity)).resolves.toBe("duplicate");

    const result = await database.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM github_activities WHERE relay_event_id = $1",
      [activity.relayEventId],
    );

    expect(result.rows[0]?.count).toBe("1");
  });

  it("acknowledges two signed deliveries but persists one activity", async () => {
    const relayEventId = randomUUID();
    const body = JSON.stringify({
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
        id: activity.headCommitSha,
        message: activity.headCommitMessage,
        url: activity.headCommitUrl,
        timestamp: activity.eventAt.toISOString(),
      },
    });
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    const deliver = () =>
      handleHookRelayWebhook(
        new Request("http://localhost/api/webhooks/hookrelay", {
          method: "POST",
          body,
          headers: {
            "x-github-event": "push",
            "x-hookrelay-event-id": relayEventId,
            "x-hub-signature-256": `sha256=${signature}`,
          },
        }),
        { secret, saveActivity },
      );

    await expect(deliver()).resolves.toMatchObject({ status: 202 });
    await expect(deliver()).resolves.toMatchObject({ status: 202 });

    const result = await database.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM github_activities WHERE relay_event_id = $1",
      [relayEventId],
    );
    expect(result.rows[0]?.count).toBe("1");
  });

  it("lists the most recently received activity first", async () => {
    const firstReceived = {
      ...activity,
      relayEventId: randomUUID(),
      eventAt: new Date("2099-09-11T10:30:00Z"),
    };
    const lastReceived = {
      ...activity,
      relayEventId: randomUUID(),
      branch: "feature/timeline",
      eventAt: new Date("2000-09-11T10:30:00Z"),
    };

    await saveActivity(firstReceived);
    await saveActivity(lastReceived);

    const result = await listRecentActivities(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      relayEventId: lastReceived.relayEventId,
      branch: "feature/timeline",
    });
  });
});
