/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 950: "#0b1426", 900: "#0f1d36", 800: "#16294a", 700: "#223b66" },
        teal: { 50: "#effaf8", 100: "#d4f1ec", 600: "#0d8a80", 700: "#0b7169", 800: "#0a5a54" },
      },
      boxShadow: { card: "0 1px 2px rgba(15, 29, 54, 0.06)" },
    },
  },
  plugins: [],
};
