export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "Not recorded";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not recorded";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "Not measured";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
}

export function orDash(v: string | null | undefined, fallback = "Not available"): string {
  return v && v.trim() ? v : fallback;
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const MAX_EML_BYTES = 1_000_000;

/** Client-side checks that mirror the backend's upload limits. Returns a message, or null if acceptable. */
export function validateEml(file: { name: string; size: number }): string | null {
  if (!file.name.toLowerCase().endsWith(".eml")) return "Not an .eml file.";
  if (file.size === 0) return "File is empty.";
  if (file.size > MAX_EML_BYTES) return `File is larger than ${MAX_EML_BYTES / 1_000_000} MB.`;
  return null;
}
