/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: '#1f2128',
        panelAlt: '#2a2d37',
        accent: '#5f7fff'
      }
    }
  },
  plugins: []
};
