import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconBroom, IconCheck, IconEye, IconFile, IconHistory, IconLayers, IconLock, IconPlus,
  IconRadar, IconSearch, IconSpark, IconTerminal, IconTrash, IconTree, IconUnlock, IconX, IconZap,
} from "../components/icons";
import { Chip, Collapse, Dropzone, Field, Kbd, Modal, SectionHead, Seg, inputCls } from "../components/ui";
import {
  Finding, InfoData, PdfDoc, aiGenerate, buildXmp, exposureOf, fmtAgo, fmtBytes, riskLabel,
  riskTone, validateXmp,
} from "../lib/engine";
import { useStore } from "../store";
import { PreviewPane } from "./PreviewPane";

/* ═══════════ XMP highlight (single-pass tokenizer) ═══════════ */
function highlightXmp(src: string): string {
  const s = src.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const re = /(&lt;!--[\s\S]*?--&gt;)|(&lt;\?[\s\S]*?\?&gt;)|(&lt;\/?[a-zA-Z][\w:.-]*)|(\/?&gt;)|([a-zA-Z][\w:.-]*=)("[^"]*")/g;
  return s.replace(re, (m, com, pi, tag, close, attr, val) => {
    if (com || pi) return `<span class="xt-com">${com || pi}</span>`;
    if (tag || close) return `<span class="xt-tag">${tag || close}</span>`;
    return `<span class="xt-attr">${attr}</span><span class="xt-val">${val}</span>`;
  });
}

/* ═══════════ File rail ═══════════ */
function FileRail() {
  const docs = useStore((s) => s.docs);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const addFiles = useStore((s) => s.addFiles);
  const removeDoc = useStore((s) => s.removeDoc);
  const [q, setQ] = useState("");
  const list = docs.filter((d) => d.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <aside className="flex w-[248px] shrink-0 flex-col gap-3">
      <div className="neu-inset-soft flex items-center gap-2 rounded-[12px] px-3 py-2">
        <IconSearch size={14} className="text-[var(--ink-faint)]" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter documents…"
          className="w-full bg-transparent text-[12.5px] font-medium outline-none placeholder:text-[var(--ink-faint)]"
          aria-label="Filter documents"
        />
      </div>
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-0.5">
        {list.map((d) => {
          const ex = exposureOf(d);
          const tone = riskTone(ex);
          const active = d.id === selectedId;
          return (
            <div key={d.id} className="group relative">
              <button
                onClick={() => select(d.id)}
                className={`neu w-full rounded-[13px] p-3 text-left transition-all ${active ? "neu-inset" : "neu-flat hover:-translate-y-px"}`}
                aria-pressed={active}
              >
                <div className="flex items-start gap-2.5">
                  <span className={`mt-0.5 ${active ? "text-[var(--accent)]" : "text-[var(--ink-faint)]"}`}><IconFile size={17} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-bold leading-tight">{d.name}</p>
                    <p className="mt-0.5 text-[10.5px] text-[var(--ink-faint)]">
                      {fmtBytes(d.sizeBytes)} · {d.pages} p · v{d.version}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <div className="neu-inset-soft h-[5px] flex-1 overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${ex}%`, background: tone === "ok" ? "var(--ok)" : tone === "warn" ? "var(--warn)" : "var(--danger)" }}
                        />
                      </div>
                      <span className="tabular text-[10px] font-bold" style={{ color: tone === "ok" ? "var(--ok)" : tone === "warn" ? "var(--warn)" : "var(--danger)" }}>{ex}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {d.signature && <Chip tone="accent"><IconLock size={9} />signed</Chip>}
                      {d.compressed && <Chip tone="ok">−{Math.round((1 - d.compressed.after / d.compressed.before) * 100)}%</Chip>}
                      {d.flattened && <Chip tone="neutral"><IconLayers size={9} />flat</Chip>}
                      {d.locked && !d.locked.unlocked && <Chip tone="warn"><IconLock size={9} />sealed</Chip>}
                      {d.findings.some((f) => !f.resolved && (f.kind === "jsAction" || f.kind === "launch")) && <Chip tone="danger">JS</Chip>}
                    </div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => removeDoc(d.id)} aria-label={`Remove ${d.name}`}
                className="neu-btn absolute -right-1.5 -top-1.5 hidden rounded-full p-1 text-[var(--danger)] group-hover:block"
              >
                <IconX size={11} />
              </button>
            </div>
          );
        })}
        {!list.length && <p className="px-2 py-6 text-center text-[12px] text-[var(--ink-faint)]">No documents match “{q}”.</p>}
      </div>
      <Dropzone compact onFiles={(fs) => addFiles(fs.map((f) => ({ name: f.name, size: f.size })))} />
    </aside>
  );
}

