export function requiredEnv(
  name: "DATABASE_URL" | "WEBHOOK_SECRET",
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const value = env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}
