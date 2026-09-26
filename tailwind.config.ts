import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ===== TRAINERTOP DESIGN SYSTEM =====
        
        // Asosiy aksent — Lime Energy
        lime: {
          DEFAULT: "#B4FF00",
          light: "#CCFF44",
          dark: "#8ACC00",
          muted: "rgba(180, 255, 0, 0.12)",
          subtle: "rgba(180, 255, 0, 0.06)",
        },

        // Qora fonlar
        dark: {
          DEFAULT: "#0A0A0A",
          surface: "#141414",
          card: "#1E1E1E",
          elevated: "#282828",
        },

        // Kategoriya ranglari
        category: {
          fitness: "#3B82F6",
          bodybuilding: "#A855F7",
          yoga: "#EC4899",
          powerlifting: "#EF4444",
          diet: "#10B981",
          cardio: "#F59E0B",
        },

        // Status ranglari
        status: {
          success: "#10B981",
          warning: "#F59E0B",
          error: "#EF4444",
          info: "#3B82F6",
        },
      },

      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },

      fontSize: {
        "hero": ["2.5rem", { lineHeight: "1.1", fontWeight: "700" }],
        "h1": ["1.75rem", { lineHeight: "1.2", fontWeight: "700" }],
        "h2": ["1.25rem", { lineHeight: "1.3", fontWeight: "600" }],
        "h3": ["1.125rem", { lineHeight: "1.4", fontWeight: "600" }],
        "body": ["0.9375rem", { lineHeight: "1.6", fontWeight: "400" }],
        "small": ["0.8125rem", { lineHeight: "1.5", fontWeight: "400" }],
        "xs": ["0.6875rem", { lineHeight: "1.4", fontWeight: "400" }],
      },

      borderRadius: {
        "card": "12px",
        "button": "10px",
        "badge": "20px",
        "input": "10px",
      },

      boxShadow: {
        "card": "0 2px 8px rgba(0, 0, 0, 0.3)",
        "elevated": "0 8px 24px rgba(0, 0, 0, 0.4)",
      },

      backgroundImage: {
        "lime-gradient": "linear-gradient(135deg, #B4FF00, #8ACC00)",
        "dark-gradient": "linear-gradient(180deg, #0A0A0A, #141414)",
      },

      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-lime": "pulseLime 2s infinite",
      },

      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseLime: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(180, 255, 0, 0.3)" },
          "50%": { boxShadow: "0 0 0 8px rgba(180, 255, 0, 0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
