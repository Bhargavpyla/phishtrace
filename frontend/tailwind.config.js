/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "ui-sans-serif", "system-ui", "-apple-system", '"Segoe UI"', "Roboto", "sans-serif"],
      },
      colors: {
        canvas: "#f3f5fa",
        navy: { 950: "#0a1224", 900: "#0e1a33", 800: "#16264a", 700: "#223a68" },
        teal: { 50: "#effaf8", 100: "#d4f1ec", 600: "#0d8a80", 700: "#0b7169", 800: "#0a5a54" },
        accent: { 50: "#eef3ff", 100: "#dbe6ff", 500: "#4a78f0", 600: "#3a64dc", 700: "#2f52b8" },
      },
      borderRadius: { "2xl": "1rem", "3xl": "1.5rem" },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 6px 20px rgba(16, 24, 40, 0.05)",
        lift: "0 2px 4px rgba(16, 24, 40, 0.06), 0 10px 28px rgba(16, 24, 40, 0.09)",
      },
    },
  },
  plugins: [],
};
