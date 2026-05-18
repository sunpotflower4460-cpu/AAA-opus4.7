/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        washi: "#F7F1E5",
        paper: "#FBF8F1",
        sumi: "#1F1B18",
        "ink-muted": "#5F5750",
        gold: "#C9A646",
        indigo: "#243B53",
        vermilion: "#B14A36",
      },
      fontFamily: {
        serif: [
          '"Hiragino Mincho ProN"',
          '"Yu Mincho"',
          '"Noto Serif JP"',
          '"Noto Serif"',
          "serif",
        ],
        sans: [
          '"Hiragino Sans"',
          '"Noto Sans JP"',
          "system-ui",
          "sans-serif",
        ],
      },
      spacing: {
        // 黄金比スケール
        "gr-1": "4px",
        "gr-2": "8px",
        "gr-3": "13px",
        "gr-4": "21px",
        "gr-5": "34px",
        "gr-6": "55px",
        "gr-7": "89px",
      },
      maxWidth: {
        zanshin: "720px",
      },
      boxShadow: {
        paper:
          "0 1px 2px rgba(31, 27, 24, 0.05), 0 4px 13px rgba(31, 27, 24, 0.035)",
        "paper-hover":
          "0 2px 4px rgba(31, 27, 24, 0.06), 0 8px 21px rgba(31, 27, 24, 0.05)",
        "paper-soft":
          "0 1px 1px rgba(31, 27, 24, 0.04), 0 2px 8px rgba(31, 27, 24, 0.03)",
      },
      lineHeight: {
        golden: "1.618",
        ample: "1.85",
      },
      letterSpacing: {
        mincho: "0.04em",
      },
      keyframes: {
        breath: {
          "0%, 100%": { opacity: "0.85" },
          "50%": { opacity: "1" },
        },
        breathDot: {
          "0%, 100%": { opacity: "0.55", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.15)" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        softUp: {
          "0%": { opacity: "0", transform: "translateY(13px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        washiFade: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        breath: "breath 5.4s ease-in-out infinite",
        breathDot: "breathDot 2.8s ease-in-out infinite",
        fadeIn: "fadeIn 420ms ease-out both",
        softUp: "softUp 360ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
        washiFade: "washiFade 600ms ease-out both",
      },
    },
  },
  plugins: [],
};
