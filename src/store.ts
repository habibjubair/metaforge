import { create } from "zustand";
import {
  AuditEntry, Finding, HistoryEntry, InfoData, MalwareHit, PdfDoc, Permissions, PrintMode,
  SAMPLE_DOCS, Template, ThemeMode, Tier, Toast, View,
  buildXmp, cryptoNoise, exposureOf, hashStr, makeDoc, projectSize, sha256, sid,
} from "./lib/engine";

const clone = <T,>(x: T): T => structuredClone(x);

function patchDoc(docs: PdfDoc[], id: string, fn: (d: PdfDoc) => void): PdfDoc[] {
  return docs.map((d) => {
    if (d.id !== id) return d;
    const c = clone(d);
    fn(c);
    return c;
  });
}

interface State {
  docs: PdfDoc[];
  selectedId: string | null;
  view: View;
  theme: ThemeMode;
  toasts: Toast[];
  audit: AuditEntry[];
  redactMode: boolean;
  busy: string | null;
  select: (id: string | null) => void;
  setView: (v: View) => void;
  setTheme: (t: ThemeMode) => void;
  setRedactMode: (b: boolean) => void;
  toast: (msg: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: string) => void;
  setBusy: (s: string | null) => void;
  addFiles: (files: { name: string; size: number }[]) => void;
  removeDoc: (id: string) => void;
  saveInfo: (id: string, info: InfoData, label?: string) => void;
  wipeFindings: (id: string, ids: string[]) => void;
  nuke: (id: string) => void;
  flatten: (id: string) => void;
  setPerm: (id: string, key: keyof Permissions, value: boolean | PrintMode) => void;
  sign: (id: string, signer: string, hash: string) => void;
  lockFields: (id: string, fields: string[], pwHash: number) => void;
  unlockDoc: (id: string, pw: string) => boolean;
  relockDoc: (id: string) => void;
  removeMalware: (id: string, hitId: string) => void;
  markScanned: (id: string, hits: MalwareHit[]) => void;
  compress: (id: string, tier: Tier) => void;
  applyTemplate: (id: string, tpl: Template) => void;
  rollback: (id: string, entry: HistoryEntry) => void;
  applyRow: (name: string, row: Partial<InfoData>) => boolean;
}

interface Actions {
  pushAudit: (doc: string, action: string, detail: string, kind: AuditEntry["kind"]) => void;
}

let auditChain = { prev: "GENESIS-0000" };

