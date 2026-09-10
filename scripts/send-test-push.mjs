import { createHmac, randomUUID } from "node:crypto";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const ingestUrl = required("HOOKRELAY_INGEST_URL");
const secret = required("WEBHOOK_SECRET");
const timestamp = new Date().toISOString();
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
    id: "abcdef0123456789abcdef0123456789abcdef01",
    message: "run the local retry demo",
    url: "https://github.com/HuzaifaAbdulRehman/Devonoma/commit/abcdef0123456789abcdef0123456789abcdef01",
    timestamp,
  },
});
const signature = createHmac("sha256", secret).update(body).digest("hex");
const response = await fetch(ingestUrl, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-github-delivery": randomUUID(),
    "x-github-event": "push",
    "x-hub-signature-256": `sha256=${signature}`,
  },
  body,
});

if (!response.ok) {
  throw new Error(`HookRelay ingest returned HTTP ${response.status}`);
}

const result = await response.json();
if (typeof result !== "object" || result === null || typeof result.id !== "string") {
  throw new Error("HookRelay returned an invalid response");
}

console.log(`HookRelay accepted event ${result.id}`);
