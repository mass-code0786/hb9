"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { AlertCircle, Inbox } from "lucide-react";

type PanelProps = HTMLMotionProps<"div"> & {
  children: React.ReactNode;
};

export function Panel({ children, className = "", ...props }: PanelProps) {
  return (
    <motion.div
      {...props}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`premium-surface rounded-[1.35rem] p-4 ring-1 ring-cyan-300/[0.06] sm:rounded-[1.6rem] sm:p-5 ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function PrimaryButton(props: HTMLMotionProps<"button">) {
  const { className = "", ...rest } = props;
  return <motion.button whileTap={{ scale: 0.97 }} {...rest} className={`tap-feedback rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 px-4 py-3 font-semibold text-[#03111f] shadow-[0_0_34px_rgba(34,211,238,0.34),0_12px_28px_rgba(14,165,233,0.2)] hover:brightness-110 disabled:hover:brightness-100 ${className}`} />;
}

export function SecondaryButton(props: HTMLMotionProps<"button">) {
  const { className = "", ...rest } = props;
  return <motion.button whileTap={{ scale: 0.97 }} {...rest} className={`tap-feedback rounded-2xl border border-cyan-300/20 bg-[#0b1728]/75 px-4 py-3 font-semibold text-white shadow-[0_0_18px_rgba(34,211,238,0.08),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-xl hover:border-cyan-300/40 hover:bg-cyan-400/[0.12] ${className}`} />;
}

export function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`field ${className}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return <select {...rest} className={`field ${className}`} />;
}

export function ErrorText({ error }: { error: string }) {
  return error ? <ErrorCard message={error} className="mt-3" /> : null;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`shimmer-card rounded-2xl ${className}`} />;
}

export function EmptyState({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-[#0b1728]/70 p-5 text-center shadow-[0_0_22px_rgba(34,211,238,0.1)] backdrop-blur-xl">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-200">
        <Inbox size={20} />
      </div>
      <div className="font-semibold text-white">{title}</div>
      {detail ? <p className="mt-1 text-sm leading-5 text-sky-100/75">{detail}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorCard({ message, onRetry, className = "" }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={`rounded-2xl border border-danger/35 bg-danger/10 p-4 text-sm text-red-100 shadow-[0_0_24px_rgba(255,107,107,0.08)] backdrop-blur-xl ${className}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 shrink-0 text-danger" size={18} />
        <div className="min-w-0 flex-1 leading-5">{message}</div>
        {onRetry ? (
          <button className="shrink-0 rounded-xl bg-[#0b1728]/75 px-3 py-1.5 text-xs font-semibold text-white" onClick={onRetry} type="button">
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function StatusBadge({ value, tone = "neutral", className = "" }: { value: string; tone?: "neutral" | "success" | "warning" | "risk"; className?: string }) {
  const toneClass = tone === "success" ? "status-pill-success" : tone === "warning" ? "status-pill-warning" : tone === "risk" ? "status-pill-risk" : "";
  return <span className={`status-pill ${toneClass} ${className}`}>{value}</span>;
}
