import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // S.I.N.A Design Tokens
        bg: {
          base:    '#070B12',
          surface: '#0D1321',
          raised:  '#111827',
          overlay: '#151F30',
        },
        border: {
          DEFAULT: '#1E2D47',
          subtle:  '#162135',
          bright:  '#2D4263',
        },
        text: {
          primary:   '#E2E8F0',
          secondary: '#94A3B8',
          muted:     '#4B5E7A',
          inverse:   '#070B12',
        },
        accent: {
          DEFAULT:  '#F59E0B',
          dim:      '#78450A',
          glow:     '#FCD34D',
          '50':  '#FFFBEB',
          '100': '#FEF3C7',
          '400': '#FBBF24',
          '500': '#F59E0B',
          '600': '#D97706',
          '700': '#B45309',
        },
        blue: {
          DEFAULT: '#3B82F6',
          dim:     '#1E3A5F',
          '400':   '#60A5FA',
          '500':   '#3B82F6',
          '600':   '#2563EB',
        },
        status: {
          online:  '#22C55E',
          warning: '#EAB308',
          error:   '#EF4444',
          offline: '#475569',
          info:    '#3B82F6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
      spacing: {
        sidebar: '15rem',
        'sidebar-sm': '3.5rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.15s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'glow-amber': '0 0 20px rgba(245, 158, 11, 0.15)',
        'glow-blue':  '0 0 20px rgba(59, 130, 246, 0.15)',
        card: '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};

export default config;
