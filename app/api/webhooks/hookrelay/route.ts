import { saveActivity } from "@/lib/activities";
import { requiredEnv } from "@/lib/config";
import { handleHookRelayWebhook } from "@/lib/hookrelay-webhook";

export const runtime = "nodejs";

export function POST(request: Request): Promise<Response> {
  return handleHookRelayWebhook(request, {
    secret: requiredEnv("WEBHOOK_SECRET"),
    saveActivity,
    onPersistenceError: (error, relayEventId) => {
      const errorName = error instanceof Error ? error.name : "UnknownError";
      console.error("Could not store HookRelay event", { relayEventId, errorName });
    },
  });
}