export const useStore = create<State & Actions>()((set, get) => ({
  docs: SAMPLE_DOCS.map(([n, s], i) => makeDoc(n, s, i * 7)),
  selectedId: null,
  view: "forge",
  theme: "light",
  toasts: [],
  audit: [],
  redactMode: false,
  busy: null,

  select: (id) => set({ selectedId: id }),
  setView: (v) => set({ view: v }),
  setTheme: (t) => set({ theme: t }),
  setRedactMode: (b) => set({ redactMode: b }),
  setBusy: (s) => set({ busy: s }),

  toast: (msg, kind = "ok") => {
    const id = sid();
    set((st) => ({ toasts: [...st.toasts.slice(-3), { id, msg, kind }] }));
    setTimeout(() => get().dismissToast(id), 4200);
  },
  dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),

  pushAudit: (doc, action, detail, kind) => {
    const entry: AuditEntry = {
      id: sid(), at: Date.now(), doc, action, detail, kind,
      prev: auditChain.prev, hash: "",
    };
    entry.hash = hashStr(entry.prev + action + detail + entry.at).toString(16).padStart(8, "0");
    auditChain = { prev: entry.hash };
    set((st) => ({ audit: [entry, ...st.audit].slice(0, 200) }));
  },

  addFiles: (files) => {
    const fresh = files
      .filter((f) => /\.pdf$/i.test(f.name))
      .map((f, i) => makeDoc(f.name, Math.max(f.size, 40_000), hashStr(f.name) + i));
    if (!fresh.length) return;
    set((st) => ({ docs: [...st.docs, ...fresh], selectedId: fresh[0].id }));
    get().pushAudit(fresh.length === 1 ? fresh[0].name : `${fresh.length} files`, "Import", `Dual-engine scan of ${fresh.length} PDF(s) completed`, "system");
    get().toast(`${fresh.length} PDF${fresh.length > 1 ? "s" : ""} imported & scanned`, "ok");
  },
  removeDoc: (id) =>
    set((st) => ({
      docs: st.docs.filter((d) => d.id !== id),
      selectedId: st.selectedId === id ? (st.docs.find((d) => d.id !== id)?.id ?? null) : st.selectedId,
    })),

  saveInfo: (id, info, label = "Metadata edited") => {
    const doc = get().docs.find((d) => d.id === id);
    if (!doc) return;
    const entry: HistoryEntry = { id: sid(), at: Date.now(), label, snapshot: clone(doc.info) };
    set((st) => ({ docs: patchDoc(st.docs, id, (d) => { d.info = clone(info); d.history = [...d.history, entry].slice(-30); }) }));
    get().pushAudit(doc.name, "Update", label, "edit");
  },

  wipeFindings: (id, ids) => {
    const doc = get().docs.find((d) => d.id === id);
    if (!doc) return;
    const redact = get().redactMode;
    const wiped = doc.findings.filter((f) => ids.includes(f.id) && !f.resolved);
    set((st) => ({
      docs: patchDoc(st.docs, id, (d) => {
        d.findings = d.findings.map((f) => (ids.includes(f.id) ? { ...f, resolved: true, redacted: redact ? cryptoNoise(48) : undefined } : f));
      }),
    }));
    wiped.forEach((f) =>
      get().pushAudit(doc.name, redact ? "Redact" : "Wipe", `${f.label} — ${redact ? "overwritten with cryptographic noise" : "tag removed"}`, "wipe")
    );
  },

  nuke: (id) => {
    const doc = get().docs.find((d) => d.id === id);
    if (!doc) return;
    const entry: HistoryEntry = { id: sid(), at: Date.now(), label: "Full sanitization (NUKE)", snapshot: clone(doc.info) };
    set((st) => ({
      docs: patchDoc(st.docs, id, (d) => {
        d.history = [...d.history, entry].slice(-30);
        d.info = { title: "", author: "", subject: "", keywords: [], creator: "MetaForge PDF", producer: "MetaForge PDF", created: d.info.created, modified: new Date().toISOString(), custom: [] };
        d.findings = d.findings.map((f) => ({ ...f, resolved: true, redacted: get().redactMode ? cryptoNoise(48) : f.redacted }));
        d.signature = undefined;
        d.flattened = true;
      }),
    }));
    get().pushAudit(doc.name, "NUKE", "All metadata stripped — document returned to anonymous state", "wipe");
  },

  flatten: (id) => {
    const doc = get().docs.find((d) => d.id === id);
    if (!doc || doc.flattened) return;
    set((st) => ({
      docs: patchDoc(st.docs, id, (d) => {
        d.flattened = true;
        d.findings = d.findings.map((f) => (f.kind === "jsAction" || f.kind === "launch" ? { ...f, resolved: true } : f));
      }),
    }));
    get().pushAudit(doc.name, "Flatten", "Hidden form data + JS actions flattened out", "wipe");
  },

  setPerm: (id, key, value) => {
    const doc = get().docs.find((d) => d.id === id);
    if (!doc) return;
    set((st) => ({ docs: patchDoc(st.docs, id, (d) => { (d.permissions as any)[key] = value; }) }));
    get().pushAudit(doc.name, "Permissions", `${String(key)} → ${String(value)}`, "security");
  },

  sign: (id, signer, hash) => {
    const doc = get().docs.find((d) => d.id === id);
    if (!doc) return;
    set((st) => ({ docs: patchDoc(st.docs, id, (d) => { d.signature = { hash, signer, at: Date.now() }; }) }));
    get().pushAudit(doc.name, "Sign", `Metadata block signed by ${signer} · SHA-256 ${hash.slice(0, 16)}…`, "security");
  },

  lockFields: (id, fields, pwHash) => {
    const doc = get().docs.find((d) => d.id === id);
    if (!doc) return;
    set((st) => ({ docs: patchDoc(st.docs, id, (d) => { d.locked = { fields, pwHash, unlocked: false }; }) }));
    get().pushAudit(doc.name, "Encrypt", `Fields [${fields.join(", ")}] sealed behind password`, "security");
  },
  unlockDoc: (id, pw) => {
    const doc = get().docs.find((d) => d.id === id);
    if (!doc?.locked) return true;
    if (hashStr(pw) !== doc.locked.pwHash) return false;
    set((st) => ({ docs: patchDoc(st.docs, id, (d) => { if (d.locked) d.locked.unlocked = true; }) }));
    get().pushAudit(doc.name, "Unlock", "Protected metadata fields revealed", "security");
    return true;
  },
  relockDoc: (id) =>
    set((st) => ({ docs: patchDoc(st.docs, id, (d) => { if (d.locked) d.locked.unlocked = false; }) })),

  removeMalware: (id, hitId) => {
    const doc = get().docs.find((d) => d.id === id);
    if (!doc) return;
    set((st) => ({ docs: patchDoc(st.docs, id, (d) => { d.malware = d.malware.map((m) => (m.id === hitId ? { ...m, removed: true } : m)); }) }));
    const hit = doc.malware.find((m) => m.id === hitId);
    get().pushAudit(doc.name, "Quarantine", `${hit?.label ?? "payload"} removed from action dictionary`, "security");
  },
  markScanned: (id, hits) =>
    set((st) => ({ docs: patchDoc(st.docs, id, (d) => { d.malwareScanned = true; d.malware = hits; }) })),

  compress: (id, tier) => {
    const doc = get().docs.find((d) => d.id === id);
    if (!doc) return;
    const after = projectSize(doc, tier);
    set((st) => ({
      docs: patchDoc(st.docs, id, (d) => { d.compressed = { tier, before: d.sizeBytes, after, at: Date.now() }; d.sizeBytes = after; }),
    }));
    get().pushAudit(doc.name, "Compress", `${tier.toUpperCase()} tier → saved ${Math.round((1 - after / doc.sizeBytes) * 100)}%`, "compress");
  },

  applyTemplate: (id, tpl) => {
    const doc = get().docs.find((d) => d.id === id);
    if (!doc) return;
    const entry: HistoryEntry = { id: sid(), at: Date.now(), label: `Template "${tpl.name}" applied`, snapshot: clone(doc.info) };
    set((st) => ({
      docs: patchDoc(st.docs, id, (d) => {
        d.history = [...d.history, entry].slice(-30);
        d.info = { ...d.info, ...tpl.info, keywords: tpl.info.keywords ? [...tpl.info.keywords] : d.info.keywords, custom: tpl.info.custom ? (tpl.info.custom.map((c) => [...c] as [string, string])) : d.info.custom };
        d.permissions = { ...d.permissions, ...tpl.permissions };
      }),
    }));
    get().pushAudit(doc.name, "Template", `"${tpl.name}" metadata + permission preset applied`, "edit");
  },

  rollback: (id, entry) => {
    const doc = get().docs.find((d) => d.id === id);
    if (!doc) return;
    const marker: HistoryEntry = { id: sid(), at: Date.now(), label: `Rolled back to "${entry.label}"`, snapshot: clone(doc.info) };
    set((st) => ({ docs: patchDoc(st.docs, id, (d) => { d.info = clone(entry.snapshot); d.history = [...d.history, marker].slice(-30); }) }));
    get().pushAudit(doc.name, "Rollback", `Metadata restored to snapshot from ${new Date(entry.at).toLocaleTimeString()}`, "edit");
  },

  applyRow: (name, row) => {
    const doc = get().docs.find((d) => d.name.toLowerCase() === name.toLowerCase());
    if (!doc) return false;
    const entry: HistoryEntry = { id: sid(), at: Date.now(), label: "CSV/JSON import", snapshot: clone(doc.info) };
    set((st) => ({
      docs: patchDoc(st.docs, doc.id, (d) => {
        d.history = [...d.history, entry].slice(-30);
        if (row.title !== undefined) d.info.title = row.title;
        if (row.author !== undefined) d.info.author = row.author;
        if (row.subject !== undefined) d.info.subject = row.subject;
        if (row.producer !== undefined) d.info.producer = row.producer;
        if (row.keywords !== undefined && row.keywords.length) d.info.keywords = row.keywords;
      }),
    }));
    return true;
  },
}));

export const useSelected = () => {
  const docs = useStore((s) => s.docs);
  const selectedId = useStore((s) => s.selectedId);
  return docs.find((d) => d.id === selectedId) ?? null;
};
export const avgExposure = (docs: PdfDoc[]) =>
  docs.length ? Math.round(docs.reduce((a, d) => a + exposureOf(d), 0) / docs.length) : 0;

export { buildXmp, sha256 };
export type { Finding };
