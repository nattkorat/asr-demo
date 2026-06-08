/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg:      { DEFAULT: "#0b0f0e", light: "#f4f7f6" },
        surface: { DEFAULT: "#111615", light: "#ffffff"  },
        raised:  { DEFAULT: "#161d1b", light: "#f0f4f2"  },
        border:  { DEFAULT: "#1d2724", light: "#d5e3de"  },
        tx:      { DEFAULT: "#d0e8e1", light: "#1a2e28"  },
        head:    { DEFAULT: "#e8f5f0", light: "#0d1f1a"  },
        muted:   { DEFAULT: "#44625c", light: "#7fa89e"  },
        accent:  { DEFAULT: "#00e5a0", hover: "#00f2ab"  },
        accent2: { DEFAULT: "#00b3ff", hover: "#33c5ff"  },
        danger:  { DEFAULT: "#ff4d6d", hover: "#ff6b85"  },
        purple:  { DEFAULT: "#a78bfa"                    },
        yellow:  { DEFAULT: "#fbbf24"                    },
      },
      fontFamily: {
        mono:  ['"DM Mono"', "monospace"],
        khmer: ['"Noto Sans Khmer"', "sans-serif"],
        sans:  ['"DM Mono"', "monospace"],
      },
    },
  },
  plugins: [
    function ({ addVariant }) {
      addVariant("light", ".light &");
    },
  ],
}
