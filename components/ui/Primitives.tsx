"use client";

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[1.6rem] border border-white/10 bg-panel/90 p-5 shadow-wallet backdrop-blur ${className}`}>{children}</div>;
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return <button {...rest} className={`rounded-2xl bg-accent px-4 py-3 font-semibold text-black transition hover:brightness-110 disabled:hover:brightness-100 ${className}`} />;
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return <button {...rest} className={`rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 font-semibold text-slate-100 transition hover:bg-white/[0.1] ${className}`} />;
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
  return error ? <p className="mt-3 rounded-2xl border border-danger/40 bg-danger/10 p-3 text-sm text-red-100">{error}</p> : null;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/10 ${className}`} />;
}
