# Devonoma

Devonoma is a small GitHub activity ledger built to make HookRelay useful in a real app.
It accepts signed push events, stores each relay event once, and shows recent work in a
newest-first timeline.

```text
GitHub -> HookRelay -> signed webhook -> PostgreSQL -> Devonoma timeline
```

HookRelay owns delivery and retrying. Devonoma verifies what arrives and owns the readable
record. If Devonoma or its database is temporarily unavailable, it returns 503 so HookRelay
can try again.

## Run it locally

Devonoma needs Node 22 or newer and Docker.

```powershell
Copy-Item .env.example .env.local
docker compose up -d --wait
$env:DATABASE_URL='postgres://devonoma:devonoma@localhost:5433/devonoma'
npm install
npm run migrate
npm run dev -- --hostname 127.0.0.1 --port 3100
```

Set `DATABASE_URL` and `WEBHOOK_SECRET` in `.env.local`. The webhook route is
`/api/webhooks/hookrelay`.

Run HookRelay on port 3200, enable private destinations only for local development, and
create an endpoint whose destination is
`http://127.0.0.1:3100/api/webhooks/hookrelay`. Put the returned signing secret in
Devonoma's `WEBHOOK_SECRET`. The same secret signs traffic into HookRelay and from HookRelay
to Devonoma.

## Prove retry recovery

Run HookRelay and Devonoma, then stop only Devonoma's database:

```powershell
docker compose stop postgres
$env:HOOKRELAY_INGEST_URL='http://127.0.0.1:3200/hook/your-endpoint-id'
$env:WEBHOOK_SECRET='the-endpoint-signing-secret'
npm run demo:push
```

Devonoma returns 503 and HookRelay retains the event. Restore the database and watch the
same event appear once:

```powershell
docker compose start postgres
```

This local script sends a GitHub-shaped test payload. A real GitHub webhook needs a public
HookRelay URL; GitHub cannot call a server that exists only on localhost.

## Checks

```powershell
npm test
$env:DATABASE_URL='postgres://devonoma:devonoma@localhost:5433/devonoma'
npm run test:integration
npm run typecheck
npm run build
```

## Deployment boundary

Devonoma can run on Vercel with a hosted PostgreSQL database. Run the migration as a separate
release step and set `DATABASE_URL` and `WEBHOOK_SECRET` only in the production environment.
Set HookRelay's `INGEST_BODY_LIMIT_BYTES` to `4500000`, which matches Vercel's request limit.

The dashboard has no login in this first slice. Connect only repositories whose activity you
are comfortable showing publicly; add access control before using it with a private repository.

HookRelay does not belong in a Vercel Function because its worker and retry sweeper must keep
running. Deploy it on a host that supports a continuous Node process, Redis, and PostgreSQL.
Use the stable production webhook URL, not a preview deployment.
