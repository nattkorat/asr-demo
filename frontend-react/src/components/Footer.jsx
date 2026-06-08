import { Mail, User, ExternalLink } from "lucide-react";

// ── Edit these placeholders ────────────────────────────────────────────────────
const CONTACT = {
  name:     "Natt KORAT",
  email:    "natt.korat@cadt.edu.kh",
  github:   "https://github.com/nattKorat",
  linkedin: "https://linkedin.com/in/yourhandle",
  tagline:  "Khmer Speech Recognition Research",
  org:      "CADT · Cambodia Academy of Digital Technology",
  year:     "2026",
};
// ──────────────────────────────────────────────────────────────────────────────

// Inline SVGs for social icons not in lucide-react
const GithubIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
  </svg>
);

const LinkedinIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/>
    <circle cx="4" cy="4" r="2"/>
  </svg>
);

const XIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

export function Footer({ modelName }) {
  return (
    <footer className="relative z-10 dark:border-border bg-surface dark:bg-surface mt-auto light:bg-[#f4f7f6] light:text-[#1a2e28] border-t border-border">
      <div className="max-w-6xl mx-auto px-8 py-8">
        <div className="flex flex-wrap gap-8 justify-between items-start">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg border border-border bg-raised flex items-center justify-center overflow-hidden shrink-0 light:bg-[#f4f7f6] light:text-[#1a2e28]">
              <img src="/static/logo.png" alt="logo" className="w-full h-full object-contain"
                onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="block"; }}/>
              <span style={{display:"none"}} className="text-accent font-mono font-semibold text-xs">ASR</span>
            </div>
            <div>
              <p className="font-khmer font-semibold text-[14px] text-head light:bg-[#f4f7f6] light:text-[#1a2e28]">{modelName}</p>
              <p className="text-[10px] text-muted tracking-wider">{CONTACT.tagline}</p>
            </div>
          </div>

          {/* Contact */}
          <div className="flex flex-col gap-2">
            <p className="text-[9px] text-muted tracking-[.15em] uppercase mb-1">Contact</p>
            <FLink href="#"                          icon={<User size={12}/>}>{CONTACT.name}</FLink>
            <FLink href={`mailto:${CONTACT.email}`} icon={<Mail size={12}/>}>{CONTACT.email}</FLink>
          </div>

          {/* Social */}
          <div className="flex flex-col gap-2">
            <p className="text-[9px] text-muted tracking-[.15em] uppercase mb-1">Links</p>
            <FLink href={CONTACT.github}   icon={<GithubIcon   />}>GitHub</FLink>
            {/* <FLink href={CONTACT.linkedin} icon={<LinkedinIcon />}>LinkedIn</FLink>
            <FLink href={CONTACT.twitter}  icon={<XIcon        />}>X / Twitter</FLink> */}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-7 pt-5 text-[10px] text-muted tracking-wide">
          <span>© {CONTACT.year} {CONTACT.org}</span>
          <span>Khmer ASR Research Demo</span>
        </div>
      </div>
    </footer>
  );
}

function FLink({ href, icon, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2 text-[11px] text-muted hover:text-accent transition-colors no-underline">
      {icon}{children}
    </a>
  );
}
