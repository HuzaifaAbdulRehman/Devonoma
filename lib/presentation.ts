const timestampFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatTimestamp(value: Date): string {
  return `${timestampFormatter.format(value)} UTC`;
}

export function shortCommitSha(value: string): string {
  return value.slice(0, 7);
}

export function firstCommitLine(value: string): string {
  return value.split(/\r?\n/, 1)[0]?.trim() || "No commit message provided";
}
