import { createHmac, timingSafeEqual } from "node:crypto";

import type { GithubActivityInput, SaveActivityResult } from "./activities";

const MAX_BODY_BYTES = 4_500_000;
const SIGNATURE_PATTERN = /^sha256=([a-f0-9]{64})$/;
const EVENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const ACTOR_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const COMMIT_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

type SaveActivity = (activity: GithubActivityInput) => Promise<SaveActivityResult>;

export interface HookRelayWebhookDependencies {
  secret: string;
  saveActivity: SaveActivity;
  now?: () => Date;
  onPersistenceError?: (error: unknown, relayEventId: string) => void;
}

function json(status: number, body: Record<string, boolean | string>): Response {
  return Response.json(body, { status });
}

function hasValidSignature(body: Buffer, signature: string | null, secret: string): boolean {
  const match = signature?.match(SIGNATURE_PATTERN);
  if (!match) return false;

  const received = Buffer.from(match[1], "hex");
  const expected = createHmac("sha256", secret).update(body).digest();

  return timingSafeEqual(received, expected);
}

function record(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function safeGithubUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2_048) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.hostname !== "github.com") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function parsePushActivity(
  value: unknown,
  relayEventId: string,
  now: () => Date,
): GithubActivityInput | null {
  const payload = record(value);
  const repository = record(payload?.repository);
  const sender = record(payload?.sender);
  const ref = payload?.ref;
  const fullName = repository?.full_name;
  const actorLogin = sender?.login;

  if (
    typeof ref !== "string" ||
    !ref.startsWith("refs/heads/") ||
    ref.length > 266 ||
    CONTROL_CHARACTER_PATTERN.test(ref) ||
    typeof fullName !== "string" ||
    !REPOSITORY_PATTERN.test(fullName) ||
    typeof actorLogin !== "string" ||
    !ACTOR_PATTERN.test(actorLogin)
  ) {
    return null;
  }

  const repositoryUrl = safeGithubUrl(repository?.html_url);
  const actorUrl = safeGithubUrl(sender?.html_url);
  if (!repositoryUrl || !actorUrl) return null;

  const headCommitValue = payload?.head_commit;
  if (headCommitValue !== null && headCommitValue !== undefined) {
    const headCommit = record(headCommitValue);
    const sha = headCommit?.id;
    const message = headCommit?.message;
    const commitUrl = safeGithubUrl(headCommit?.url);
    const timestamp = headCommit?.timestamp;

    if (
      !headCommit ||
      typeof sha !== "string" ||
      !COMMIT_PATTERN.test(sha) ||
      typeof message !== "string" ||
      message.length > 10_000 ||
      !commitUrl ||
      typeof timestamp !== "string"
    ) {
      return null;
    }

    const eventAt = new Date(timestamp);
    if (Number.isNaN(eventAt.getTime())) return null;

    return {
      relayEventId,
      eventType: "push",
      repositoryFullName: fullName,
      repositoryUrl,
      branch: ref.slice("refs/heads/".length),
      actorLogin,
      actorUrl,
      headCommitSha: sha,
      headCommitMessage: message,
      headCommitUrl: commitUrl,
      eventAt,
    };
  }

  return {
    relayEventId,
    eventType: "push",
    repositoryFullName: fullName,
    repositoryUrl,
    branch: ref.slice("refs/heads/".length),
    actorLogin,
    actorUrl,
    headCommitSha: null,
    headCommitMessage: null,
    headCommitUrl: null,
    eventAt: now(),
  };
}

export async function handleHookRelayWebhook(
  request: Request,
  dependencies: HookRelayWebhookDependencies,
): Promise<Response> {
  if (dependencies.secret.length < 32) {
    throw new Error("WEBHOOK_SECRET must contain at least 32 characters");
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json(413, { error: "payload too large" });
  }

  const body = Buffer.from(await request.arrayBuffer());
  if (body.length > MAX_BODY_BYTES) {
    return json(413, { error: "payload too large" });
  }

  if (!hasValidSignature(body, request.headers.get("x-hub-signature-256"), dependencies.secret)) {
    return json(401, { error: "invalid signature" });
  }

  const relayEventId = request.headers.get("x-hookrelay-event-id");
  if (!relayEventId || !EVENT_ID_PATTERN.test(relayEventId)) {
    return json(400, { error: "invalid HookRelay event id" });
  }

  const eventType = request.headers.get("x-github-event");
  if (!eventType) {
    return json(400, { error: "missing GitHub event type" });
  }

  if (eventType !== "push") {
    return new Response(null, { status: 204 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body.toString("utf8"));
  } catch {
    return json(400, { error: "invalid JSON" });
  }

  const activity = parsePushActivity(payload, relayEventId, dependencies.now ?? (() => new Date()));
  if (!activity) {
    return json(422, { error: "invalid push payload" });
  }

  try {
    await dependencies.saveActivity(activity);
  } catch (error) {
    dependencies.onPersistenceError?.(error, relayEventId);
    return json(503, { error: "activity store unavailable" });
  }

  return json(202, { accepted: true });
}
