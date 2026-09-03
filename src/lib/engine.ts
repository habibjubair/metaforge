/* MetaForge PDF — simulated Rust core (lopdf + quick-xml flavored) running client-side. */

export type ThemeMode = "light" | "dark" | "oled" | "contrast";
export type View = "forge" | "map" | "compress" | "security" | "sync";
export type PrintMode = "none" | "low" | "high";
export type Tier = "low" | "medium" | "high";

export interface InfoData {
  title: string;
  author: string;
  subject: string;
  keywords: string[];
  creator: string;
  producer: string;
  created: string; // ISO
  modified: string; // ISO
  custom: [string, string][];
}
export interface Finding {
  id: string;
  kind: string;
  label: string;
  detail: string;
  weight: number;
  resolved: boolean;
  redacted?: string; // noise snippet when cryptographically redacted
}
export interface Permissions {
  assembly: boolean;
  copy: boolean;
  accessibility: boolean;
  forms: boolean;
  annotate: boolean;
  modify: boolean;
  print: PrintMode;
}
export interface HistoryEntry {
  id: string;
  at: number;
  label: string;
  snapshot: InfoData;
}
export interface Signature {
  hash: string;
  signer: string;
  at: number;
}
export interface MalwareHit {
  id: string;
  kind: string;
  label: string;
  detail: string;
  removed: boolean;
}
export interface PdfDoc {
  id: string;
  name: string;
  sizeBytes: number;
  version: "1.4" | "1.6" | "1.7" | "2.0";
  pages: number;
  linearized: boolean;
  info: InfoData;
  findings: Finding[];
  permissions: Permissions;
  history: HistoryEntry[];
  signature?: Signature;
  locked?: { fields: string[]; pwHash: number; unlocked: boolean };
  malware: MalwareHit[];
  malwareScanned: boolean;
  compressed?: { tier: Tier; before: number; after: number; at: number };
  flattened: boolean;
  domain: Domain;
}
export type Domain = "legal" | "finance" | "resume" | "design" | "scan" | "invoice" | "general";

export interface AuditEntry {
  id: string;
  at: number;
  doc: string;
  action: string;
  detail: string;
  kind: "edit" | "wipe" | "security" | "compress" | "import" | "system";
  hash: string;
  prev: string;
}
export interface Toast {
  id: string;
  msg: string;
  kind: "ok" | "danger" | "warn" | "info";
}

