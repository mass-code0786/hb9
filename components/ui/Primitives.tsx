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
      className={`rounded-[1.35rem] border border-white/10 bg-panel/90 p-4 shadow-wallet backdrop-blur sm:p-5 ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function PrimaryButton(props: HTMLMotionProps<"button">) {
  const { className = "", ...rest } = props;
  return <motion.button whileTap={{ scale: 0.97 }} {...rest} className={`rounded-2xl bg-accent px-4 py-3 font-semibold text-black transition hover:brightness-110 disabled:hover:brightness-100 ${className}`} />;
}

export function SecondaryButton(props: HTMLMotionProps<"button">) {
  const { className = "", ...rest } = props;
  return <motion.button whileTap={{ scale: 0.97 }} {...rest} className={`rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 font-semibold text-slate-100 transition hover:bg-white/[0.1] ${className}`} />;
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
  return <div className={`animate-pulse rounded-2xl bg-gradient-to-r from-white/[0.045] via-white/[0.09] to-white/[0.045] ${className}`} />;
}

export function EmptyState({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.07] text-slate-300">
        <Inbox size={20} />
      </div>
      <div className="font-semibold text-slate-100">{title}</div>
      {detail ? <p className="mt-1 text-sm leading-5 text-slate-400">{detail}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorCard({ message, onRetry, className = "" }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={`rounded-2xl border border-danger/35 bg-danger/10 p-4 text-sm text-red-100 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 shrink-0 text-danger" size={18} />
        <div className="min-w-0 flex-1 leading-5">{message}</div>
        {onRetry ? (
          <button className="shrink-0 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-white" onClick={onRetry} type="button">
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}