/* ═══════════ Metadata tree ═══════════ */
function TreeRow({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div className="flex items-baseline gap-2 py-[3px] text-[12px]">
      <span className="h-[7px] w-[7px] shrink-0 translate-y-[-1px] rounded-[2px]" style={{ background: color ?? "var(--line)" }} />
      <span className="w-[118px] shrink-0 font-mono text-[10.5px] text-[var(--ink-faint)]">{k}</span>
      <span className="min-w-0 truncate font-medium text-[var(--ink-soft)]">{v || <em className="text-[var(--ink-faint)]">∅ empty</em>}</span>
    </div>
  );
}
function MetadataTree({ doc }: { doc: PdfDoc }) {
  const [raw, setRaw] = useState<"tree" | "json" | "xml">("tree");
  const i = doc.info;
  return (
    <Collapse head="Metadata tree — dual engine" tone="var(--accent)" defaultOpen={false}>
      <div className="mb-2 flex justify-end">
        <Seg size="sm" value={raw} onChange={setRaw} options={[{ id: "tree", label: "Tree" }, { id: "json", label: "JSON" }, { id: "xml", label: "XML" }]} />
      </div>
      {raw !== "tree" ? (
        <pre className="neu-inset max-h-[260px] overflow-auto rounded-[10px] p-3 font-mono text-[10.5px] leading-relaxed text-[var(--ink-soft)]">
          {raw === "json" ? JSON.stringify({ InfoDictionary: i, exposure: exposureOf(doc) }, null, 2) : buildXmp(doc)}
        </pre>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="mb-1 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]"><IconTree size={11} /> /Info dictionary (legacy)</p>
            <TreeRow k="Title" v={i.title} color="var(--accent)" />
            <TreeRow k="Author" v={i.author} color="var(--accent)" />
            <TreeRow k="Subject" v={i.subject} color="var(--accent)" />
            <TreeRow k="Keywords" v={i.keywords.join(", ")} color="var(--accent)" />
            <TreeRow k="Producer" v={i.producer} color="var(--accent)" />
          </div>
          <div>
            <p className="mb-1 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--warn)]"><IconTree size={11} /> XMP packet (modern)</p>
            <TreeRow k="dc:title" v={i.title} color="var(--warn)" />
            <TreeRow k="dc:creator" v={i.author} color="var(--warn)" />
            <TreeRow k="dc:subject" v={`${i.keywords.length} terms`} color="var(--warn)" />
            <TreeRow k="xmp:CreateDate" v={i.created.slice(0, 10)} color="var(--warn)" />
            <TreeRow k="xmp:CreatorTool" v={i.creator} color="var(--warn)" />
            {i.custom.map(([k, v]) => <TreeRow key={k} k={`metaforge:${k}`} v={v} color="var(--warn)" />)}
          </div>
          <div>
            <p className="mb-1 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]"><IconTree size={11} /> Structure</p>
            <TreeRow k="/Pages" v={`${doc.pages} page objects`} />
            <TreeRow k="Linearized" v={doc.linearized ? "yes — fast web view" : "no"} />
            <TreeRow k="PDF version" v={doc.version} />
            <TreeRow k="/EmbeddedFiles" v={doc.findings.some((f) => f.kind === "attachment" && !f.resolved) ? "1 payload (flagged)" : "none"} color={doc.findings.some((f) => f.kind === "attachment" && !f.resolved) ? "var(--danger)" : undefined} />
          </div>
        </div>
      )}
    </Collapse>
  );
}

