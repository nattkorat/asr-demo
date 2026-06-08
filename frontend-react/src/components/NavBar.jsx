import { Sun, Moon } from "lucide-react";
import clsx from "clsx";

export function NavBar({ modelName, health, theme, onToggleTheme }) {
  return (
    <nav className="relative z-10 flex items-center justify-between px-8 py-4 bg-surface dark:bg-surface light:bg-surface/light border-b border-border dark:border-border light:border-border/light gap-4 light:bg-[#f4f7f6] light:text-[#1a2e28]">
      {/* Brand */}
      <a href="/" className="flex items-center gap-3.5 no-underline light:bg-[#f4f7f6] light:text-[#1a2e28]">
        <div className="w-9 h-9 rounded-[10px] border border-border dark:border-border light:border-border/light bg-raised dark:bg-raised light:bg-raised/light flex items-center justify-center overflow-hidden shrink-0 light:bg-[#f4f7f6] light:text-[#1a2e28]">
          <img
            src="/static/logo.png"
            alt="logo"
            className="w-full h-full object-contain light:bg-[#f4f7f6] light:text-[#1a2e28]"
            onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "block"; }}
          />
          <span style={{ display: "none" }} className="text-accent font-mono font-semibold text-sm">ASR</span>
        </div>
        <span className="font-khmer font-semibold text-[17px] text-head dark:text-head light:text-head/light light:bg-[#f4f7f6] light:text-[#1a2e28]">
          {modelName}
        </span>
      </a>

      {/* Right: badges + theme toggle */}
      <div className="flex items-center gap-2.5 light:bg-[#f4f7f6] light:text-[#1a2e28]">
        {health && (
          <>
            <Badge dot={health.device?.startsWith("cuda") ? "gpu" : "cpu"}>
              {health.device}
            </Badge>
            <Badge>
              {health.model_mode} · {health.sample_rate}Hz
            </Badge>
            {health.lm_enabled && (
              <Badge dotColor="#fbbf24">LM</Badge>
            )}
          </>
        )}
        <button
          onClick={onToggleTheme}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-border dark:border-border light:border-border/light bg-raised dark:bg-raised light:bg-raised/light text-muted hover:text-tx transition-colors light:bg-[#f4f7f6] light:text-[#1a2e28]"
          title="Toggle theme"
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </nav>
  );
}

function Badge({ children, dot, dotColor }) {
  const isGpu = dot === "gpu";
  const color = dotColor || (isGpu ? "#a78bfa" : dot === "cpu" ? "#44625c" : "#00e5a0");
  return (
    <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono tracking-widest text-muted bg-raised dark:bg-raised light:bg-raised/light border border-border dark:border-border light:border-border/light light:bg-[#f4f7f6] light:text-[#1a2e28]">
      <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 5px ${color}` }} />
      {children}
    </span>
  );
}
