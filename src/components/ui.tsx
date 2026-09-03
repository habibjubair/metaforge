import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { riskTone } from "../lib/engine";
import { useStore } from "../store";
import { IconAlert, IconCheck, IconUpload, IconX } from "./icons";

/* ————— Ring gauge (privacy / exposure) ————— */
export function Ring({ value, size = 64, stroke = 6, label, sub }: { value: number; size?: number; stroke?: number; label?: string; sub?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = riskTone(value);
  const color = tone === "ok" ? "var(--ok)" : tone === "warn" ? "var(--warn)" : "var(--danger)";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`exposure ${value} of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sh-d)" strokeOpacity={0.5} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * value) / 100}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(.22,1,.36,1), stroke .4s" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display tabular font-bold leading-none" style={{ fontSize: size * 0.27, color }}>{label ?? value}</span>
        {sub && <span className="mt-0.5 text-[9px] uppercase tracking-wider text-[var(--ink-faint)]">{sub}</span>}
      </div>
    </div>
  );
}

/* ————— Switch ————— */
export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      className="neu-inset-soft relative h-[26px] w-[50px] shrink-0 rounded-full transition-opacity disabled:opacity-40"
    >
      <span
        className="neu-tiny absolute top-[3px] flex h-5 w-5 items-center justify-center rounded-full transition-all duration-200"
        style={{ left: checked ? 26 : 3, background: checked ? "var(--accent)" : "var(--surface)", color: "var(--accent-ink)" }}
      >
        {checked && <IconCheck size={11} />}
      </span>
    </button>
  );
}

/* ————— Chip ————— */
export function Chip({ tone = "neutral", children, className = "" }: { tone?: "neutral" | "ok" | "warn" | "danger" | "accent"; children: ReactNode; className?: string }) {
  const map = {
    neutral: { bg: "var(--surface-2)", fg: "var(--ink-soft)", bd: "var(--line)" },
    ok: { bg: "var(--ok-soft)", fg: "var(--ok)", bd: "transparent" },
    warn: { bg: "var(--warn-soft)", fg: "var(--warn)", bd: "transparent" },
    danger: { bg: "var(--danger-soft)", fg: "var(--danger)", bd: "transparent" },
    accent: { bg: "var(--accent-soft)", fg: "var(--accent)", bd: "transparent" },
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${className}`} style={{ background: map.bg, color: map.fg, border: `1px solid ${map.bd}` }}>
      {children}
    </span>
  );
}

