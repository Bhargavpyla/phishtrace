import { Check, CircleAlert, Copy, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

export function Card({ children, className = "", as: Tag = "section", ...rest }: {
  children: ReactNode; className?: string; as?: "section" | "div" | "article"; "aria-labelledby"?: string;
}) {
  return (
    <Tag className={`rounded-lg border border-slate-200 bg-white shadow-card ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({ id, title, subtitle, action }: { id?: string; title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
      <div className="min-w-0">
        <h2 id={id} className="text-sm font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; busy?: boolean };

export function Button({ variant = "secondary", busy, className = "", children, disabled, ...rest }: BtnProps) {
  const styles = {
    primary: "bg-teal-600 text-white hover:bg-teal-700 border-transparent",
    secondary: "bg-white text-slate-800 hover:bg-slate-50 border-slate-300",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100 border-transparent",
    danger: "bg-red-600 text-white hover:bg-red-700 border-transparent",
  }[variant];
  return (
    <button
      type="button"
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...rest}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
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
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      {icon && <div className="text-slate-400">{icon}</div>}
      <p className="text-sm font-medium text-slate-800">{title}</p>
      {children && <div className="max-w-md text-sm text-slate-600">{children}</div>}
    </div>
  );
}

export function ErrorNotice({ title = "Something went wrong", message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 break-words">{message}</p>
      </div>
      {onRetry && <Button onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  const c = tone === "warn" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-slate-200 bg-slate-50 text-slate-700";
  return <p className={`rounded-md border px-3 py-2 text-xs ${c}`}>{children}</p>;
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
      className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
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
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <h2 id="confirm-title" className="text-base font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onCancel} aria-label="Close dialog" className="rounded p-1 text-slate-500 hover:bg-slate-100">
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
