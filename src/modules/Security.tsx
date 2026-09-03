import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import {
  IconAlert, IconCheck, IconCopy, IconDownload, IconFingerprint, IconKey, IconLock,
  IconRadar, IconShield, IconTerminal, IconZap,
} from "../components/icons";
import { Chip, Field, SectionHead, Seg, Switch, inputCls } from "../components/ui";
import { MalwareHit, PdfDoc, PrintMode, buildXmp, delay, download, fmtAgo, fmtDate, hashStr, sha256 } from "../lib/engine";
import { useSelected, useStore } from "../store";

const PERMS: { key: keyof PdfDoc["permissions"]; label: string; desc: string }[] = [
  { key: "assembly", label: "Document assembly", desc: "Insert, delete or rotate pages" },
  { key: "copy", label: "Content copying", desc: "Extract text and images" },
  { key: "accessibility", label: "Copying for accessibility", desc: "Screen readers may parse text" },
  { key: "forms", label: "Filling of form fields", desc: "Complete interactive form elements" },
  { key: "annotate", label: "Annotations / commenting", desc: "Add, edit or delete markups and notes" },
  { key: "modify", label: "Changing the document", desc: "General structural modifications" },
];
const LOCKABLE = ["title", "author", "subject", "keywords"];

function PermissionsPanel({ doc }: { doc: PdfDoc }) {
  const setPerm = useStore((s) => s.setPerm);
  const toast = useStore((s) => s.toast);
  return (
    <div className="neu neu-flat rounded-[16px] p-4">
      <SectionHead icon={<IconShield size={16} />} title="Permissions" sub="What the end user may do with this file" />
      <div className="space-y-2.5">
        {PERMS.map((p) => {
          const on = doc.permissions[p.key] as boolean;
          return (
            <div key={p.key} className="neu-inset-soft flex items-center justify-between gap-3 rounded-[11px] px-3 py-2.5">
              <div>
                <p className="text-[12.5px] font-bold">{p.label}</p>
                <p className="text-[10.5px] text-[var(--ink-faint)]">{p.desc}</p>
              </div>
              <div className="flex items-center gap-2">
                <Chip tone={on ? "ok" : "danger"}>{on ? "Allow" : "Deny"}</Chip>
                <Switch checked={on} label={p.label} onChange={(v) => { setPerm(doc.id, p.key, v); toast(`${p.label} → ${v ? "allowed" : "denied"}`, v ? "ok" : "warn"); }} />
              </div>
            </div>
          );
        })}
        <div className="neu-inset-soft flex items-center justify-between gap-3 rounded-[11px] px-3 py-2.5">
          <div>
            <p className="text-[12.5px] font-bold">Printing</p>
            <p className="text-[10.5px] text-[var(--ink-faint)]">None, low-resolution, or high-resolution</p>
          </div>
          <Seg size="sm" value={doc.permissions.print} onChange={(v: PrintMode) => { setPerm(doc.id, "print", v); toast(`Printing → ${v}`, "info"); }}
            options={[{ id: "none" as PrintMode, label: "None" }, { id: "low" as PrintMode, label: "Low" }, { id: "high" as PrintMode, label: "High" }]} />
        </div>
      </div>
    </div>
  );
}

