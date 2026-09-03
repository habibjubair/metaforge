import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import {
  IconContrast, IconForge, IconMap, IconMoon, IconOled, IconPress, IconShield, IconSun, IconSync, Logo,
} from "./components/icons";
import { Kbd, Ring, Toasts } from "./components/ui";
import { ThemeMode, View, fmtBytes } from "./lib/engine";
import { Compress } from "./modules/Compress";
import { RiskMap } from "./modules/RiskMap";
import { Security } from "./modules/Security";
import { Sync } from "./modules/Sync";
import { Workbench } from "./modules/Workbench";
import { avgExposure, useStore } from "./store";

const NAV: { id: View; label: string; icon: (p: { size?: number }) => React.ReactNode; title: string; sub: string }[] = [
  { id: "forge", label: "Workbench", icon: (p) => <IconForge {...p} />, title: "The Forge", sub: "Deep-scan, edit and sanitize — dual Info + XMP engine" },
  { id: "map", label: "Risk map", icon: (p) => <IconMap {...p} />, title: "Visual metadata map", sub: "How every byte of identity hangs off the document root" },
  { id: "compress", label: "Compress", icon: (p) => <IconPress {...p} />, title: "Compression suite", sub: "Tiered optimization, lossless to aggressive" },
  { id: "security", label: "Security", icon: (p) => <IconShield {...p} />, title: "Security & permissions", sub: "Restrict, encrypt, sign, scan and audit" },
  { id: "sync", label: "Batch & sync", icon: (p) => <IconSync {...p} />, title: "Batch & cross-format sync", sub: "Bulk CRUD, templates and CSV/JSON round-trips" },
];

const THEMES: { id: ThemeMode; label: string; icon: (p: { size?: number }) => React.ReactNode }[] = [
  { id: "light", label: "Light", icon: (p) => <IconSun {...p} /> },
  { id: "dark", label: "Dark", icon: (p) => <IconMoon {...p} /> },
  { id: "oled", label: "OLED black", icon: (p) => <IconOled {...p} /> },
  { id: "contrast", label: "High contrast", icon: (p) => <IconContrast {...p} /> },
];

