import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { IconCheck, IconMap, IconRadar } from "../components/icons";
import { Chip, SectionHead } from "../components/ui";
import { Finding, PdfDoc, exposureOf, riskLabel, riskTone } from "../lib/engine";
import { useSelected, useStore } from "../store";

interface GNode {
  id: string; label: string; depth: number; parent?: string;
  finding?: Finding; children: string[]; y: number; x: number;
}
const PARENT_OF: Record<string, string> = {
  gps: "res", serial: "res", thumbnail: "res", attachment: "res",
  email: "xmp", phone: "xmp", history: "xmp",
  hiddenText: "pages", tracked: "pages", jsAction: "pages", launch: "pages",
  producer: "info",
};
const KIND_LABEL: Record<string, string> = {
  gps: "exif geolocation", serial: "hardware identity", thumbnail: "preview bitmap", attachment: "embedded payload",
  email: "personal identity", phone: "contact data", history: "revision trail", hiddenText: "invisible text",
  tracked: "incremental update", jsAction: "script payload", launch: "launch action", producer: "tool fingerprint",
};

function buildGraph(doc: PdfDoc): GNode[] {
  const nodes: GNode[] = [];
  const add = (id: string, label: string, depth: number, parent?: string, finding?: Finding) =>
    nodes.push({ id, label, depth, parent, finding, children: [], x: 0, y: 0 });
  add("root", doc.name.length > 20 ? doc.name.slice(0, 19) + "…" : doc.name, 0);
  add("info", "Info Dictionary", 1, "root");
  add("xmp", "XMP Packet", 1, "root");
  add("pages", "Page Tree", 1, "root");
  add("res", "Resources", 1, "root");
  add("title", "dc:title", 2, "info");
  add("author", "dc:creator", 2, "info");
  add("kw", `dc:subject · ${doc.info.keywords.length} kw`, 2, "xmp");
  add("dates", "xmp:dates", 2, "xmp");
  add("fonts", "Font objects", 2, "res");
  add("imgs", "Embedded images", 2, "res");
  doc.findings.forEach((f) => add(`f-${f.id}`, f.label, 2, PARENT_OF[f.kind] ?? "xmp", f));
  nodes.forEach((n) => { if (n.parent) nodes.find((p) => p.id === n.parent)?.children.push(n.id); });

  const depths = [0, 1, 2].map((d) => nodes.filter((n) => n.depth === d));
  const H = Math.max(430, depths[2].length * 42 + 90);
  const X = [26, 268, 520];
  depths.forEach((col, d) => {
    if (d === 0) { col.forEach((n) => { n.x = X[0]; n.y = H / 2 - 19; }); return; }
    if (d === 1) {
      const gap = (H - 60) / (col.length - 1 || 1);
      col.forEach((n, i) => { n.x = X[1]; n.y = 30 + i * gap; });
      return;
    }
    // depth 2: stack children beneath each parent, risks float to bottom of parent group
    const byParent = new Map<string, GNode[]>();
    col.forEach((n) => byParent.set(n.parent!, [...(byParent.get(n.parent!) ?? []), n]));
    let cursor = 26;
    byParent.forEach((kids) => {
      const safe = kids.filter((k) => !k.finding);
      const risky = kids.filter((k) => k.finding);
      [...safe, ...risky].forEach((n) => { n.x = X[2]; n.y = cursor; cursor += 41; });
      cursor += 8;
    });
  });
  return nodes;
}

const W = 196, HGT = 34;