/* ————— deterministic PRNG ————— */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let uid = 0;
export const sid = () => `${Date.now().toString(36)}-${(uid++).toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

/* ————— formatting ————— */
export const fmtBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};
export const fmtDate = (iso: string | number) => {
  const d = typeof iso === "number" ? new Date(iso) : new Date(iso);
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};
export const fmtAgo = (t: number) => {
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

/* ————— document factory ————— */
const AUTHORS = ["Mara Voss", "D. Okonkwo", "Lena Hartwig", "Tomas Rivera", "Priya Natarajan", "J. Whitfield"];
const PRODUCERS = ["Adobe Acrobat 24.3", "Canon imageRUNNER C3530", "Microsoft: Print to PDF", "PDFium 6420", "wkhtmltopdf 0.12.6", "Ghostscript 10.02"];
const CREATORS = ["Acrobat PDFMaker 24", "Scanner Console 3.1", "Word 16.78", "InDesign 19.0", "LaTeX via pdfTeX", "Chrome 121"];

function detectDomain(name: string): Domain {
  const n = name.toLowerCase();
  if (/(invoice|receipt|bill)/.test(n)) return "invoice";
  if (/(nda|contract|legal|agreement|terms)/.test(n)) return "legal";
  if (/(resume|cv|cover)/.test(n)) return "resume";
  if (/(report|financial|q[1-4]|audit|budget)/.test(n)) return "finance";
  if (/(spec|design|wireframe|figma|mock)/.test(n)) return "design";
  if (/(scan|survey|field|photo)/.test(n)) return "scan";
  return "general";
}
export const titleCase = (s: string) =>
  s.replace(/[_\-\.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, " ").trim();

const FINDING_LIB: Record<string, Omit<Finding, "id" | "resolved">> = {
  gps: { kind: "gps", label: "GPS coordinates", detail: "XMP exif:GPSLatitude / GPSLongitude embedded by capture device — 51.5074° N, 0.1278° W", weight: 25 },
  email: { kind: "email", label: "Personal e-mail in XMP", detail: "dc:creator contains a personal mailto identity traceable to a natural person", weight: 18 },
  phone: { kind: "phone", label: "Phone number", detail: "Custom schema xmp:Contact holds a full MSISDN number", weight: 15 },
  attachment: { kind: "attachment", label: "Embedded file attachment", detail: "Name tree /EmbeddedFiles carries an attached payload (xlsx, 214 KB)", weight: 18 },
  hiddenText: { kind: "hiddenText", label: "Hidden text layer", detail: "Text rendered with mode 3 (invisible) on page 2 — often OCR or redaction residue", weight: 15 },
  tracked: { kind: "tracked", label: "Track-changes residue", detail: "Incremental update block retains a prior revision with struck-out clauses", weight: 12 },
  thumbnail: { kind: "thumbnail", label: "Embedded thumbnail", detail: "Full-page preview bitmap stored in the document catalog", weight: 6 },
  producer: { kind: "producer", label: "Software fingerprint", detail: "Producer / CreatorTool reveal exact toolchain and build number", weight: 8 },
  serial: { kind: "serial", label: "Device serial number", detail: "Scanner device ID + firmware revision leaked via private XMP namespace", weight: 10 },
  jsAction: { kind: "jsAction", label: "Auto-run JavaScript", detail: "/OpenAction contains a JS payload executed on document open", weight: 20 },
  launch: { kind: "launch", label: "Launch action", detail: "/AA entry spawns an external binary on page open", weight: 16 },
  history: { kind: "history", label: "Edit history (XMP)", detail: "xmpMM:History retains 6 save events with machine host names", weight: 10 },
};
const F = (key: string) => ({ ...FINDING_LIB[key], id: `${key}-${sid()}`, resolved: false });

export function makeDoc(name: string, sizeBytes: number, seedBoost = 0): PdfDoc {
  const rng = mulberry(hashStr(name) + seedBoost);
  const domain = detectDomain(name);
  const created = Date.now() - rng() * 1000 * 86400 * 420 - 86400000;
  const modified = created + rng() * (Date.now() - created);
  const info: InfoData = {
    title: titleCase(name.replace(/\.pdf$/i, "")),
    author: AUTHORS[Math.floor(rng() * AUTHORS.length)],
    subject: {
      legal: "Mutual confidentiality agreement — execution copy",
      finance: "Quarterly consolidated financial statements",
      resume: "Curriculum vitae — senior applicant",
      design: "Product specification and component inventory",
      scan: "Digitized field record, batch 12",
      invoice: "Tax invoice for professional services",
      general: "Internal reference document",
    }[domain],
    keywords: {
      legal: ["nda", "confidential", "contract"],
      finance: ["quarterly", "statements"],
      resume: ["cv", "experience"],
      design: ["spec", "v7"],
      scan: ["scan", "batch-12"],
      invoice: ["invoice", "billing"],
      general: ["internal"],
    }[domain],
    creator: CREATORS[Math.floor(rng() * CREATORS.length)],
    producer: PRODUCERS[Math.floor(rng() * PRODUCERS.length)],
    created: new Date(created).toISOString(),
    modified: new Date(modified).toISOString(),
    custom:
      domain === "finance"
        ? [["Confidentiality", "Restricted"], ["CostCenter", "FIN-042"]]
        : domain === "legal"
          ? [["MatterID", "ACM-2024-118"]]
          : [],
  };
  const findings: Finding[] = [F("producer")];
  if (domain === "scan") findings.push(F("gps"), F("serial"), F("thumbnail"));
  if (domain === "resume") findings.push(F("email"), F("phone"), F("history"));
  if (domain === "finance") findings.push(F("attachment"), F("history"), rng() > 0.5 ? F("thumbnail") : F("email"));
  if (domain === "legal") findings.push(F("hiddenText"), F("tracked"));
  if (domain === "design") findings.push(F("thumbnail"), rng() > 0.4 ? F("jsAction") : F("history"));
  if (domain === "invoice" && findings.length > 1) findings.splice(1);
  const malware: MalwareHit[] = [];
  if (domain === "design" && findings.some((f) => f.kind === "jsAction"))
    malware.push({ id: sid(), kind: "js", label: "/OpenAction → JS payload", detail: "this.exportDataObject() invoked on open — data exfiltration pattern", removed: false });
  if (domain === "scan")
    malware.push({ id: sid(), kind: "launch", label: "/AA page-open Launch action", detail: "Spawns %SystemRoot%\\regedit.exe — known exploit signature CVE-2010-0188 family", removed: false });

  return {
    id: sid(),
    name,
    sizeBytes,
    version: (["1.4", "1.6", "1.7", "1.7", "2.0"] as const)[Math.floor(rng() * 5)],
    pages: domain === "invoice" ? 1 + Math.floor(rng() * 2) : 2 + Math.floor(rng() * 46),
    linearized: rng() > 0.4,
    info,
    findings,
    permissions: { assembly: true, copy: true, accessibility: true, forms: true, annotate: true, modify: true, print: "high" },
    history: [
      { id: sid(), at: created, label: "Import — initial scan", snapshot: structuredClone(info) },
    ],
    malware,
    malwareScanned: false,
    flattened: false,
    domain,
  };
}

export const SAMPLE_DOCS: [string, number][] = [
  ["NDA_AcmeCorp_2024.pdf", 482_301],
  ["Q3_Financial_Report.pdf", 3_912_558],
  ["Resume_Jordan_Ellis.pdf", 187_240],
  ["Design_Spec_v7.pdf", 8_240_913],
  ["Invoice_0042_Hartwig.pdf", 96_770],
  ["Field_Survey_Scan_12.pdf", 6_104_482],
];

/* ————— risk scoring ————— */
export const exposureOf = (d: PdfDoc) => Math.min(100, d.findings.filter((f) => !f.resolved).reduce((a, f) => a + f.weight, 0));
export const riskTone = (score: number): "ok" | "warn" | "danger" => (score <= 15 ? "ok" : score <= 45 ? "warn" : "danger");
export const riskLabel = (score: number) => (score <= 15 ? "Low exposure" : score <= 45 ? "Elevated" : "Critical leak risk");

/* ————— XMP packet builder ————— */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function buildXmp(d: PdfDoc): string {
  const i = d.info;
  const kw = i.keywords.map((k) => `            <rdf:li>${esc(k)}</rdf:li>`).join("\n");
  const custom = i.custom.map(([k, v]) => `      <metaforge:${esc(k)}>${esc(v)}</metaforge:${k}>`).join("\n");
  const findings = d.findings.filter((f) => !f.resolved && f.kind === "gps")
    .map(() => `      <exif:GPSLatitude>51,49.32N</exif:GPSLatitude>\n      <exif:GPSLongitude>0,7.67W</exif:GPSLongitude>`).join("\n");
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:xmp="http://ns.adobe.com/xap/1.0/"
        xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
        xmlns:metaforge="urn:metaforge:custom:1.0">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${esc(i.title)}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>${esc(i.author)}</rdf:li></rdf:Seq></dc:creator>
      <dc:subject><rdf:Bag>
${kw}
      </rdf:Bag></dc:subject>
      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${esc(i.subject)}</rdf:li></rdf:Alt></dc:description>
      <xmp:CreateDate>${i.created}</xmp:CreateDate>
      <xmp:ModifyDate>${i.modified}</xmp:ModifyDate>
      <xmp:CreatorTool>${esc(i.creator)}</xmp:CreatorTool>
      <pdf:Producer>${esc(i.producer)}</pdf:Producer>
${findings}${custom ? custom + "\n" : ""}    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

export function validateXmp(xml: string): { ok: boolean; error?: string } {
  const open: string[] = [];
  const re = /<\/?([a-zA-Z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const [full, name, attrs] = m;
    if (full.startsWith("<?") || full.startsWith("<!")) continue;
    if (full.startsWith("</")) {
      if (open.pop() !== name) return { ok: false, error: `Unexpected closing tag </${name}>` };
    } else if (!attrs.trim().endsWith("/") && !full.endsWith("/>")) open.push(name);
  }
  if (open.length) return { ok: false, error: `Unclosed tag <${open[open.length - 1]}>` };
  return { ok: true };
}

/* ————— crypto ————— */
export async function sha256(text: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let h = "";
    for (let r = 0; r < 8; r++) h += (hashStr(text + ":" + r) * 2654435761).toString(16).padStart(8, "0").slice(0, 8);
    return h;
  }
}
export function cryptoNoise(bytes: number): string {
  const arr = new Uint8Array(Math.min(bytes, 48));
  if (typeof globalThis.crypto?.getRandomValues === "function") crypto.getRandomValues(arr);
  else arr.forEach((_, i) => (arr[i] = Math.floor(Math.random() * 256)));
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ————— AI generation (local, deterministic-flavored) ————— */
const KW: Record<Domain, string[]> = {
  legal: ["nda", "confidentiality", "contract-law", "obligations", "term-sheet", "governing-law", "indemnification", "execution-copy", "counterparty", "non-disclosure"],
  finance: ["quarterly-report", "gaap", "revenue", "ebitda", "cash-flow", "consolidation", "fiscal-q3", "balance-sheet", "audited", "materiality"],
  resume: ["curriculum-vitae", "work-experience", "references", "qualifications", "employment", "skills-matrix", "senior-role", "portfolio", "certifications", "cover-letter"],
  design: ["product-spec", "components", "wireframes", "design-system", "revision-7", "tolerances", "bom", "prototyping", "ux-flow", "handoff"],
  scan: ["digitized", "field-survey", "ocr", "batch-12", "georeferenced", "archive", "a3-original", "grayscale", "300dpi", "records"],
  invoice: ["tax-invoice", "billing", "vat", "payment-terms", "remittance", "line-items", "net-30", "ledger", "reconciliation", "statement"],
  general: ["reference", "internal", "draft", "review", "annotations", "versioning", "distribution", "appendix", "summary", "notes"],
};
const SUBJECT: Record<Domain, string> = {
  legal: "Executed non-disclosure agreement with standard mutual obligations",
  finance: "Consolidated quarterly results with variance commentary",
  resume: "Professional profile and employment history summary",
  design: "Engineering specification, revision 7, with component index",
  scan: "Archival scan of field survey records, batch 12",
  invoice: "Invoice for services rendered, payable net-30",
  general: "Working document for internal review",
};
export function aiGenerate(d: PdfDoc) {
  const rng = mulberry(hashStr(d.name) ^ 0x9e3779b9);
  const kws = [...KW[d.domain]];
  for (let i = kws.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [kws[i], kws[j]] = [kws[j], kws[i]];
  }
  const base = titleCase(d.name.replace(/\.pdf$/i, ""));
  return {
    title: `${base} — ${d.domain === "finance" ? "Final" : d.domain === "legal" ? "Execution Copy" : "Reviewed"} ${new Date(d.info.created).getFullYear()}`,
    subject: SUBJECT[d.domain],
    keywords: kws.slice(0, 10),
    summary: `Automated abstract: this document matches the "${d.domain}" profile across ${d.pages} pages. Confidence ${(88 + rng() * 11).toFixed(1)}% — generated locally, no data left this device.`,
  };
}

/* ————— templates ————— */
export interface Template {
  id: string;
  name: string;
  blurb: string;
  info: Partial<InfoData>;
  permissions: Partial<Permissions>;
}
export const TEMPLATES: Template[] = [
  {
    id: "legal", name: "Legal Contract", blurb: "Matter ID, confidentiality flags, printing locked to high-res only.",
    info: { subject: "Binding agreement — controlled distribution", keywords: ["legal", "contract", "confidential", "executed"], producer: "MetaForge LegalPress 2.4", custom: [["Confidentiality", "Restricted"], ["MatterID", "ACM-2026-014"]] },
    permissions: { copy: false, modify: false, annotate: false, assembly: false, print: "high" },
  },
  {
    id: "academic", name: "Academic Paper", blurb: "DOI-style keywords, accessibility copying explicitly permitted.",
    info: { subject: "Peer-reviewed manuscript, preprint", keywords: ["research", "preprint", "methodology", "citations", "open-access"], producer: "MetaForge Scholar 1.8", custom: [["DOI", "10.5281/zenodo.0042"]] },
    permissions: { copy: true, accessibility: true, annotate: true, print: "high" },
  },
  {
    id: "invoice", name: "Invoice", blurb: "Minimal surface: ledger keys, no assembly, low-res print allowed.",
    info: { subject: "Tax invoice for professional services", keywords: ["invoice", "billing", "vat", "net-30"], producer: "MetaForge Ledger 3.1", custom: [["LedgerRef", "INV-2026-0042"]] },
    permissions: { assembly: false, modify: false, print: "low" },
  },
  {
    id: "press", name: "Press Release", blurb: "Embargo metadata, broad copying allowed, full-res printing.",
    info: { subject: "Embargoed announcement for syndication", keywords: ["press-release", "embargo", "media-kit", "boilerplate"], producer: "MetaForge Wire 2.0", custom: [["Embargo", "2026-03-01T09:00Z"]] },
    permissions: { copy: true, annotate: false, print: "high" },
  },
];

/* ————— compression ————— */
export const TIERS: { id: Tier; name: string; use: string; techniques: string[]; ratio: [number, number] }[] = [
  { id: "low", name: "Low", use: "High-fidelity archiving · print-ready", techniques: ["Lossless object-stream optimization", "Metadata dictionary cleanup", "Minor image downsampling ≥ 288 DPI"], ratio: [0.05, 0.12] },
  { id: "medium", name: "Medium", use: "E-mail attachments · standard web sharing", techniques: ["Image DPI reduction to 150", "Font subsetting (embedded → used glyphs)", "Flate stream re-compression"], ratio: [0.28, 0.42] },
  { id: "high", name: "High", use: "Rapid uploads · strict size limits", techniques: ["Aggressive downsampling to 96 DPI", "JPEG re-encode of raster content", "Object-stream merging + duplication purge"], ratio: [0.55, 0.7] },
];
export function projectSize(d: PdfDoc, tier: Tier): number {
  const t = TIERS.find((x) => x.id === tier)!;
  const rng = mulberry(hashStr(d.name + tier));
  const r = t.ratio[0] + rng() * (t.ratio[1] - t.ratio[0]);
  return Math.max(24_000, Math.round(d.sizeBytes * (1 - r)));
}

/* ————— CSV / JSON sync ————— */
export function docsToCsv(docs: PdfDoc[]): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const head = ["name", "title", "author", "subject", "keywords", "producer", "created", "exposure"];
  const rows = docs.map((d) =>
    [d.name, d.info.title, d.info.author, d.info.subject, d.info.keywords.join("; "), d.info.producer, d.info.created.slice(0, 10), String(exposureOf(d))].map(q).join(",")
  );
  return [head.join(","), ...rows].join("\n");
}
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (!lines.length) return [];
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') inQ = false;
        else cur += c;
      } else if (c === '"') inQ = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out;
  };
  const head = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((l) => {
    const cells = parseLine(l);
    const row: Record<string, string> = {};
    head.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

export function download(filename: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}

export const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
