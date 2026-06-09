import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          // Colores extraídos directamente del PowerPoint
          navy: '#14233A',       // fondo oscuro de header
          'navy-mid': '#1C2F4A', // fondo intermedio
          'navy-light': '#2A3F5C',
          blue: '#1E293B',       // texto oscuro principal
          gold: '#C9A227',       // acento dorado (PPT exacto)
          'gold-light': '#E8C97A',
          'gold-dark': '#A07C1E',
          bg: '#F4F6F8',         // fondo general de slides
          'bg-card': '#E7ECEA',  // fondo de tarjetas
          slate: '#64748B',
          'slate-light': '#94A3B8',
          red: '#c0392b',
          green: '#27ae60',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'sold-flash': 'sold-flash 0.8s ease-in-out 3',
        'bid-pulse': 'bid-pulse 0.4s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
      },
      keyframes: {
        'sold-flash': {
          '0%, 100%': { backgroundColor: 'rgb(39 174 96 / 0.1)' },
          '50%': { backgroundColor: 'rgb(39 174 96 / 0.4)' },
        },
        'bid-pulse': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.04)' },
          '100%': { transform: 'scale(1)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
