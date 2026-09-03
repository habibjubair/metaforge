import { motion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { IconCheck, IconDownload, IconEdit, IconLayers, IconSpark, IconSync, IconUpload } from "../components/icons";
import { Chip, SectionHead, inputCls } from "../components/ui";
import {
  PdfDoc, TEMPLATES, Template, aiGenerate, docsToCsv, download, exposureOf, fmtBytes,
  parseCsv, riskTone,
} from "../lib/engine";
import { useStore } from "../store";

export function Sync() {
  const docs = useStore((s) => s.docs);
  const saveInfo = useStore((s) => s.saveInfo);
  const applyTemplate = useStore((s) => s.applyTemplate);
  const wipeFindings = useStore((s) => s.wipeFindings);
  const applyRow = useStore((s) => s.applyRow);
  const pushAudit = useStore((s) => s.pushAudit);
  const toast = useStore((s) => s.toast);
  const setBusy = useStore((s) => s.setBusy);

  const [picked, setPicked] = useState<string[]>([]);
  const [author, setAuthor] = useState("");
  const [producer, setProducer] = useState("");
  const [kw, setKw] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  const sel = useMemo(() => docs.filter((d) => picked.includes(d.id)), [docs, picked]);
  const allPicked = picked.length === docs.length && docs.length > 0;
  const toggleAll = () => setPicked(allPicked ? [] : docs.map((d) => d.id));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const need = (n: number) => {
    if (!sel.length) { toast("Select at least one document below", "warn"); return false; }
    return true;
    void n;
  };

  const batchSet = (field: "author" | "producer", value: string) => {
    if (!need(1) || !value.trim()) { toast("Enter a value first", "warn"); return; }
    sel.forEach((d) => saveInfo(d.id, { ...d.info, [field]: value.trim() }, `Batch set ${field}`));
    pushAudit("batch", "Batch update", `${field} → "${value.trim()}" across ${sel.length} files`, "edit");
    toast(`${field} updated on ${sel.length} document${sel.length > 1 ? "s" : ""}`, "ok");
    if (field === "author") setAuthor(""); else setProducer("");
  };
  const batchKw = () => {
    const v = kw.trim().toLowerCase().replace(/\s+/g, "-");
    if (!need(1) || !v) { toast("Enter a keyword first", "warn"); return; }
    sel.forEach((d) => !d.info.keywords.includes(v) && saveInfo(d.id, { ...d.info, keywords: [...d.info.keywords, v] }, `Batch keyword +${v}`));
    pushAudit("batch", "Batch update", `Keyword "${v}" injected into ${sel.length} files`, "edit");
    toast(`Keyword “${v}” added to ${sel.length} files`, "ok"); setKw("");
  };
  const batchTemplate = (tpl: Template) => {
    if (!need(1)) return;
    sel.forEach((d) => applyTemplate(d.id, tpl));
    pushAudit("batch", "Template", `"${tpl.name}" applied to ${sel.length} files`, "edit");
    toast(`Template “${tpl.name}” applied to ${sel.length} files`, "ok");
  };
  const batchAi = async () => {
    if (!need(1)) return;
    setBusy("Local LLM scanning batch…");
    await new Promise((r) => setTimeout(r, 900 + sel.length * 120));
    sel.forEach((d) => {
      const g = aiGenerate(d);
      saveInfo(d.id, { ...d.info, keywords: g.keywords }, "AI keyword generation");
    });
    setBusy(null);
    pushAudit("batch", "AI", `10 keywords generated per file × ${sel.length} files (local model)`, "edit");
    toast(`AI injected 10 keywords into each of ${sel.length} files`, "ok");
  };
  const batchGps = () => {
    if (!need(1)) return;
    let count = 0;
    sel.forEach((d) => {
      const gps = d.findings.filter((f) => f.kind === "gps" && !f.resolved).map((f) => f.id);
      if (gps.length) { wipeFindings(d.id, gps); count += gps.length; }
    });
    toast(count ? `Sanitized ${count} GPS record${count > 1 ? "s" : ""} across the batch` : "No unresolved GPS records in selection", count ? "ok" : "info");
  };

  const exportCsv = () => { download(`metaforge-metadata-${docs.length}docs.csv`, docsToCsv(docs), "text/csv"); pushAudit("export", "Export", `${docs.length} documents → CSV`, "system"); toast("CSV exported — edit in Excel, re-import anytime", "ok"); };
  const exportJson = () => {
    const payload = docs.map((d) => ({ name: d.name, ...d.info, keywords: d.info.keywords }));
    download(`metaforge-metadata-${docs.length}docs.json`, JSON.stringify(payload, null, 2), "application/json");
    pushAudit("export", "Export", `${docs.length} documents → JSON`, "system");
    toast("JSON exported", "ok");
  };
  const onImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      let rows: Record<string, string>[] = [];
      try {
        if (file.name.toLowerCase().endsWith(".json")) {
          const arr = JSON.parse(text);
          rows = Array.isArray(arr) ? arr : [];
        } else rows = parseCsv(text);
      } catch { toast("Could not parse file — check the format", "danger"); return; }
      let matched = 0;
      rows.forEach((r) => {
        if (!r.name) return;
        const row: Partial<import("../lib/engine").InfoData> = {};
        if (r.title !== undefined) row.title = r.title;
        if (r.author !== undefined) row.author = r.author;
        if (r.subject !== undefined) row.subject = r.subject;
        if (r.producer !== undefined) row.producer = r.producer;
        if (r.keywords) row.keywords = String(r.keywords).split(";").map((k) => k.trim()).filter(Boolean);
        if (applyRow(r.name, row)) matched++;
      });
      pushAudit("import", "Import", `${matched}/${rows.length} rows matched & applied from ${file.name}`, "import");
      toast(`Import complete — ${matched}/${rows.length} rows applied`, matched ? "ok" : "warn");
    };
    reader.readAsText(file);
  };

  const MiniBtn = ({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) => (
    <button className="neu-btn flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[11.5px] font-bold text-[var(--ink-soft)] disabled:opacity-40" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );

  return (
    <div className="anim-rise flex h-full min-h-0 flex-col gap-4 overflow-y-auto pb-2">
      <SectionHead
        icon={<IconSync size={17} />} title="Batch & cross-format sync"
        sub={`${docs.length} documents in queue · ${picked.length} selected · CSV/JSON round-trip`}
        right={
          <div className="flex gap-2">
            <button className="neu-btn flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[12px] font-bold text-[var(--ink-soft)]" onClick={exportCsv}><IconDownload size={13} /> CSV</button>
            <button className="neu-btn flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[12px] font-bold text-[var(--ink-soft)]" onClick={exportJson}><IconDownload size={13} /> JSON</button>
            <button className="neu-btn neu-btn-primary flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[12px] font-bold" onClick={() => importRef.current?.click()}>
              <IconUpload size={13} /> Import
            </button>
            <input ref={importRef} type="file" accept=".csv,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }} />
          </div>
        }
      />

      {/* batch control bar */}
      <div className="neu neu-flat rounded-[16px] p-4">
        <div className="grid gap-3 lg:grid-cols-4">
          <div>
            <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">Set author</p>
            <div className="flex gap-1.5">
              <input className={`${inputCls} !py-1.5 !text-[12px]`} value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="e.g. Legal Dept." />
              <MiniBtn onClick={() => batchSet("author", author)}><IconEdit size={12} />Apply</MiniBtn>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">Set producer / company</p>
            <div className="flex gap-1.5">
              <input className={`${inputCls} !py-1.5 !text-[12px]`} value={producer} onChange={(e) => setProducer(e.target.value)} placeholder="e.g. MetaForge Press" />
              <MiniBtn onClick={() => batchSet("producer", producer)}><IconEdit size={12} />Apply</MiniBtn>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">Inject keyword</p>
            <div className="flex gap-1.5">
              <input className={`${inputCls} !py-1.5 !text-[12px]`} value={kw} onChange={(e) => setKw(e.target.value)} placeholder="e.g. fy2026" />
              <MiniBtn onClick={batchKw}><IconEdit size={12} />Apply</MiniBtn>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">One-shot actions</p>
            <div className="flex flex-wrap gap-1.5">
              <MiniBtn onClick={batchAi} disabled={!sel.length}><IconSpark size={12} />AI keywords</MiniBtn>
              <MiniBtn onClick={batchGps} disabled={!sel.length}><IconCheck size={12} />Sanitize GPS</MiniBtn>
            </div>
          </div>
        </div>
      </div>

      {/* templates */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {TEMPLATES.map((t, i) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="neu neu-flat flex flex-col rounded-[15px] p-4">
            <div className="flex items-center justify-between">
              <span className="neu-tiny flex h-8 w-8 items-center justify-center rounded-[9px] text-[var(--accent)]"><IconLayers size={15} /></span>
              <Chip tone="accent">{t.info.keywords?.length ?? 0} kw</Chip>
            </div>
            <p className="mt-2.5 font-display text-[14px] font-bold">{t.name}</p>
            <p className="mt-1 flex-1 text-[11px] leading-relaxed text-[var(--ink-faint)]">{t.blurb}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {t.info.keywords?.slice(0, 3).map((k) => <span key={k} className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-[var(--ink-soft)]">{k}</span>)}
            </div>
            <button className="neu-btn neu-btn-primary mt-3 rounded-[10px] py-2 text-[12px] font-bold" onClick={() => batchTemplate(t)}>
              Apply to {sel.length || "selected"}
            </button>
          </motion.div>
        ))}
      </div>

      {/* file table */}
      <div className="neu neu-flat overflow-hidden rounded-[16px]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2.5">
          <label className="flex cursor-pointer items-center gap-2.5 text-[12px] font-bold">
            <input type="checkbox" checked={allPicked} onChange={toggleAll} className="accent-[var(--accent)]" aria-label="Select all documents" />
            {allPicked ? "All" : picked.length ? `${picked.length} selected` : "Select documents"}
          </label>
          <p className="font-mono text-[10px] text-[var(--ink-faint)]">exposure shown per file</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">
                <th className="w-8 px-4 py-2" />
                <th className="py-2 pr-3 font-bold">Document</th>
                <th className="py-2 pr-3 font-bold">Title</th>
                <th className="py-2 pr-3 font-bold">Author</th>
                <th className="py-2 pr-3 font-bold">Size</th>
                <th className="py-2 pr-4 font-bold">Exposure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {docs.map((d: PdfDoc) => {
                const ex = exposureOf(d);
                const tone = riskTone(ex);
                const on = picked.includes(d.id);
                return (
                  <tr key={d.id} className={`cursor-pointer transition-colors ${on ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]"}`} onClick={() => toggle(d.id)}>
                    <td className="px-4 py-2.5"><input type="checkbox" checked={on} onChange={() => toggle(d.id)} className="accent-[var(--accent)]" aria-label={`Select ${d.name}`} onClick={(e) => e.stopPropagation()} /></td>
                    <td className="max-w-[200px] truncate py-2.5 pr-3 font-bold">{d.name}</td>
                    <td className="max-w-[180px] truncate py-2.5 pr-3 text-[var(--ink-soft)]">{d.info.title || <em className="text-[var(--ink-faint)]">—</em>}</td>
                    <td className="max-w-[140px] truncate py-2.5 pr-3 text-[var(--ink-soft)]">{d.info.author || <em className="text-[var(--ink-faint)]">—</em>}</td>
                    <td className="tabular whitespace-nowrap py-2.5 pr-3 text-[var(--ink-soft)]">{fmtBytes(d.sizeBytes)}</td>
                    <td className="py-2.5 pr-4">
                      <span className="tabular inline-flex items-center gap-1.5 font-bold" style={{ color: tone === "ok" ? "var(--ok)" : tone === "warn" ? "var(--warn)" : "var(--danger)" }}>
                        <span className="neu-inset-soft inline-block h-[5px] w-14 overflow-hidden rounded-full">
                          <span className="block h-full rounded-full" style={{ width: `${ex}%`, background: "currentColor" }} />
                        </span>
                        {ex}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-center font-mono text-[10px] text-[var(--ink-faint)]">
        tip — export CSV → edit {docs.length} rows in Excel → re-import; rows match by file name and every imported change keeps a history snapshot
      </p>
    </div>
  );
}