export function RiskMap() {
  const doc = useSelected();
  const docs = useStore((s) => s.docs);
  const select = useStore((s) => s.select);
  const wipeFindings = useStore((s) => s.wipeFindings);
  const toast = useStore((s) => s.toast);
  const [selNode, setSelNode] = useState<string | null>(null);

  const nodes = useMemo(() => (doc ? buildGraph(doc) : []), [doc]);
  const maxY = nodes.reduce((a, n) => Math.max(a, n.y), 0);
  const viewH = maxY + 70;
  const selected = nodes.find((n) => n.id === selNode) ?? null;
  const ex = doc ? exposureOf(doc) : 0;

  if (!doc) return <p className="p-10 text-center text-[13px] text-[var(--ink-faint)]">Select a document in the Workbench to map its metadata graph.</p>;

  return (
    <div className="anim-rise flex h-full min-h-0 flex-col gap-4 overflow-y-auto pb-2">
      <SectionHead
        icon={<IconMap size={17} />} title="Visual metadata map" sub={`${doc.name} — how every datum hangs off the document root`}
        right={
          <div className="flex items-center gap-2">
            <select
              className="neu-input rounded-[10px] px-3 py-1.5 text-[12px] font-semibold" value={doc.id} aria-label="Choose document to map"
              onChange={(e) => { select(e.target.value); setSelNode(null); }}
            >
              {docs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <Chip tone={riskTone(ex) === "ok" ? "ok" : riskTone(ex) === "warn" ? "warn" : "danger"}>{ex}/100 · {riskLabel(ex)}</Chip>
          </div>
        }
      />
      <div className="neu neu-flat relative min-h-0 flex-1 overflow-auto rounded-[16px] p-4">
        <svg viewBox={`0 0 744 ${viewH}`} className="w-full min-w-[720px]" role="img" aria-label="Metadata node graph">
          <defs>
            <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.1" fill="var(--sh-d)" opacity="0.5" />
            </pattern>
          </defs>
          <rect x="0" y="0" width="744" height={viewH} fill="url(#dots)" rx="12" />
          {/* edges */}
          {nodes.filter((n) => n.parent).map((n) => {
            const p = nodes.find((x) => x.id === n.parent)!;
            const x1 = p.x + W, y1 = p.y + HGT / 2, x2 = n.x, y2 = n.y + HGT / 2;
            const risk = !!n.finding && !n.finding.resolved;
            const resolved = !!n.finding?.resolved;
            return (
              <path
                key={`e-${n.id}`}
                d={`M ${x1} ${y1} C ${x1 + 46} ${y1}, ${x2 - 46} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={risk ? "var(--danger)" : resolved ? "var(--ok)" : "var(--line)"}
                strokeWidth={risk ? 2 : 1.4}
                strokeDasharray={risk ? "5 6" : undefined}
                opacity={risk ? 0.9 : 0.85}
                style={risk ? { animation: "dashflow 0.9s linear infinite" } : undefined}
              />
            );
          })}
          {/* nodes */}
          {nodes.map((n) => {
            const risk = !!n.finding && !n.finding.resolved;
            const resolved = !!n.finding?.resolved;
            const isSel = selNode === n.id;
            const fill = n.depth === 0 ? "var(--accent)" : risk ? "var(--danger-soft)" : resolved ? "var(--ok-soft)" : "var(--surface-2)";
            const fg = n.depth === 0 ? "var(--accent-ink)" : risk ? "var(--danger)" : resolved ? "var(--ok)" : "var(--ink)";
            return (
              <g key={n.id} transform={`translate(${n.x},${n.y})`} className="cursor-pointer" onClick={() => setSelNode(n.id)}>
                <rect
                  width={W} height={HGT} rx={11} fill={fill}
                  stroke={isSel ? "var(--accent)" : risk ? "var(--danger)" : "var(--line)"}
                  strokeWidth={isSel || risk ? 1.8 : 1}
                  style={{ filter: isSel ? "drop-shadow(0 4px 10px var(--glow))" : undefined, transition: "all .25s" }}
                />
                <circle
                  cx={16} cy={HGT / 2} r={4}
                  fill={risk ? "var(--danger)" : resolved ? "var(--ok)" : n.depth === 0 ? "var(--accent-ink)" : "var(--accent)"}
                  className={risk ? "anim-blink" : undefined}
                />
                <text x={28} y={HGT / 2 + 4} fontSize={11} fontWeight={700} fill={fg} fontFamily="var(--font-body)">
                  {n.label.length > 24 ? n.label.slice(0, 23) + "…" : n.label}
                </text>
                {n.finding && (
                  <text x={W - 12} y={HGT / 2 + 3.5} fontSize={9.5} fontWeight={800} fill={risk ? "var(--danger)" : "var(--ok)"} textAnchor="end" fontFamily="var(--font-mono)">
                    {risk ? `+${n.finding.weight}` : "✓"}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
        <div className="neu neu-flat flex items-center gap-4 rounded-[13px] px-4 py-3 text-[11px] text-[var(--ink-soft)]">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" /> structural node</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--danger)]" /> exposure leak</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--ok)]" /> resolved</span>
          <span className="hidden items-center gap-1.5 sm:flex"><IconRadar size={13} className="text-[var(--danger)]" /> dashed = data flowing out</span>
        </div>
        <motion.div key={selected?.id ?? "none"} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="neu neu-flat rounded-[13px] p-3.5">
          {selected ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-[13px] font-bold">{selected.label}</p>
                {selected.finding ? (
                  selected.finding.resolved ? <Chip tone="ok"><IconCheck size={10} />resolved</Chip> : <Chip tone="danger">+{selected.finding.weight} exposure</Chip>
                ) : <Chip tone="neutral">structural</Chip>}
              </div>
              {selected.finding ? (
                <>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">{KIND_LABEL[selected.finding.kind] ?? selected.finding.kind}</p>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--ink-soft)]">{selected.finding.detail}</p>
                  {!selected.finding.resolved && (
                    <button
                      className="neu-btn neu-btn-primary mt-2.5 w-full rounded-[10px] py-2 text-[12px] font-bold"
                      onClick={() => { wipeFindings(doc.id, [selected.finding!.id]); toast(`“${selected.finding!.label}” resolved`, "ok"); }}
                    >
                      Resolve this leak
                    </button>
                  )}
                </>
              ) : (
                <p className="mt-1 text-[11.5px] text-[var(--ink-soft)]">Structural part of the PDF object graph — no personal data lives here directly.</p>
              )}
            </>
          ) : (
            <p className="py-1 text-center text-[11.5px] text-[var(--ink-faint)]">Click any node to inspect it — leak nodes can be resolved in place.</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