/* ————— Field wrapper ————— */
export function Field({ label, hint, children, right }: { label: string; hint?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">{label}</span>
        {right}
        {hint && !right && <span className="text-[10.5px] text-[var(--ink-faint)]">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export const inputCls = "neu-input w-full rounded-[10px] px-3 py-2 text-[13.5px] font-medium";

/* ————— Segmented control ————— */
export function Seg<T extends string>({ options, value, onChange, size = "md" }: { options: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; size?: "sm" | "md" }) {
  return (
    <div className="neu-inset-soft inline-flex items-center gap-1 rounded-[12px] p-1">
      {options.map((o) => (
        <button
          key={o.id} onClick={() => onChange(o.id)}
          className={`relative rounded-[9px] font-semibold transition-colors ${size === "sm" ? "px-2.5 py-1 text-[11.5px]" : "px-3.5 py-1.5 text-[12.5px]"}`}
          style={value === o.id ? { background: "var(--surface)", boxShadow: "2px 2px 6px var(--sh-d), -2px -2px 6px var(--sh-l)", color: "var(--ink)" } : { color: "var(--ink-faint)" }}
          aria-pressed={value === o.id}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ————— Modal ————— */
export function Modal({ open, onClose, title, children, width = 480 }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 26, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="neu neu-raised relative max-h-[85vh] w-full overflow-auto rounded-[18px] p-6" style={{ maxWidth: width }}
            role="dialog" aria-modal="true"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="font-display text-[17px] font-bold">{title}</h3>
              <button className="neu-btn rounded-full p-1.5 text-[var(--ink-soft)]" onClick={onClose} aria-label="Close dialog">
                <IconX size={15} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ————— Toasts ————— */
export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[330px] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => {
          const tone = t.kind === "ok" ? "var(--ok)" : t.kind === "danger" ? "var(--danger)" : t.kind === "warn" ? "var(--warn)" : "var(--accent)";
          return (
            <motion.div
              key={t.id} layout initial={{ opacity: 0, x: 60, scale: 0.94 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="neu neu-flat pointer-events-auto flex items-start gap-2.5 rounded-[12px] p-3"
            >
              <span className="neu-tiny mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: tone, color: "#fff" }}>
                {t.kind === "danger" ? <IconAlert size={13} /> : <IconCheck size={13} />}
              </span>
              <p className="flex-1 text-[12.5px] font-medium leading-snug text-[var(--ink)]">{t.msg}</p>
              <button className="text-[var(--ink-faint)] hover:text-[var(--ink)]" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <IconX size={13} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ————— Dropzone ————— */
export function Dropzone({ compact, onFiles, note }: { compact?: boolean; onFiles: (f: File[]) => void; note?: string }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const handle = (list: FileList | null) => list && onFiles([...list]);
  return (
    <div
      role="button" tabIndex={0} aria-label="Upload PDF files"
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
      className={`neu group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[16px] text-center transition-all duration-200 ${compact ? "p-4" : "p-8"}`}
      style={over ? { boxShadow: "inset 4px 4px 10px var(--sh-d), inset -4px -4px 10px var(--sh-l)", borderColor: "var(--accent)" } : undefined}
    >
      <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={(e) => { handle(e.target.files); e.target.value = ""; }} />
      <motion.span
        animate={over ? { scale: 1.12, y: -3 } : { scale: 1, y: 0 }}
        className="neu-flat flex items-center justify-center rounded-full text-[var(--accent)]"
        style={{ width: compact ? 38 : 54, height: compact ? 38 : 54 }}
      >
        <IconUpload size={compact ? 17 : 24} />
      </motion.span>
      <div>
        <p className="font-display text-[13px] font-bold">{over ? "Release to scan" : compact ? "Drop PDFs here" : "Drag PDFs — or a whole folder — into the forge"}</p>
        <p className="mt-0.5 text-[11.5px] text-[var(--ink-faint)]">{note ?? "Parsed locally by the Rust core · nothing leaves this machine"}</p>
      </div>
      {!compact && (
        <span className="neu-inset-soft mt-1 rounded-full px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
          or click to browse
        </span>
      )}
    </div>
  );
}

/* ————— Section header ————— */
export function SectionHead({ icon, title, sub, right }: { icon?: ReactNode; title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="flex items-center gap-2.5">
        {icon && <span className="neu-tiny flex h-8 w-8 items-center justify-center rounded-[10px] text-[var(--accent)]">{icon}</span>}
        <div>
          <h2 className="font-display text-[15px] font-bold leading-tight">{title}</h2>
          {sub && <p className="text-[11.5px] text-[var(--ink-faint)]">{sub}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

/* ————— Collapsible ————— */
export function Collapse({ head, children, defaultOpen = true, tone }: { head: ReactNode; children: ReactNode; defaultOpen?: boolean; tone?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="neu neu-flat overflow-hidden rounded-[14px]">
      <button className="flex w-full items-center justify-between px-4 py-2.5 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="flex items-center gap-2 text-[12.5px] font-bold">{tone && <span className="h-2 w-2 rounded-full" style={{ background: tone }} />}{head}</span>
        <motion.span animate={{ rotate: open ? 90 : 0 }} className="text-[var(--ink-faint)]" style={{ transition: "none" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m9 5.5 6.5 6.5L9 18.5" /></svg>
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <div className="border-t border-[var(--line)] px-4 py-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="neu-inset-soft rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--ink-soft)]">{children}</kbd>;
}