function ProtectionPanel({ doc }: { doc: PdfDoc }) {
  const redactMode = useStore((s) => s.redactMode);
  const setRedactMode = useStore((s) => s.setRedactMode);
  const lockFields = useStore((s) => s.lockFields);
  const relockDoc = useStore((s) => s.relockDoc);
  const sign = useStore((s) => s.sign);
  const toast = useStore((s) => s.toast);
  const setBusy = useStore((s) => s.setBusy);
  const [fields, setFields] = useState<string[]>(["author"]);
  const [pw, setPw] = useState("");
  const [signer, setSigner] = useState("");
  const [verifying, setVerifying] = useState(false);

  const doSign = async () => {
    if (!signer.trim()) { toast("Enter a signer identity first", "warn"); return; }
    setBusy("Hashing metadata block (SHA-256)…");
    const hash = await sha256(buildXmp(doc));
    await delay(600);
    sign(doc.id, signer.trim(), hash);
    setBusy(null);
    toast("Metadata block signed — hash sealed", "ok");
  };
  const verify = async () => {
    if (!doc.signature) return;
    setVerifying(true);
    setBusy("Recomputing digest of current XMP…");
    const now = await sha256(buildXmp(doc));
    await delay(700);
    setBusy(null); setVerifying(false);
    if (now === doc.signature.hash) toast("Signature verified — metadata untampered", "ok");
    else toast("MISMATCH — metadata changed since signing", "danger");
  };

  return (
    <div className="neu neu-flat rounded-[16px] p-4">
      <SectionHead icon={<IconKey size={16} />} title="Protection" sub="Redaction, field-level encryption and digital signatures" />

      <div className={`flex items-center justify-between gap-3 rounded-[11px] px-3 py-2.5 ${redactMode ? "bg-[var(--accent-soft)]" : "neu-inset-soft"}`}>
        <div>
          <p className="flex items-center gap-1.5 text-[12.5px] font-bold"><IconZap size={13} className="text-[var(--accent)]" /> Cryptographic redaction</p>
          <p className="text-[10.5px] text-[var(--ink-faint)]">Overwrite wiped blocks with noise — forensically unrecoverable</p>
        </div>
        <Switch checked={redactMode} onChange={setRedactMode} label="Cryptographic redaction" />
      </div>

      <div className="neu-inset-soft mt-3 rounded-[11px] p-3">
        <p className="flex items-center gap-1.5 text-[12px] font-bold"><IconLock size={13} className="text-[var(--warn)]" /> Password-protect fields</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {LOCKABLE.map((f) => {
            const on = fields.includes(f);
            return (
              <button key={f} onClick={() => setFields((p) => (on ? p.filter((x) => x !== f) : [...p, f]))} aria-pressed={on}
                className="rounded-md px-2 py-1 font-mono text-[10.5px] font-bold transition-all"
                style={on ? { background: "var(--warn-soft)", color: "var(--warn)" } : { background: "var(--surface)", color: "var(--ink-faint)", boxShadow: "1px 1px 3px var(--sh-d), -1px -1px 3px var(--sh-l)" }}>
                {f}
              </button>
            );
          })}
        </div>
        <div className="mt-2.5 flex gap-2">
          <input type="password" className={`${inputCls} flex-1 !py-1.5 !text-[12px]`} placeholder="Field password" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Field password" />
          <button
            className="neu-btn rounded-[9px] px-3 py-1.5 text-[11.5px] font-bold text-[var(--warn)]"
            disabled={!fields.length || pw.length < 4}
            onClick={() => { lockFields(doc.id, fields, hashStr(pw)); setPw(""); toast(`Sealed [${fields.join(", ")}] — password required to view`, "warn"); }}
          >
            Seal
          </button>
        </div>
        {doc.locked && (
          <div className="mt-2 flex items-center justify-between rounded-[8px] bg-[var(--warn-soft)] px-2.5 py-1.5">
            <span className="text-[10.5px] font-bold text-[var(--warn)]">
              {doc.locked.unlocked ? `Unsealed · [${doc.locked.fields.join(", ")}]` : `Sealed · [${doc.locked.fields.join(", ")}]`}
            </span>
            {doc.locked.unlocked && (
              <button className="text-[10.5px] font-bold text-[var(--warn)] underline-offset-2 hover:underline" onClick={() => { relockDoc(doc.id); toast("Fields re-sealed", "warn"); }}>
                re-seal
              </button>
            )}
          </div>
        )}
      </div>

      <div className="neu-inset-soft mt-3 rounded-[11px] p-3">
        <p className="flex items-center gap-1.5 text-[12px] font-bold"><IconFingerprint size={13} className="text-[var(--accent)]" /> Digital signature · SHA-256</p>
        <div className="mt-2 flex gap-2">
          <input className={`${inputCls} flex-1 !py-1.5 !text-[12px]`} placeholder="Signer identity" value={signer} onChange={(e) => setSigner(e.target.value)} aria-label="Signer identity" />
          <button className="neu-btn neu-btn-primary rounded-[9px] px-3 py-1.5 text-[11.5px] font-bold" onClick={doSign}>Sign</button>
        </div>
        {doc.signature && (
          <div className="neu-tiny mt-2.5 rounded-[9px] bg-[var(--surface)] p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[10.5px] font-bold">{doc.signature.signer}</p>
              <Chip tone="accent">{fmtAgo(doc.signature.at)}</Chip>
            </div>
            <p className="mt-1 break-all font-mono text-[9px] leading-relaxed text-[var(--ink-faint)]">{doc.signature.hash}</p>
            <div className="mt-2 flex gap-2">
              <button className="neu-btn flex flex-1 items-center justify-center gap-1 rounded-[8px] py-1.5 text-[10.5px] font-bold text-[var(--ink-soft)]"
                onClick={() => { navigator.clipboard?.writeText(doc.signature!.hash).catch(() => undefined); toast("Digest copied to clipboard", "info"); }}>
                <IconCopy size={11} /> Copy digest
              </button>
              <button className="neu-btn flex flex-1 items-center justify-center gap-1 rounded-[8px] py-1.5 text-[10.5px] font-bold text-[var(--accent)]" onClick={verify} disabled={verifying}>
                <IconCheck size={11} /> {verifying ? "Verifying…" : "Verify integrity"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MalwarePanel({ doc }: { doc: PdfDoc }) {
  const markScanned = useStore((s) => s.markScanned);
  const removeMalware = useStore((s) => s.removeMalware);
  const toast = useStore((s) => s.toast);
  const setBusy = useStore((s) => s.setBusy);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);

  const scan = async () => {
    setScanning(true); setProgress(0);
    const stages = ["Enumerating action dictionaries…", "Decoding /JS streams…", "Matching exploit signatures…", "Inspecting launch targets…"];
    for (let i = 0; i < stages.length; i++) {
      setBusy(stages[i]);
      setProgress(((i + 1) / stages.length) * 100);
      await delay(320 + Math.random() * 200);
    }
    markScanned(doc.id, doc.malware.map((m) => ({ ...m })));
    setBusy(null); setScanning(false);
    toast(doc.malware.length ? `${doc.malware.length} suspicious action${doc.malware.length > 1 ? "s" : ""} flagged` : "No malicious payloads found", doc.malware.length ? "warn" : "ok");
  };
  const active = doc.malware.filter((m) => !m.removed);

  return (
    <div className="neu neu-flat rounded-[16px] p-4">
      <SectionHead
        icon={<IconRadar size={16} />} title="Malware & script scanner" sub="JS payloads, launch actions, exploit signatures"
        right={doc.malwareScanned && active.length === 0 ? <Chip tone="ok"><IconCheck size={10} />clean</Chip> : doc.malwareScanned ? <Chip tone="danger"><IconAlert size={10} />{active.length} flagged</Chip> : <Chip tone="neutral">unscanned</Chip>}
      />
      <button className={`neu-btn neu-btn-primary relative w-full overflow-hidden rounded-[11px] py-2.5 text-[12.5px] font-bold`} onClick={scan} disabled={scanning}>
        {scanning && <span className="sweep-bar absolute inset-0" />}
        {scanning ? `Scanning… ${Math.round(progress)}%` : doc.malwareScanned ? "Re-scan document" : "Run deep scan"}
      </button>
      <div className="mt-3 space-y-2">
        <AnimatePresence>
          {doc.malwareScanned && doc.malware.length === 0 && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-[9px] bg-[var(--ok-soft)] p-2.5 text-[11.5px] font-semibold text-[var(--ok)]">
              ✓ No auto-executing scripts or known signatures detected.
            </motion.p>
          )}
          {doc.malware.map((m: MalwareHit) => (
            <motion.div key={m.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`rounded-[10px] p-2.5 ${m.removed ? "bg-[var(--ok-soft)]" : "bg-[var(--danger-soft)]"}`}>
              <div className="flex items-center justify-between gap-2">
                <p className={`font-mono text-[11px] font-bold ${m.removed ? "text-[var(--ok)]" : "text-[var(--danger)]"}`}>
                  {m.removed ? "✓ " : "⚠ "}{m.label}
                </p>
                {!m.removed && (
                  <button className="neu-btn rounded-[8px] px-2.5 py-1 text-[10.5px] font-bold text-[var(--danger)]"
                    onClick={() => { removeMalware(doc.id, m.id); toast(`${m.label} quarantined & removed`, "ok"); }}>
                    Remove
                  </button>
                )}
              </div>
              <p className={`mt-0.5 text-[10.5px] leading-relaxed ${m.removed ? "text-[var(--ok)]" : "text-[var(--ink-soft)]"}`}>{m.detail}{m.removed && " — excised from /AA + /OpenAction."}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function Security() {
  const doc = useSelected();
  const docs = useStore((s) => s.docs);
  const select = useStore((s) => s.select);
  const audit = useStore((s) => s.audit);
  const toast = useStore((s) => s.toast);
  const [auditQ, setAuditQ] = useState("");

  const rows = audit.filter((a) => (a.doc + a.action + a.detail).toLowerCase().includes(auditQ.toLowerCase()));

  if (!doc)
    return <p className="p-10 text-center text-[13px] text-[var(--ink-faint)]">The queue is empty — import PDFs in the Workbench to configure security.</p>;
  return (
    <div className="anim-rise flex h-full min-h-0 flex-col gap-4 overflow-y-auto pb-2">
      <SectionHead
        icon={<IconShield size={17} />} title="Security & permissions" sub="Restrict, encrypt, sign and audit — per document"
        right={
          <select className="neu-input rounded-[10px] px-3 py-1.5 text-[12px] font-semibold" value={doc.id} onChange={(e) => select(e.target.value)} aria-label="Document to secure">
            {docs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        }
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <PermissionsPanel doc={doc} />
        <ProtectionPanel doc={doc} />
        <MalwarePanel doc={doc} />
      </div>

      <div className="neu neu-flat rounded-[16px] p-4">
        <SectionHead
          icon={<IconTerminal size={16} />} title="Audit trail — sidecar log"
          sub="Immutable, hash-chained record of every mutation"
          right={
            <div className="flex items-center gap-2">
              <div className="neu-inset-soft flex items-center gap-2 rounded-[9px] px-2.5 py-1.5">
                <input value={auditQ} onChange={(e) => setAuditQ(e.target.value)} placeholder="Filter log…" className="w-32 bg-transparent text-[11.5px] font-medium outline-none placeholder:text-[var(--ink-faint)]" aria-label="Filter audit log" />
              </div>
              <button
                className="neu-btn flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[11px] font-bold text-[var(--ink-soft)]"
                onClick={() => {
                  download(`metaforge-audit-${Date.now()}.log`, audit.map((a) => `[${new Date(a.at).toISOString()}] ${a.doc} · ${a.action} · ${a.detail} · chain:${a.prev}→${a.hash}`).join("\n"));
                  toast("Audit log exported", "ok");
                }}
              >
                <IconDownload size={12} /> Export .log
              </button>
            </div>
          }
        />
        {rows.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-[var(--line)] p-6 text-center text-[12px] text-[var(--ink-faint)]">
            No entries yet — every save, wipe, signature and compression lands here with a chain hash.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[11.5px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">
                  <th className="pb-2 pr-3 font-bold">When</th>
                  <th className="pb-2 pr-3 font-bold">Document</th>
                  <th className="pb-2 pr-3 font-bold">Action</th>
                  <th className="pb-2 pr-3 font-bold">Detail</th>
                  <th className="pb-2 font-bold">Chain</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {rows.slice(0, 40).map((a) => (
                  <tr key={a.id} className="group">
                    <td className="tabular whitespace-nowrap py-2 pr-3 text-[var(--ink-faint)]">{fmtDate(a.at)}</td>
                    <td className="max-w-[160px] truncate py-2 pr-3 font-semibold">{a.doc}</td>
                    <td className="py-2 pr-3">
                      <Chip tone={a.kind === "wipe" ? "danger" : a.kind === "security" ? "warn" : a.kind === "compress" ? "accent" : a.kind === "import" ? "neutral" : "ok"}>{a.action}</Chip>
                    </td>
                    <td className="max-w-[280px] truncate py-2 pr-3 text-[var(--ink-soft)]">{a.detail}</td>
                    <td className="py-2 font-mono text-[9.5px] text-[var(--ink-faint)]">{a.prev.slice(0, 6)}→<span className="text-[var(--accent)]">{a.hash}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
