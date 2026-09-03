import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { IconCheck, IconGauge, IconPress } from "../components/icons";
import { Chip, SectionHead } from "../components/ui";
import { PdfDoc, TIERS, Tier, delay, fmtBytes, projectSize } from "../lib/engine";
import { useSelected, useStore } from "../store";

function TierRow({ tier, doc, active, onPick }: { tier: (typeof TIERS)[number]; doc: PdfDoc; active: boolean; onPick: () => void }) {
  const after = projectSize(doc, tier.id);
  const saved = 1 - after / doc.sizeBytes;
  return (
    <button
      onClick={onPick} aria-pressed={active}
      className={`neu w-full rounded-[14px] p-4 text-left transition-all ${active ? "neu-inset" : "neu-flat hover:-translate-y-0.5"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-[10px] font-display text-[13px] font-extrabold"
            style={active ? { background: "var(--accent)", color: "var(--accent-ink)", boxShadow: "2px 2px 6px var(--sh-d)" } : { background: "var(--surface-2)", color: "var(--ink-faint)", boxShadow: "inset 2px 2px 5px var(--sh-d), inset -2px -2px 5px var(--sh-l)" }}
          >
            {tier.name[0]}{tier.id === "medium" ? "M" : tier.id === "high" ? "H" : ""}
          </span>
          <div>
            <p className="font-display text-[14px] font-bold">{tier.name} compression</p>
            <p className="text-[11px] text-[var(--ink-faint)]">{tier.use}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display tabular text-[15px] font-bold text-[var(--accent)]">−{Math.round(saved * 100)}%</p>
          <p className="tabular text-[10.5px] text-[var(--ink-faint)]">{fmtBytes(doc.sizeBytes)} → {fmtBytes(after)}</p>
        </div>
      </div>
      <div className="neu-inset-soft mt-3 h-[7px] overflow-hidden rounded-full">
        <motion.div
          initial={false} animate={{ width: `${saved * 100}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="h-full rounded-full" style={{ background: active ? "var(--accent)" : "var(--line)" }}
        />
      </div>
      <ul className="mt-2.5 grid gap-1 sm:grid-cols-3">
        {tier.techniques.map((t) => (
          <li key={t} className="flex items-start gap-1.5 font-mono text-[9.5px] leading-snug text-[var(--ink-soft)]">
            <IconCheck size={10} className="mt-0.5 shrink-0 text-[var(--accent)]" /> {t}
          </li>
        ))}
      </ul>
    </button>
  );
}

export function Compress() {
  const doc = useSelected();
  const docs = useStore((s) => s.docs);
  const select = useStore((s) => s.select);
  const compress = useStore((s) => s.compress);
  const toast = useStore((s) => s.toast);
  const setBusy = useStore((s) => s.setBusy);
  const [tier, setTier] = useState<Tier>("medium");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => { const first = useStore.getState().docs[0]; if (!useStore.getState().selectedId && first) select(first.id); }, [select]);

  const run = async (target: PdfDoc, t: Tier, silent = false) => {
    const stages = ["Parsing object streams…", "Re-encoding raster content…", "Subsetting fonts…", "Merging duplicate objects…", "Rewriting xref table…"];
    for (let i = 0; i < stages.length; i++) {
      setBusy(stages[i]);
      setProgress(((i + 1) / stages.length) * 100);
      await delay(260 + Math.random() * 160);
    }
    compress(target.id, t);
    setBusy(null);
    return target;
  };

  const press = async () => {
    if (!doc || running) return;
    setRunning(true); setProgress(0);
    const before = doc.sizeBytes;
    await run(doc, tier);
    const after = projectSize(doc, tier);
    setRunning(false);
    toast(`${doc.name}: ${fmtBytes(before)} → ${fmtBytes(after)} (−${Math.round((1 - after / before) * 100)}%)`, "ok");
  };

  const pressAll = async () => {
    if (running) return;
    setRunning(true); setProgress(0);
    for (const d of docs) {
      select(d.id);
      await run(d, tier, true);
    }
    setRunning(false);
    toast(`Batch complete — ${docs.length} documents optimized at ${tier} tier`, "ok");
  };

  if (!doc)
    return <p className="p-10 text-center text-[13px] text-[var(--ink-faint)]">The queue is empty — import PDFs in the Workbench to start pressing.</p>;
  const projected = projectSize(doc, tier);

  return (
    <div className="anim-rise flex h-full min-h-0 flex-col gap-4 overflow-y-auto pb-2">
      <SectionHead
        icon={<IconPress size={17} />} title="Compression suite" sub="Tiered optimizer — lossless to aggressive, one press of the plate"
        right={
          <select className="neu-input rounded-[10px] px-3 py-1.5 text-[12px] font-semibold" value={doc.id} onChange={(e) => select(e.target.value)} aria-label="Document to compress">
            {docs.map((d) => <option key={d.id} value={d.id}>{d.name}{d.compressed ? ` · −${Math.round((1 - d.compressed.after / d.compressed.before) * 100)}%` : ""}</option>)}
          </select>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
        <div className="space-y-3">
          {TIERS.map((t) => <TierRow key={t.id} tier={t} doc={doc} active={tier === t.id} onPick={() => setTier(t.id)} />)}
        </div>

        <div className="flex flex-col gap-3">
          <div className="neu neu-flat rounded-[16px] p-4">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-soft)]">
              <IconGauge size={14} className="text-[var(--accent)]" /> Press chamber
            </p>
            <p className="mt-3 truncate text-[12.5px] font-bold">{doc.name}</p>
            <div className="mt-3 space-y-2">
              {[
                { label: "Current", val: doc.sizeBytes, color: "var(--ink-faint)", w: 100 },
                { label: "Projected", val: projected, color: "var(--accent)", w: (projected / doc.sizeBytes) * 100 },
              ].map((r) => (
                <div key={r.label}>
                  <div className="mb-1 flex justify-between text-[10.5px] font-semibold">
                    <span className="text-[var(--ink-faint)]">{r.label}</span>
                    <span className="tabular">{fmtBytes(r.val)}</span>
                  </div>
                  <div className="neu-inset-soft h-[9px] overflow-hidden rounded-full">
                    <motion.div initial={false} animate={{ width: `${r.w}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="h-full rounded-full" style={{ background: r.color }} />
                  </div>
                </div>
              ))}
            </div>
            <button className="neu-btn neu-btn-primary mt-4 w-full rounded-[12px] py-3 font-display text-[14px] font-bold" onClick={press} disabled={running}>
              {running ? <span className="sweep-bar absolute inset-0 rounded-[12px]" /> : null}
              {running ? `Pressing… ${Math.round(progress)}%` : `Press — ${tier} tier`}
            </button>
            <AnimatePresence>
              {doc.compressed && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="mt-3 overflow-hidden text-center text-[11px] font-semibold text-[var(--ok)]">
                  ✓ Last press saved {Math.round((1 - doc.compressed.after / doc.compressed.before) * 100)}% · {doc.compressed.tier} tier
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="neu neu-flat rounded-[16px] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-soft)]">Batch press</p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--ink-faint)]">Run the {tier} tier across all {docs.length} documents in the queue, sequentially.</p>
            <button className="neu-btn mt-3 w-full rounded-[11px] py-2.5 text-[12.5px] font-bold text-[var(--ink-soft)]" onClick={pressAll} disabled={running}>
              Press all {docs.length} documents
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
