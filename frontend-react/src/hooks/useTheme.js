import { useState, useEffect } from "react";

const KEY = "asr-theme";

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "dark" : "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark",  theme === "dark");
    root.classList.toggle("light", theme === "light");
    localStorage.setItem(KEY, theme);
  }, [theme]);

  // Follow system if user hasn't overridden
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = (e) => {
      if (!localStorage.getItem(KEY)) setTheme(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggle = () => setTheme(t => t === "dark" ? "light" : "dark");
  return { theme, toggle };
}
