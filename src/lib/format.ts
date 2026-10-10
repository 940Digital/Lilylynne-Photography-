export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

export function formatDate(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** yyyy-mm-dd, for <input type="date"> */
export function toDateInput(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 10);
}

/** End of the chosen day in UTC, so "expires Jan 5" means the whole of Jan 5 is still valid. */
export function endOfDay(dateStr: string): number {
  return Math.floor(new Date(`${dateStr}T23:59:59Z`).getTime() / 1000);
}
