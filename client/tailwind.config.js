/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#E63946",
        secondary: "#1D3557",
        accent: "#2ECC71",
        background: "#F8F9FA",
        text: "#212529"
      }
    },
  },
  plugins: [],
}
