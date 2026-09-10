import type { Pool } from "pg";

import { getDatabase } from "./db";

export interface GithubActivityInput {
  relayEventId: string;
  eventType: "push";
  repositoryFullName: string;
  repositoryUrl: string;
  branch: string;
  actorLogin: string;
  actorUrl: string;
  headCommitSha: string | null;
  headCommitMessage: string | null;
  headCommitUrl: string | null;
  eventAt: Date;
}

export type SaveActivityResult = "saved" | "duplicate";

export interface RecentGithubActivity extends GithubActivityInput {
  receivedAt: Date;
}

export async function saveActivity(
  activity: GithubActivityInput,
  db: Pool = getDatabase(),
): Promise<SaveActivityResult> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO github_activities (
       relay_event_id,
       event_type,
       repository_full_name,
       repository_url,
       branch,
       actor_login,
       actor_url,
       head_commit_sha,
       head_commit_message,
       head_commit_url,
       event_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (relay_event_id) DO NOTHING
     RETURNING id`,
    [
      activity.relayEventId,
      activity.eventType,
      activity.repositoryFullName,
      activity.repositoryUrl,
      activity.branch,
      activity.actorLogin,
      activity.actorUrl,
      activity.headCommitSha,
      activity.headCommitMessage,
      activity.headCommitUrl,
      activity.eventAt,
    ],
  );

  return result.rows.length === 0 ? "duplicate" : "saved";
}

interface RecentGithubActivityRow {
  relay_event_id: string;
  event_type: "push";
  repository_full_name: string;
  repository_url: string;
  branch: string;
  actor_login: string;
  actor_url: string;
  head_commit_sha: string | null;
  head_commit_message: string | null;
  head_commit_url: string | null;
  event_at: Date;
  received_at: Date;
}

export async function listRecentActivities(
  limit = 50,
  db: Pool = getDatabase(),
): Promise<RecentGithubActivity[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const result = await db.query<RecentGithubActivityRow>(
    `SELECT relay_event_id,
            event_type,
            repository_full_name,
            repository_url,
            branch,
            actor_login,
            actor_url,
            head_commit_sha,
            head_commit_message,
            head_commit_url,
            event_at,
            received_at
       FROM github_activities
      ORDER BY received_at DESC, id DESC
      LIMIT $1`,
    [safeLimit],
  );

  return result.rows.map((row) => ({
    relayEventId: row.relay_event_id,
    eventType: row.event_type,
    repositoryFullName: row.repository_full_name,
    repositoryUrl: row.repository_url,
    branch: row.branch,
    actorLogin: row.actor_login,
    actorUrl: row.actor_url,
    headCommitSha: row.head_commit_sha,
    headCommitMessage: row.head_commit_message,
    headCommitUrl: row.head_commit_url,
    eventAt: row.event_at,
    receivedAt: row.received_at,
  }));
}
