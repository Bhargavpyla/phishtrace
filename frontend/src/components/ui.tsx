import { Check, ChevronDown, CircleAlert, Copy, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

export function Card({ children, className = "", as: Tag = "section", ...rest }: {
  children: ReactNode; className?: string; as?: "section" | "div" | "article"; "aria-labelledby"?: string;
}) {
  return (
    <Tag className={`rounded-2xl border border-slate-200/70 bg-white shadow-card ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({ id, title, subtitle, action, icon }: { id?: string; title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-5">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">{icon}</span>}
        <div className="min-w-0">
          <h2 id={id} className="text-base font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; busy?: boolean };

export function Button({ variant = "secondary", busy, className = "", children, disabled, ...rest }: BtnProps) {
  const styles = {
    primary: "bg-teal-600 text-white shadow-sm hover:bg-teal-700 active:bg-teal-800 border-transparent",
    secondary: "bg-white text-slate-800 hover:bg-slate-50 border-slate-300",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100 border-transparent",
    danger: "bg-red-600 text-white hover:bg-red-700 border-transparent",
  }[variant];
  return (
    <button
      type="button"
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...rest}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />;
}

/** Placeholder rows shown while a list loads. */
export function SkeletonRows({ rows = 4, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3 p-5">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-2 p-6 text-sm text-slate-600">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      {icon && <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50 text-accent-600">{icon}</div>}
      <p className="text-base font-semibold text-slate-900">{title}</p>
      {children && <div className="max-w-md text-sm text-slate-600">{children}</div>}
    </div>
  );
}

export function ErrorNotice({ title = "Something went wrong", message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 break-words">{message}</p>
      </div>
      {onRetry && <Button onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  const c = tone === "warn" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-slate-200 bg-slate-50 text-slate-700";
  return <p className={`rounded-xl border px-3 py-2 text-sm ${c}`}>{children}</p>;
}

/** Collapsed-by-default section for technical detail. */
export function Disclosure({ title, children, defaultOpen = false }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-slate-200 bg-slate-50/60">
      <summary className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
        <span className="min-w-0">{title}</span>
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-slate-200 p-3">{children}</div>
    </details>
  );
}

/** Accessible tabs (arrow keys, Home/End). Only the active panel is rendered, which keeps pages short. */
export function Tabs({ label, tabs, active, onChange }: {
  label: string;
  tabs: { id: string; label: string; badge?: string | number; attention?: boolean }[];
  active: string;
  onChange: (id: string) => void;
}) {
  function onKey(e: React.KeyboardEvent, i: number) {
    const next = e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length
      : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].id);
    document.getElementById(`tab-${tabs[next].id}`)?.focus();
  }
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto rounded-2xl bg-slate-200/60 p-1">
      {tabs.map((t, i) => {
        const on = t.id === active;
        return (
          <button key={t.id} id={`tab-${t.id}`} role="tab" type="button" aria-selected={on} aria-controls={`panel-${t.id}`}
            tabIndex={on ? 0 : -1} onClick={() => onChange(t.id)} onKeyDown={(e) => onKey(e, i)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${on ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
            {t.label}
            {t.badge !== undefined && <span className={`rounded-full px-1.5 text-xs ${t.attention ? "bg-amber-200 text-amber-950" : "bg-slate-200 text-slate-700"}`}>{t.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

const AVATAR_TONES = ["bg-accent-100 text-accent-700", "bg-teal-100 text-teal-800", "bg-amber-100 text-amber-900", "bg-indigo-100 text-indigo-800", "bg-rose-100 text-rose-800"];

/** Initials avatar for a sender such as `"IT Support" <it@x.example>`. */
export function Avatar({ sender }: { sender: string }) {
  const name = (sender.split("<")[0].replace(/["']/g, "").trim() || sender.split("@")[0] || "?");
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
  const tone = AVATAR_TONES[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % AVATAR_TONES.length];
  return <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${tone}`}>{initials}</span>;
}

/** Copies text to the clipboard. Used for URLs, which are never rendered as links. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true); setFailed(false);
    } catch {
      setFailed(true); setDone(false);
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { setDone(false); setFailed(false); }, 2000);
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-50"
    >
      {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {done ? "Copied" : failed ? "Copy failed" : "Copy"}
    </button>
  );
}

export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }: {
  title: string; body: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body"
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lift">
        <div className="flex items-start justify-between gap-2">
          <h2 id="confirm-title" className="text-base font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onCancel} aria-label="Close dialog" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p id="confirm-body" className="mt-2 text-sm text-slate-600">{body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button autoFocus onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
