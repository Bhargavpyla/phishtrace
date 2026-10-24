import { Bot, BadgeCheck, CircleCheck, CircleDashed, FlaskConical, History, ListChecks, Plus, ShieldAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import type { Assessment, Evidence, ExecutionMode, FindingType, ReviewStatus, ToolStatus } from "../api/types";
import { ASSESSMENT_LABEL, FINDING_TYPE_LABEL, MODE_LABEL } from "../lib/labels";

/** Status chips always carry an icon and text so meaning never depends on colour alone. */
function Chip({ icon: Icon, text, tone, size = "sm" }: { icon: LucideIcon; text: string; tone: string; size?: "sm" | "lg" }) {
  const dims = size === "lg" ? "gap-1.5 px-3 py-1 text-sm" : "gap-1 px-2 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border font-medium ${dims} ${tone}`}>
      <Icon className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden />
      {text}
    </span>
  );
}

export const ASSESS_STYLE: Record<Assessment, { icon: LucideIcon; tone: string; panel: string }> = {
  suspicious: { icon: ShieldAlert, tone: "border-red-200 bg-red-50 text-red-800", panel: "border-red-200 bg-red-50/60" },
  likely_benign: { icon: CircleCheck, tone: "border-teal-200 bg-teal-50 text-teal-800", panel: "border-teal-200 bg-teal-50/60" },
  needs_review: { icon: TriangleAlert, tone: "border-amber-300 bg-amber-50 text-amber-900", panel: "border-amber-200 bg-amber-50/60" },
};

export function AssessmentBadge({ value, size }: { value: Assessment; size?: "sm" | "lg" }) {
  const s = ASSESS_STYLE[value];
  return <Chip icon={s.icon} text={ASSESSMENT_LABEL[value]} tone={s.tone} size={size} />;
}

export function ReviewBadge({ value }: { value: ReviewStatus }) {
  return value === "reviewed"
    ? <Chip icon={BadgeCheck} text="Reviewed" tone="border-teal-200 bg-white text-teal-800" />
    : <Chip icon={CircleDashed} text="Unreviewed" tone="border-amber-200 bg-amber-50 text-amber-800" />;
}

export function ModeBadge({ mode, dark = false }: { mode: ExecutionMode; dark?: boolean }) {
  const m = {
    demo: {
      icon: FlaskConical,
      tone: dark ? "border-indigo-400/30 bg-indigo-500/10 text-indigo-300" : "border-indigo-200 bg-indigo-50 text-indigo-800",
    },
    agent: {
      icon: Bot,
      tone: dark ? "border-teal-500/30 bg-teal-500/10 text-teal-300" : "border-teal-200 bg-teal-50 text-teal-800",
    },
    rules_only: {
      icon: ListChecks,
      tone: dark ? "border-amber-400/30 bg-amber-500/10 text-amber-300" : "border-amber-300 bg-amber-50 text-amber-900",
    },
  }[mode];
  return <Chip icon={m.icon} text={`Mode: ${MODE_LABEL[mode]}`} tone={m.tone} />;
}

export function FindingTypeBadge({ type }: { type: FindingType }) {
  const tone = {
    observed_fact: "border-slate-300 bg-white text-slate-800",
    policy_guidance: "border-teal-200 bg-teal-50 text-teal-800",
    model_interpretation: "border-amber-300 bg-amber-50 text-amber-900",
  }[type];
  const icon = { observed_fact: CircleCheck, policy_guidance: ListChecks, model_interpretation: Bot }[type];
  return <Chip icon={icon} text={FINDING_TYPE_LABEL[type]} tone={tone} />;
}

export function OriginBadge({ ev }: { ev: Evidence }) {
  return ev.origin === "reused"
    ? <Chip icon={History} text="Reused" tone="border-indigo-200 bg-indigo-50 text-indigo-800" />
    : <Chip icon={Plus} text="New" tone="border-slate-300 bg-white text-slate-700" />;
}

export function ToolStatusBadge({ status }: { status: ToolStatus }) {
  const m = {
    ok: { icon: CircleCheck, text: "Succeeded", tone: "border-teal-200 bg-teal-50 text-teal-800" },
    running: { icon: CircleDashed, text: "Running", tone: "border-slate-300 bg-slate-50 text-slate-700" },
    error: { icon: ShieldAlert, text: "Failed", tone: "border-red-200 bg-red-50 text-red-800" },
    refused: { icon: TriangleAlert, text: "Refused", tone: "border-amber-300 bg-amber-50 text-amber-900" },
  }[status];
  return <Chip icon={m.icon} text={m.text} tone={m.tone} />;
}
