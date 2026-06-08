import { useState, useEffect } from "react";
import { useTheme } from "./hooks/useTheme";
import { api } from "./services/api";
import { NavBar } from "./components/NavBar";
import { Footer } from "./components/Footer";
import { LiveTab } from "./components/tabs/LiveTab";
import { UploadTab } from "./components/tabs/UploadTab";
import clsx from "clsx";

const TABS = [
  { id: "live",   label: "🎙 Live"   },
  { id: "upload", label: "📁 Upload" },
];

export default function App() {
  const { theme, toggle } = useTheme();
  const [activeTab, setActiveTab] = useState("live");
  const [health,    setHealth]    = useState(null);

  useEffect(() => { api.health().then(setHealth).catch(() => {}); }, []);

  const modelName = health?.model_name || document.title || "Khmer ASR";

  return (
    <div className={clsx(
      "grid-bg min-h-screen flex flex-col",
      "bg-bg dark:bg-bg text-tx dark:text-tx",
      "light:bg-[#f4f7f6] light:text-[#1a2e28]",
    )}>
      <NavBar modelName={modelName} health={health} theme={theme} onToggleTheme={toggle} />

      <main className="relative z-10 flex-1 flex flex-col items-center px-4 py-10 gap-7">
        <div className="text-center">
          <p className="text-[10px] tracking-[.18em] uppercase text-accent mb-1.5">Speech Recognition</p>
          <h1 className="font-khmer font-semibold text-[clamp(22px,4vw,34px)] text-head dark:text-head light:text-[#0d1f1a]">
            {modelName}
          </h1>
          <p className="mt-1.5 text-[11px] text-muted tracking-wide">
            Real-time streaming · File upload · Khmer language
          </p>
        </div>

        <div className="flex gap-1 p-1 bg-surface dark:bg-surface light:bg-white border border-border dark:border-border light:border-[#d5e3de] rounded-xl">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={clsx(
                "px-7 py-2.5 rounded-lg text-[11px] font-mono tracking-[.08em] uppercase transition-all",
                activeTab === t.id
                  ? "bg-raised dark:bg-raised light:bg-[#f0f4f2] text-tx border border-border shadow-sm"
                  : "text-muted hover:text-tx"
              )}>
              {t.label}
            </button>
          ))}
        </div>

        <div className={clsx(
          "card-glow relative w-full max-w-[780px]",
          "bg-surface dark:bg-surface light:bg-white",
          "border border-border dark:border-border light:border-[#d5e3de]",
          "rounded-2xl px-10 py-9",
          "shadow-[0_24px_64px_rgba(0,0,0,.55)] dark:shadow-[0_24px_64px_rgba(0,0,0,.55)]",
          "light:shadow-[0_8px_32px_rgba(0,60,40,.08)]",
        )}>
          {activeTab === "live"
            ? <LiveTab />
            : <UploadTab diarizationEnabled={health?.diarization_enabled ?? true} />}
        </div>
      </main>

      <Footer modelName={modelName} />
    </div>
  );
}
