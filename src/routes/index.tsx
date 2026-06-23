import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import useAudioAnalyzer from "@/hooks/use-audio-analyzer";
import VisualCanvas from "@/components/visual-canvas";
import {
  Upload,
  Download,
  Video,
  Share2,
  Sparkles,
  ChevronDown,
  Activity,
  Music2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Visual Sync — Shareable Music Card Maker" },
      {
        name: "description",
        content:
          "Design audio-reactive visuals synced to your music. Real-time WebGL renders, exportable as GIF or MP4.",
      },
      { property: "og:title", content: "Visual Sync — Shareable Music Card Maker" },
      {
        property: "og:description",
        content:
          "Design audio-reactive visuals synced to your music. Real-time WebGL renders, exportable as GIF or MP4.",
      },
    ],
  }),
  component: Index,
});

const STYLES = [
  "The Nebula (Active)",
  "Pulsing City",
  "Fluid Ocean",
  "Quantum Burst",
] as const;

const PALETTES = [
  { name: "Neon Teal", colors: ["#0CF6E0", "#066F65"] },
  { name: "Cyber Pink", colors: ["#FF3DAA", "#7A0E4A"] },
  { name: "Electric Blue", colors: ["#3DA8FF", "#10406E"] },
  { name: "Acid Lime", colors: ["#C9FF3D", "#3F5A0E"] },
];

const PRESETS = [
  { name: "The Nebula", gradient: "radial-gradient(circle at 30% 30%, #0CF6E0 0%, #1a1a4a 45%, #050510 100%)" },
  { name: "Pulsing City", gradient: "linear-gradient(180deg, #ff3dff 0%, #1a0b3a 60%, #050015 100%)" },
  { name: "Fluid Ocean", gradient: "linear-gradient(160deg, #3dffd6 0%, #0a3a6e 60%, #020a1f 100%)" },
  { name: "Quantum Burst", gradient: "conic-gradient(from 210deg at 50% 50%, #c9ff3d, #ff3daa, #3da8ff, #c9ff3d)" },
];

const TECH = ["Web Audio API", "WebGL/Three.js", "TypeScript", "React Flow"];

