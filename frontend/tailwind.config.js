/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        // Warm Earth / Burnt Sienna Palette matching requested image
        surface: {
          50: '#fcfcf8', // Very light beige tint
          100: '#F5F5DC', // EXACT MATCH: Cream/Beige for light backgrounds
          200: '#ebebce', // Darker cream for borders, hovers
          300: '#dedeb9',
          400: '#b8b894',
          500: '#919173',
          600: '#6e6e56',
          700: '#4c4c3e',
          800: '#2b2b25',
          900: '#A0522D', // EXACT MATCH: Sienna Brown (can be used for deep backgrounds)
          950: '#2b1005', // Ultra dark warm brown for pure dark mode
        },
        brand: {
          50: '#fdf2f0',
          100: '#fadeD6',
          200: '#f8b9a9',
          300: '#F4A460', // EXACT MATCH: Sandy Brown (Soft accent)
          400: '#eb795f',
          500: '#E35336', // EXACT MATCH: Burnt Sienna (Primary accent)
          600: '#c53c21',
          700: '#9b2c15',
          800: '#a0522d', // EXACT MATCH: Sienna Brown mapped into deep brand contexts
          900: '#4d1408',
          950: '#270802',
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      boxShadow: {
        'soft': '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.03)',
        'premium': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.03)',
        'floating': '0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -4px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0,0,0,0.02)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