/* ═══════════ Hidden data detector ═══════════ */
function HiddenData({ doc }: { doc: PdfDoc }) {
  const wipeFindings = useStore((s) => s.wipeFindings);
  const nuke = useStore((s) => s.nuke);
  const flatten = useStore((s) => s.flatten);
  const redactMode = useStore((s) => s.redactMode);
  const toast = useStore((s) => s.toast);
  const [picked, setPicked] = useState<string[]>([]);
  const [nukeOpen, setNukeOpen] = useState(false);
  const [confirmNuke, setConfirmNuke] = useState(false);
  const open = doc.findings.filter((f) => !f.resolved);
  const resolved = doc.findings.filter((f) => f.resolved);
  const ex = exposureOf(doc);

  useEffect(() => setPicked([]), [doc.id]);

  return (
    <div className="neu neu-flat rounded-[14px] p-4">
      <SectionHead
        icon={<IconRadar size={16} />} title="Hidden data detector"
        sub={open.length ? `${open.length} finding${open.length > 1 ? "s" : ""} · exposure ${ex}/100 — ${riskLabel(ex)}` : "Clean — no hidden payloads remain"}
        right={<Chip tone={riskTone(ex) === "ok" ? "ok" : riskTone(ex) === "warn" ? "warn" : "danger"}>{riskTone(ex) === "ok" ? "SAFE" : riskTone(ex) === "warn" ? "ELEVATED" : "CRITICAL"}</Chip>}
      />
      {open.length > 0 && (
        <div className="space-y-2">
          {open.map((f: Finding) => (
            <label key={f.id} className="neu-inset-soft flex cursor-pointer items-start gap-3 rounded-[11px] p-2.5 transition-colors hover:bg-[var(--surface-2)]">
              <input
                type="checkbox" checked={picked.includes(f.id)}
                onChange={(e) => setPicked((p) => (e.target.checked ? [...p, f.id] : p.filter((x) => x !== f.id)))}
                className="mt-1 accent-[var(--accent)]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12.5px] font-bold">{f.label}</span>
                  <Chip tone="danger">+{f.weight}</Chip>
                </div>
                <p className="mt-0.5 font-mono text-[10.5px] leading-relaxed text-[var(--ink-faint)]">{f.detail}</p>
              </div>
            </label>
          ))}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              className="neu-btn neu-btn-primary flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[12px] font-bold"
              disabled={!picked.length}
              onClick={() => { wipeFindings(doc.id, picked); toast(`${picked.length} tag${picked.length > 1 ? "s" : ""} ${redactMode ? "cryptographically redacted" : "wiped"}`, "ok"); setPicked([]); }}
            >
              <IconBroom size={14} /> Wipe selected ({picked.length})
            </button>
            <button
              className="neu-btn flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[12px] font-bold text-[var(--ink-soft)]"
              onClick={() => { flatten(doc.id); toast("Document flattened — form data & JS actions removed", "ok"); }}
              disabled={doc.flattened}
            >
              <IconLayers size={14} /> {doc.flattened ? "Flattened" : "Flatten"}
            </button>
            <div className="flex-1" />
            <button className="neu-btn neu-btn-danger flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[12px] font-bold" onClick={() => { setConfirmNuke(false); setNukeOpen(true); }}>
              <IconZap size={14} /> Nuke all metadata
            </button>
          </div>
          {redactMode && <p className="font-mono text-[10px] text-[var(--accent)]">◈ cryptographic redaction armed — wiped blocks will be overwritten with noise</p>}
        </div>
      )}
      {resolved.length > 0 && (
        <div className="mt-3 border-t border-[var(--line)] pt-2.5">
          <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">Resolved this session</p>
          <div className="flex flex-wrap gap-1.5">
            {resolved.map((f) => (
              <span key={f.id} className="inline-flex items-center gap-1.5 rounded-md bg-[var(--ok-soft)] px-2 py-1 font-mono text-[10px] font-semibold text-[var(--ok)]">
                <IconCheck size={10} /> <span className="anim-strike">{f.label}</span>
                {f.redacted && <span title={f.redacted} className="cursor-help opacity-70">[0x{f.redacted.slice(0, 6)}…]</span>}
              </span>
            ))}
          </div>
        </div>
      )}
      <Modal open={nukeOpen} onClose={() => setNukeOpen(false)} title="Nuke — total metadata wipe" width={440}>
        <p className="text-[13px] leading-relaxed text-[var(--ink-soft)]">
          This strips <strong className="text-[var(--ink)]">every</strong> metadata field from <strong className="text-[var(--ink)]">{doc.name}</strong> — title, author,
          XMP packet, custom schema and all {doc.findings.filter((f) => !f.resolved).length} hidden findings — flattening the document to an anonymous state.
        </p>
        <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-[10px] bg-[var(--danger-soft)] p-3 text-[12.5px] font-semibold text-[var(--danger)]">
          <input type="checkbox" checked={confirmNuke} onChange={(e) => setConfirmNuke(e.target.checked)} className="accent-[var(--danger)]" />
          I understand this cannot be undone in-place (a history snapshot is kept)
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button className="neu-btn rounded-[10px] px-4 py-2 text-[12.5px] font-bold text-[var(--ink-soft)]" onClick={() => setNukeOpen(false)}>Cancel</button>
          <button
            className="neu-btn neu-btn-danger rounded-[10px] px-4 py-2 text-[12.5px] font-bold" disabled={!confirmNuke}
            onClick={() => { nuke(doc.id); setNukeOpen(false); toast(`${doc.name} anonymized — exposure 0`, "danger"); }}
          >
            <IconZap size={13} /> Execute nuke
          </button>
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════ XMP editor ═══════════ */
function XmpEditor({ doc }: { doc: PdfDoc }) {
  const saveInfo = useStore((s) => s.saveInfo);
  const toast = useStore((s) => s.toast);
  const [draft, setDraft] = useState(() => buildXmp(doc));
  const [docId, setDocId] = useState(doc.id);
  const preRef = useRef<HTMLPreElement>(null);
  const gutRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (doc.id !== docId) { setDraft(buildXmp(doc)); setDocId(doc.id); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  const html = useMemo(() => highlightXmp(draft), [draft]);
  const valid = useMemo(() => validateXmp(draft), [draft]);
  const lines = draft.split("\n").length;
  const sync = () => {
    const ta = taRef.current;
    if (!ta) return;
    if (preRef.current) { preRef.current.scrollTop = ta.scrollTop; preRef.current.scrollLeft = ta.scrollLeft; }
    if (gutRef.current) gutRef.current.scrollTop = ta.scrollTop;
  };
  const apply = () => {
    if (!valid.ok) { toast(`XMP rejected — ${valid.error}`, "danger"); return; }
    const info = { ...doc.info, modified: new Date().toISOString() };
    const t = draft.match(/<rdf:li xml:lang="x-default">([^<]*)<\/rdf:li>/);
    const a = draft.match(/<dc:creator>[\s\S]*?<rdf:li>([^<]*)<\/rdf:li>/);
    const p = draft.match(/<pdf:Producer>([^<]*)<\/pdf:Producer>/);
    if (t) info.title = t[1];
    if (a) info.author = a[1];
    if (p) info.producer = p[1];
    saveInfo(doc.id, info, "Raw XMP packet rewritten");
    toast("XMP packet committed to document", "ok");
  };

  return (
    <div className="neu neu-flat overflow-hidden rounded-[14px]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <IconTerminal size={15} className="text-[var(--accent)]" />
          <span className="font-display text-[13px] font-bold">Raw XMP packet</span>
          <Chip tone={valid.ok ? "ok" : "danger"}>{valid.ok ? "well-formed" : "invalid XML"}</Chip>
        </div>
        <div className="flex gap-2">
          <button className="neu-btn rounded-[9px] px-3 py-1.5 text-[11.5px] font-bold text-[var(--ink-soft)]" onClick={() => { setDraft(buildXmp(doc)); toast("Re-synced from document state", "info"); }}>Re-sync</button>
          <button className="neu-btn neu-btn-primary rounded-[9px] px-3 py-1.5 text-[11.5px] font-bold" onClick={apply}>Apply packet</button>
        </div>
      </div>
      {!valid.ok && <p className="border-b border-[var(--danger-soft)] bg-[var(--danger-soft)] px-4 py-1.5 font-mono text-[10.5px] font-semibold text-[var(--danger)]">✕ {valid.error}</p>}
      <div className="flex max-h-[430px]">
        <div ref={gutRef} className="neu-inset-soft w-10 shrink-0 overflow-hidden py-3 text-right font-mono text-[10.5px] leading-[1.7] text-[var(--ink-faint)]" aria-hidden>
          {Array.from({ length: lines }, (_, i) => <div key={i} className="pr-2">{i + 1}</div>)}
        </div>
        <div className="relative min-w-0 flex-1">
          <pre
            ref={preRef} aria-hidden
            className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre p-3 font-mono text-[11.5px] leading-[1.7] text-[var(--ink-soft)]"
            dangerouslySetInnerHTML={{ __html: html + "\n" }}
          />
          <textarea
            ref={taRef} value={draft} onChange={(e) => setDraft(e.target.value)} onScroll={sync}
            spellCheck={false} aria-label="Raw XMP XML editor"
            className="relative h-[430px] w-full resize-none whitespace-pre overflow-auto bg-transparent p-3 font-mono text-[11.5px] leading-[1.7] text-transparent caret-[var(--accent)] outline-none"
          />
        </div>
      </div>
    </div>
  );
}

/* ═══════════ History ═══════════ */
function HistoryPanel({ doc }: { doc: PdfDoc }) {
  const rollback = useStore((s) => s.rollback);
  const toast = useStore((s) => s.toast);
  const entries = [...doc.history].reverse();
  return (
    <div className="neu neu-flat rounded-[14px] p-4">
      <SectionHead icon={<IconHistory size={16} />} title="Version control" sub="Git-style snapshots of the metadata block — roll back any save" />
      <ol className="relative ml-2 space-y-3 border-l-2 border-[var(--line)] pl-5">
        {entries.map((e, idx) => (
          <motion.li key={e.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }} className="relative">
            <span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 ${idx === 0 ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--surface)]"}`} />
            <div className="neu-inset-soft rounded-[11px] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[12.5px] font-bold">{e.label}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-[var(--ink-faint)]">
                    {fmtAgo(e.at)} · “{e.snapshot.title || "untitled"}” · {e.snapshot.author || "no author"} · {e.snapshot.keywords.length} kw
                  </p>
                </div>
                {idx !== 0 && (
                  <button
                    className="neu-btn rounded-[9px] px-3 py-1.5 text-[11px] font-bold text-[var(--accent)]"
                    onClick={() => { rollback(doc.id, e); toast(`Rolled back to “${e.label}”`, "ok"); }}
                  >
                    Restore
                  </button>
                )}
                {idx === 0 && <Chip tone="accent">HEAD</Chip>}
              </div>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

/* ═══════════ Smart form ═══════════ */
function SmartForm({ doc }: { doc: PdfDoc }) {
  const saveInfo = useStore((s) => s.saveInfo);
  const unlockDoc = useStore((s) => s.unlockDoc);
  const toast = useStore((s) => s.toast);
  const setBusy = useStore((s) => s.setBusy);
  const [draft, setDraft] = useState<InfoData>(() => structuredClone(doc.info));
  const [kwInput, setKwInput] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [savedFlash, setSavedFlash] = useState(0);

  useEffect(() => {
    setDraft(structuredClone(doc.info));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, doc.history.length]);

  const locked = doc.locked && !doc.locked.unlocked;
  const isLocked = (f: string) => !!locked && doc.locked!.fields.includes(f);
  const set = <K extends keyof InfoData>(k: K, v: InfoData[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(doc.info);

  const save = () => {
    if (!dirty) { toast("Nothing to commit — metadata unchanged", "info"); return; }
    saveInfo(doc.id, { ...draft, modified: new Date().toISOString() }, "Smart-form save");
    setSavedFlash((n) => n + 1);
    toast("Metadata committed to Info + XMP engines", "ok");
  };
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  });

  const runAi = async () => {
    setAiBusy(true); setBusy("Local LLM reading document text…");
    await new Promise((r) => setTimeout(r, 1300));
    const g = aiGenerate(doc);
    setDraft((d) => ({ ...d, title: g.title, subject: g.subject, keywords: g.keywords }));
    setBusy(null); setAiBusy(false); setAiOpen(true);
    toast("AI draft ready — review before saving", "info");
  };

  const addKw = () => {
    const v = kwInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (v && !draft.keywords.includes(v)) set("keywords", [...draft.keywords, v]);
    setKwInput("");
  };

  const ai = aiOpen ? aiGenerate(doc) : null;

  return (
    <div className="space-y-4">
      <div className="neu neu-flat rounded-[14px] p-4">
        <SectionHead
          icon={<IconSpark size={16} />} title="Smart form" sub="Auto-validated fields written to both engines on save"
          right={
            <div className="flex items-center gap-2">
              {locked && (
                <button className="neu-btn flex items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-[11px] font-bold text-[var(--warn)]" onClick={() => { setPw(""); setPwOpen(true); }}>
                  <IconUnlock size={12} /> Unlock fields
                </button>
              )}
              <button className="neu-btn flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[11.5px] font-bold text-[var(--accent)]" onClick={runAi} disabled={aiBusy}>
                <IconSpark size={13} /> {aiBusy ? "Generating…" : "AI assist"}
              </button>
            </div>
          }
        />
        <AnimatePresence>
          {ai && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="neu-inset mb-3 rounded-[11px] p-3">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--accent)]">Local model suggestion · nothing left this device</p>
                <p className="mt-1 text-[12px] italic leading-relaxed text-[var(--ink-soft)]">{ai.summary}</p>
                <button className="mt-1.5 text-[11px] font-bold text-[var(--ink-faint)] underline-offset-2 hover:underline" onClick={() => setAiOpen(false)}>dismiss</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Title" hint={`${draft.title.length}/120`}
              right={isLocked("title") ? <Chip tone="warn"><IconLock size={9} />sealed</Chip> : undefined}>
              <input className={inputCls} maxLength={120} value={isLocked("title") ? "••••••••••" : draft.title} disabled={isLocked("title")}
                onChange={(e) => set("title", e.target.value)} placeholder="Document title" />
            </Field>
          </div>
          <Field label="Author" right={isLocked("author") ? <Chip tone="warn"><IconLock size={9} />sealed</Chip> : undefined}>
            <input className={inputCls} value={isLocked("author") ? "••••••••" : draft.author} disabled={isLocked("author")} onChange={(e) => set("author", e.target.value)} />
          </Field>
          <Field label="Subject">
            <input className={inputCls} value={draft.subject} onChange={(e) => set("subject", e.target.value)} />
          </Field>
          <Field label="Creator application">
            <input className={inputCls} value={draft.creator} onChange={(e) => set("creator", e.target.value)} />
          </Field>
          <Field label="Producer" hint={draft.producer ? "software fingerprint" : undefined}>
            <input className={inputCls} value={draft.producer} onChange={(e) => set("producer", e.target.value)} />
          </Field>
          <Field label="Created">
            <input type="date" className={inputCls} value={draft.created.slice(0, 10)} onChange={(e) => e.target.value && set("created", new Date(e.target.value).toISOString())} />
          </Field>
          <Field label="Modified">
            <input type="date" className={inputCls} value={draft.modified.slice(0, 10)} onChange={(e) => e.target.value && set("modified", new Date(e.target.value).toISOString())} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Keywords" hint="enter ↵ to add">
              <div className="neu-input flex flex-wrap items-center gap-1.5 rounded-[10px] p-2">
                <AnimatePresence>
                  {draft.keywords.map((k) => (
                    <motion.span key={k} layout initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                      className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-soft)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--accent)]">
                      {k}
                      <button aria-label={`Remove keyword ${k}`} onClick={() => set("keywords", draft.keywords.filter((x) => x !== k))} className="opacity-60 hover:opacity-100"><IconX size={10} /></button>
                    </motion.span>
                  ))}
                </AnimatePresence>
                <input
                  value={kwInput} onChange={(e) => setKwInput(e.target.value)} disabled={isLocked("keywords")}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addKw(); } }}
                  onBlur={addKw} placeholder={draft.keywords.length ? "" : "add keyword…"}
                  className="min-w-[90px] flex-1 bg-transparent text-[12px] font-medium outline-none placeholder:text-[var(--ink-faint)]"
                />
              </div>
            </Field>
          </div>
        </div>

        {/* custom pairs */}
        <div className="mt-3.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">Custom schema · metaforge:*</span>
            <button className="neu-btn flex items-center gap-1 rounded-[8px] px-2 py-1 text-[10.5px] font-bold text-[var(--accent)]"
              onClick={() => set("custom", [...draft.custom, ["NewKey", ""]])}>
              <IconPlus size={11} /> Add pair
            </button>
          </div>
          {draft.custom.length === 0 && <p className="rounded-[9px] border border-dashed border-[var(--line)] p-2.5 text-center text-[11px] text-[var(--ink-faint)]">No custom keys — add confidentiality flags, matter IDs, DOI…</p>}
          <div className="space-y-2">
            {draft.custom.map(([k, v], i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={`${inputCls} !w-[38%] font-mono !text-[12px]`} value={k}
                  onChange={(e) => set("custom", draft.custom.map((c, j) => (j === i ? [e.target.value, c[1]] as [string, string] : c)))} />
                <input className={`${inputCls} flex-1 font-mono !text-[12px]`} value={v}
                  onChange={(e) => set("custom", draft.custom.map((c, j) => (j === i ? [c[0], e.target.value] as [string, string] : c)))} />
                <button className="neu-btn rounded-[8px] p-1.5 text-[var(--danger)]" aria-label="Remove custom field"
                  onClick={() => set("custom", draft.custom.filter((_, j) => j !== i))}><IconTrash size={13} /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 border-t border-[var(--line)] pt-3.5">
          <button className="neu-btn neu-btn-primary relative flex items-center gap-2 rounded-[11px] px-5 py-2.5 text-[13px] font-bold" onClick={save}>
            <AnimatePresence>
              {savedFlash > 0 && (
                <motion.span key={savedFlash} initial={{ scale: 0.4, opacity: 0.9 }} animate={{ scale: 2.2, opacity: 0 }} transition={{ duration: 0.7 }}
                  className="pointer-events-none absolute inset-0 rounded-[11px] border-2 border-[var(--accent)]" />
              )}
            </AnimatePresence>
            <IconCheck size={15} /> Commit metadata
          </button>
          <Kbd>⌘S</Kbd>
          <span className="text-[11px] text-[var(--ink-faint)]">{dirty ? "unsaved changes" : "in sync with document"}</span>
        </div>
      </div>

      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="Unlock sealed fields" width={380}>
        <p className="mb-3 text-[12.5px] text-[var(--ink-soft)]">These fields were encrypted with a field-level password. Enter it to reveal and edit.</p>
        <input type="password" autoFocus className={inputCls} placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (unlockDoc(doc.id, pw) ? (setPwOpen(false), toast("Fields unsealed", "ok")) : toast("Wrong password — fields stay sealed", "danger"))} />
        <div className="mt-4 flex justify-end gap-2">
          <button className="neu-btn rounded-[9px] px-3.5 py-2 text-[12px] font-bold text-[var(--ink-soft)]" onClick={() => setPwOpen(false)}>Cancel</button>
          <button className="neu-btn neu-btn-primary rounded-[9px] px-3.5 py-2 text-[12px] font-bold"
            onClick={() => (unlockDoc(doc.id, pw) ? (setPwOpen(false), toast("Fields unsealed", "ok")) : toast("Wrong password — fields stay sealed", "danger"))}>
            Unlock
          </button>
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════ Workbench shell ═══════════ */
export function Workbench() {
  const docs = useStore((s) => s.docs);
  const selectedId = useStore((s) => s.selectedId);
  const active = docs.find((d) => d.id === selectedId) ?? null;
  const [tab, setTab] = useState<"edit" | "xmp" | "history">("edit");
  const addFiles = useStore((s) => s.addFiles);

  useEffect(() => { const first = useStore.getState().docs[0]; if (!selectedId && first) useStore.getState().select(first.id); }, [selectedId]);

  return (
    <div className="anim-rise flex h-full min-h-0 gap-5">
      <FileRail />
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto pb-2 pr-1">
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5">
            <motion.span animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="neu-flat flex h-20 w-20 items-center justify-center rounded-[24px] text-[var(--accent)]">
              <IconFile size={36} />
            </motion.span>
            <div className="text-center">
              <h2 className="font-display text-xl font-bold">The forge is cold</h2>
              <p className="mt-1 text-[13px] text-[var(--ink-faint)]">Drop a PDF to light it up — the dual engine scans Info + XMP on contact.</p>
            </div>
            <div className="w-full max-w-md">
              <Dropzone onFiles={(fs) => addFiles(fs.map((f) => ({ name: f.name, size: f.size })))} />
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate font-display text-[19px] font-bold leading-tight">{active.name}</h1>
                <p className="text-[11.5px] text-[var(--ink-faint)]">
                  {fmtBytes(active.sizeBytes)} · PDF {active.version} · {active.pages} pages · {active.linearized ? "linearized" : "not linearized"} · domain “{active.domain}”
                </p>
              </div>
              <Seg value={tab} onChange={setTab} options={[
                { id: "edit", label: <span className="flex items-center gap-1.5"><IconEye size={13} />Edit</span> },
                { id: "xmp", label: <span className="flex items-center gap-1.5"><IconTerminal size={13} />XMP</span> },
                { id: "history", label: <span className="flex items-center gap-1.5"><IconHistory size={13} />History</span> },
              ]} />
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={tab + active.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                {tab === "edit" && (
                  <div className="space-y-4">
                    <SmartForm doc={active} />
                    <MetadataTree doc={active} />
                    <HiddenData doc={active} />
                  </div>
                )}
                {tab === "xmp" && <XmpEditor doc={active} />}
                {tab === "history" && <HistoryPanel doc={active} />}
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </div>
      {active && <PreviewPane doc={active} />}
    </div>
  );
}
