/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc5fb',
          400: '#36a5f7',
          500: '#0c87eb',
          600: '#026ac8',
          700: '#0354a2',
          800: '#074885',
          900: '#0c3d6e',
          950: '#082749',
        },
        slate: {
          850: '#151f32',
          900: '#0f172a',
          950: '#0b1120',
        }
      },
      fontSize: {
        '2xs': '0.6875rem', // 11px
        'xs': '0.75rem',    // 12px
        'sm': '0.8125rem',  // 13px
        'base': '0.875rem', // 14px
      }
    },
  },
  plugins: [],
}