function Index() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [style, setStyle] = useState<string>(STYLES[0]);
  const [bass, setBass] = useState<number>(72);
  const [treble, setTreble] = useState<number>(54);
  const [energy, setEnergy] = useState<number>(83);
  const [palette, setPalette] = useState(0);

  // Audio analyzer hook
  const { loadSource, play, pause, isPlaying, updateFrequencyData } = useAudioAnalyzer();

  // Real-time frequency data passed to VisualCanvas
  const [freqData, setFreqData] = useState<Uint8Array>(() => new Uint8Array(256));

  // Note: the center visual is handled by Three.js in VisualCanvas

  // frequency polling loop: update freqData at ~60fps
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const arr = updateFrequencyData();
      if (arr) {
        // copy to trigger React updates
        setFreqData(arr.slice());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [updateFrequencyData]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)_340px] gap-4 p-4">
        {/* LEFT */}
        <aside className="rounded-2xl border border-border bg-[var(--panel)] p-5 flex flex-col gap-6 overflow-auto">
          <header className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-neon/15 text-neon">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold tracking-tight">Design Studio</h1>
              <p className="text-xs text-muted-foreground">Visual Sync v1.0</p>
            </div>
          </header>

          <Section title="1. Upload Your Audio">
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer?.files?.[0];
                if (f) {
                  setFileName(f.name);
                  loadSource(f);
                }
              }}
              className="block cursor-pointer rounded-xl border border-dashed border-border bg-[var(--panel-deep)] p-5 text-center hover:border-neon/60 transition-colors"
            >
              <input
                type="file"
                accept="audio/*,video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFileName(f.name);
                    loadSource(f);
                  }
                }}
              />
              <Upload className="mx-auto h-6 w-6 text-neon" />
              <p className="mt-2 text-sm font-medium">Drop audio or video here</p>
              <p className="mt-1 text-xs text-muted-foreground truncate">
                {fileName ?? "midnight_drive_master_v3.mp3"}
              </p>
            </label>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={async () => {
                  try {
                    await play();
                  } catch (err) {
                    console.error(err);
                  }
                }}
                className="inline-flex items-center justify-center rounded-full bg-neon px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:brightness-110"
              >
                Play
              </button>
              <button
                onClick={() => pause()}
                className="inline-flex items-center justify-center rounded-full border border-border bg-transparent px-4 py-2 text-xs font-semibold text-foreground transition hover:border-neon/60"
              >
                Pause
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{isPlaying ? "Playing now" : "Paused"}</p>
          </Section>

          <Section title="2. Select Visualization Style">
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger className="w-full bg-[var(--panel-deep)] border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Section>

          <Section title="3. Fine-tune Parameters">
            <SliderRow label="Bass Intensity" value={bass} onChange={setBass} />
            <SliderRow label="Treble Sensitivity" value={treble} onChange={setTreble} />
            <SliderRow label="Overall Energy" value={energy} onChange={setEnergy} />
          </Section>

          <Section title="Palette">
            <div className="flex gap-2">
              {PALETTES.map((p, i) => (
                <button
                  key={p.name}
                  onClick={() => setPalette(i)}
                  title={p.name}
                  className={`h-11 w-11 rounded-md border-2 transition-all ${
                    palette === i
                      ? "border-neon shadow-[var(--shadow-neon)] scale-105"
                      : "border-border hover:border-neon/50"
                  }`}
                  style={{
                    background: `linear-gradient(135deg, ${p.colors[0]} 0%, ${p.colors[1]} 100%)`,
                  }}
                />
              ))}
            </div>
          </Section>

          <Section title="Curated Styles">
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setStyle(p.name === "The Nebula" ? STYLES[0] : p.name)}
                  className="group rounded-lg border border-border overflow-hidden hover:border-neon/60 transition-colors text-left"
                >
                  <div className="aspect-video w-full" style={{ background: p.gradient }} />
                  <div className="p-2">
                    <p className="text-xs font-medium truncate">{p.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </Section>
        </aside>

        {/* CENTER */}
        <main className="flex flex-col gap-4 min-h-0">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Music2 className="h-4 w-4 text-neon" />
              <span className="truncate">{fileName ?? "midnight_drive_master_v3.mp3"}</span>
            </div>
            <span className="text-xs text-muted-foreground">{style}</span>
          </div>

          <div className="relative flex-1 rounded-2xl border border-border bg-black overflow-hidden shadow-[0_0_60px_-20px_var(--neon)]">
            <div className="block h-full w-full">
              <VisualCanvas frequencyData={freqData} bassIntensity={bass} />
            </div>
            <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full border border-neon/40 bg-black/60 px-3 py-1.5 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-neon shadow-[0_0_8px_var(--neon)]" />
              <span className="text-xs font-medium text-neon">60 FPS (Stable)</span>
            </div>
          </div>
        </main>

        {/* RIGHT */}
        <aside className="rounded-2xl border border-border bg-[var(--panel)] p-5 flex flex-col gap-6 overflow-auto">
          <header>
            <h2 className="text-base font-semibold tracking-tight">Export & Share</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Render at studio quality, ready for any feed.
            </p>
          </header>

          <div className="flex flex-col gap-3">
            <Button variant="secondary" className="w-full justify-start h-11 bg-[var(--panel-deep)] hover:bg-secondary border border-border">
              <Download className="h-4 w-4" />
              Download High-Res GIF
            </Button>

            <button className="group relative w-full h-14 rounded-lg bg-neon text-primary-foreground font-semibold text-sm shadow-[var(--shadow-neon)] hover:brightness-110 transition-all inline-flex items-center justify-center gap-2 cursor-pointer">
              <Video className="h-5 w-5" />
              Export as MP4 (Synced)
            </button>

            <Button variant="outline" className="w-full justify-start h-11 bg-transparent border-border hover:bg-[var(--panel-deep)]">
              <Share2 className="h-4 w-4" />
              Post directly to TikTok/Instagram
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-[var(--panel-deep)] p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5 text-neon" />
              Render Performance
            </div>
            <p className="mt-2 text-sm font-medium">
              <span className="text-neon">60 FPS</span> (Stable)
              <span className="text-muted-foreground"> · 4K Ready</span>
            </p>
            <div className="mt-3 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
              <div className="h-full w-[92%] bg-neon shadow-[0_0_8px_var(--neon)]" />
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-border">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
              Powered by
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TECH.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border bg-[var(--panel-deep)] px-2.5 py-1 text-[11px] text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
        {title}
      </h3>
      {children}
    </section>
  );
}

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-foreground/80">{label}</span>
        <span className="text-xs font-mono text-neon">{value}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v: any) => {
          const next = Array.isArray(v) ? v[0] : v;
          onChange(Number(next));
        }}
        max={100}
        step={1}
      />
    </div>
  );
}