export default function App() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const docs = useStore((s) => s.docs);
  const busy = useStore((s) => s.busy);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey) return;
      const idx = ["1", "2", "3", "4", "5"].indexOf(e.key);
      if (idx >= 0) setView(NAV[idx].id);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [setView]);

  const meta = NAV.find((n) => n.id === view)!;
  const exposure = avgExposure(docs);
  const totalBytes = docs.reduce((a, d) => a + d.sizeBytes, 0);
  const flagged = docs.filter((d) => d.findings.some((f) => !f.resolved)).length;

  return (
    <div className="grain relative flex h-full flex-col overflow-hidden">
      <div className="relative z-10 flex min-h-0 flex-1">
        {/* ── Sidebar ── */}
        <nav className="flex w-[196px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--surface)]/60 px-4 py-5 backdrop-blur-sm max-lg:w-[64px] max-lg:px-2.5" aria-label="Primary">
          <div className="mb-7 flex items-center gap-2.5 max-lg:justify-center">
            <span className="neu-flat flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-[var(--accent)]">
              <Logo size={22} />
            </span>
            <div className="max-lg:hidden">
              <p className="font-display text-[15px] font-extrabold leading-none tracking-tight">MetaForge</p>
              <p className="mt-1 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-faint)]">PDF · rust core</p>
            </div>
          </div>
          <div className="space-y-2">
            {NAV.map((n, i) => {
              const active = view === n.id;
              return (
                <button
                  key={n.id} onClick={() => setView(n.id)}
                  className={`group flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-all max-lg:justify-center max-lg:px-0 ${active ? "neu-inset text-[var(--ink)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"}`}
                  aria-current={active ? "page" : undefined}
                  title={n.label}
                >
                  <span className={`relative shrink-0 ${active ? "text-[var(--accent)]" : ""}`}>
                    {n.icon({ size: 18 })}
                    {n.id === "forge" && flagged > 0 && !active && (
                      <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-[var(--danger)]" style={{ animation: "pulse-dot 1.6s infinite" }} />
                    )}
                  </span>
                  <span className="flex-1 text-[12.5px] font-bold max-lg:hidden">{n.label}</span>
                  <span className="font-mono text-[9px] text-[var(--ink-faint)] max-lg:hidden">{i + 1}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto space-y-3 max-lg:hidden">
            <div className="neu-inset-soft rounded-[12px] p-3">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Engine</p>
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-[var(--ok)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--ok)]" style={{ animation: busy ? "pulse-dot 0.8s infinite" : "none" }} />
                {busy ? "processing" : "idle"}
              </p>
              <p className="mt-0.5 font-mono text-[9px] text-[var(--ink-faint)]">lopdf 0.34 · quick-xml 0.31</p>
            </div>
            <div className="px-1 text-[10px] leading-relaxed text-[var(--ink-faint)]">
              <Kbd>1–5</Kbd> switch module · <Kbd>⌘S</Kbd> commit
            </div>
          </div>
        </nav>

        {/* ── Main column ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--line)] px-6 py-3.5 max-md:px-4">
            <div className="min-w-0">
              <h1 className="truncate font-display text-[17px] font-extrabold leading-tight tracking-tight">{meta.title}</h1>
              <p className="truncate text-[11px] text-[var(--ink-faint)]">{meta.sub}</p>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <div className="hidden items-center gap-3 md:flex">
                <div className="text-right">
                  <p className="tabular font-display text-[13px] font-bold leading-none">{docs.length} docs · {fmtBytes(totalBytes)}</p>
                  <p className="mt-1 text-[10px] font-semibold" style={{ color: flagged ? "var(--danger)" : "var(--ok)" }}>
                    {flagged ? `${flagged} file${flagged > 1 ? "s" : ""} leaking metadata` : "queue is clean"}
                  </p>
                </div>
                <Ring value={exposure} size={52} stroke={5.5} sub="avg risk" />
              </div>
              <div className="neu-inset-soft flex items-center gap-1 rounded-[12px] p-1" role="group" aria-label="Theme">
                {THEMES.map((t) => (
                  <button
                    key={t.id} onClick={() => setTheme(t.id)} title={t.label} aria-label={`${t.label} theme`} aria-pressed={theme === t.id}
                    className="neu-btn flex h-7 w-7 items-center justify-center rounded-[9px]"
                    style={theme === t.id ? { color: "var(--accent)", boxShadow: "inset 2px 2px 5px var(--sh-d), inset -2px -2px 5px var(--sh-l)" } : { color: "var(--ink-faint)", boxShadow: "none", background: "transparent" }}
                  >
                    {t.icon({ size: 14 })}
                  </button>
                ))}
              </div>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-hidden px-6 py-4 max-md:px-4">
            <AnimatePresence mode="wait">
              <motion.div key={view} className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                {view === "forge" && <Workbench />}
                {view === "map" && <RiskMap />}
                {view === "compress" && <Compress />}
                {view === "security" && <Security />}
                {view === "sync" && <Sync />}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* ── Status bar ── */}
          <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-[var(--line)] px-6 py-2 font-mono text-[9.5px] text-[var(--ink-faint)] max-md:px-4">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: busy ? "var(--warn)" : "var(--ok)", animation: busy ? "pulse-dot 0.7s infinite" : "none" }} />
                {busy ?? "core idle — awaiting work"}
              </span>
              <span className="hidden sm:inline">sandbox: local-only</span>
              <span className="hidden md:inline">audit chain sealed</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline">0 bytes uploaded</span>
              <span>MetaForge v2.4.1</span>
            </div>
          </footer>
        </div>
      </div>
      <Toasts />
    </div>
  );
}
