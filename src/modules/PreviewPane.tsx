import { motion } from "framer-motion";
import { useState } from "react";
import { IconEye, IconFile, IconLock } from "../components/icons";
import { Chip, Seg } from "../components/ui";
import { PdfDoc, exposureOf, fmtBytes, fmtDate, riskLabel, riskTone } from "../lib/engine";

const PERM_LABELS: [keyof PdfDoc["permissions"], string][] = [
  ["assembly", "Document assembly"],
  ["copy", "Content copying"],
  ["accessibility", "Copying for accessibility"],
  ["forms", "Filling form fields"],
  ["annotate", "Annotations & commenting"],
  ["modify", "Changing the document"],
];

function PageView({ doc }: { doc: PdfDoc }) {
  const i = doc.info;
  return (
    <div className="neu-inset flex flex-1 items-start justify-center overflow-auto rounded-[12px] p-5">
      <motion.div
        key={doc.id} initial={{ opacity: 0, y: 10, rotateX: 6 }} animate={{ opacity: 1, y: 0, rotateX: 0 }}
        className="w-full max-w-[300px] shrink-0 rounded-[4px] bg-[var(--page)] p-5 text-[#333a42]"
        style={{ boxShadow: "0 14px 34px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.14)", aspectRatio: "3/4" }}
      >
        <div className="mb-3 flex items-center justify-between border-b border-[#d4d9de] pb-2">
          <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
          <span className="font-mono text-[7px] uppercase tracking-widest text-[#9aa2ab]">{doc.domain} · pdf {doc.version}</span>
        </div>
        <p className="font-display text-[12.5px] font-bold leading-snug text-[#232a31]">{i.title || "Untitled document"}</p>
        <p className="mt-1 text-[8.5px] font-semibold text-[#7a828c]">{i.author || "Unknown author"} — {fmtDate(i.created).split(",")[0]}</p>
        <div className="mt-3 space-y-1.5">
          {[92, 100, 97, 88, 100, 74].map((w, k) => (
            <div key={k} className="h-[4.5px] rounded-full bg-[#e2e6ea]" style={{ width: `${w}%` }} />
          ))}
        </div>
        {doc.domain === "invoice" && (
          <div className="mt-3 grid grid-cols-3 gap-1">
            {[...Array(6)].map((_, k) => <div key={k} className="h-4 rounded-[3px] bg-[#eef1f3]" />)}
          </div>
        )}
        {i.keywords.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {i.keywords.slice(0, 5).map((k) => (
              <span key={k} className="rounded-[3px] bg-[#e8edf0] px-1 py-0.5 font-mono text-[6.5px] font-semibold text-[#5b646e]">{k}</span>
            ))}
          </div>
        )}
        <div className="mt-3 space-y-1.5">
          {[100, 95, 90, 98, 62].map((w, k) => (
            <div key={k} className="h-[4.5px] rounded-full bg-[#e2e6ea]" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between font-mono text-[7px] text-[#aab1b9]">
          <span>metaforge preview</span><span>1 / {doc.pages}</span>
        </div>
      </motion.div>
    </div>
  );
}

function PropsView({ doc }: { doc: PdfDoc }) {
  const i = doc.info;
  const p = doc.permissions;
  const ex = exposureOf(doc);
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex items-baseline justify-between gap-3 py-[5px] text-[11.5px]">
      <span className="shrink-0 text-[var(--ink-faint)]">{k}</span>
      <span className="min-w-0 truncate text-right font-semibold">{v || <em className="font-normal text-[var(--ink-faint)]">—</em>}</span>
    </div>
  );
  return (
    <div className="neu-inset flex-1 overflow-y-auto rounded-[12px] p-4">
      <p className="mb-2 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
        <IconFile size={12} /> Document properties — live
      </p>
      <div className="divide-y divide-[var(--line)]">
        <Row k="Title" v={i.title} />
        <Row k="Author" v={i.author} />
        <Row k="Subject" v={i.subject} />
        <Row k="Keywords" v={i.keywords.join("; ")} />
        <Row k="Producer" v={i.producer} />
        <Row k="Created" v={fmtDate(i.created)} />
        <Row k="Modified" v={fmtDate(i.modified)} />
        <Row k="PDF version" v={doc.version} />
        <Row k="Pages" v={doc.pages} />
        <Row k="File size" v={fmtBytes(doc.sizeBytes)} />
        <Row k="Fast web view" v={doc.linearized ? "Yes (linearized)" : "No"} />
        <Row k="Exposure" v={<span style={{ color: riskTone(ex) === "ok" ? "var(--ok)" : riskTone(ex) === "warn" ? "var(--warn)" : "var(--danger)" }}>{ex}/100 · {riskLabel(ex)}</span>} />
      </div>
      <p className="mb-1.5 mt-4 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">Security summary</p>
      <div className="space-y-1">
        {PERM_LABELS.map(([k, label]) => (
          <div key={k} className="flex items-center justify-between text-[11.5px]">
            <span className="text-[var(--ink-faint)]">{label}</span>
            <Chip tone={(p[k] as boolean) ? "ok" : "danger"}>{(p[k] as boolean) ? "Allowed" : "Denied"}</Chip>
          </div>
        ))}
        <div className="flex items-center justify-between text-[11.5px]">
          <span className="text-[var(--ink-faint)]">Printing</span>
          <Chip tone={p.print === "none" ? "danger" : p.print === "low" ? "warn" : "ok"}>
            {p.print === "none" ? "Not allowed" : p.print === "low" ? "Low resolution" : "High resolution"}
          </Chip>
        </div>
      </div>
      {doc.signature && (
        <div className="neu-tiny mt-4 rounded-[10px] p-2.5">
          <p className="flex items-center gap-1.5 text-[10.5px] font-bold text-[var(--accent)]"><IconLock size={11} /> Signed by {doc.signature.signer}</p>
          <p className="mt-1 break-all font-mono text-[9px] leading-relaxed text-[var(--ink-faint)]">{doc.signature.hash}</p>
        </div>
      )}
    </div>
  );
}

export function PreviewPane({ doc }: { doc: PdfDoc }) {
  const [mode, setMode] = useState<"page" | "props">("page");
  return (
    <aside className="hidden w-[318px] shrink-0 flex-col gap-3 xl:flex">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-soft)]">
          <IconEye size={13} className="text-[var(--accent)]" /> Live preview
        </p>
        <Seg size="sm" value={mode} onChange={setMode} options={[{ id: "page", label: "Page" }, { id: "props", label: "Properties" }]} />
      </div>
      {mode === "page" ? <PageView doc={doc} /> : <PropsView doc={doc} />}
      <p className="text-center font-mono text-[9.5px] text-[var(--ink-faint)]">end-user view · updates as you type</p>
    </aside>
  );
}
