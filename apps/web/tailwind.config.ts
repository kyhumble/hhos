import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#b9ddfe',
          300: '#7cc2fd',
          400: '#36a4f9',
          500: '#0c89ea',
          600: '#006bc8',
          700: '#0155a2',
          800: '#064986',
          900: '#0b3d6f',
          950: '#07274a',
        },
        ink: {
          50: '#f7f8fa',
          100: '#eef0f4',
          200: '#d9dde6',
          300: '#b8c0cf',
          400: '#919db3',
          500: '#73819a',
          600: '#5d6a82',
          700: '#4c5669',
          800: '#424a59',
          900: '#3a404c',
          950: '#262a33',
        },
        canvas: {
          DEFAULT: '#f3f5f8',
          soft: '#f8f9fb',
        },
      },
      fontFamily: {
        sans: [
          'var(--font-sans)',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        display: [
          'var(--font-display)',
          'var(--font-sans)',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.04)',
        card: '0 1px 0 rgba(15, 23, 42, 0.03), 0 8px 28px -10px rgba(15, 23, 42, 0.12)',
        lift: '0 12px 40px -16px rgba(15, 23, 42, 0.18)',
        glow: '0 0 0 1px rgba(12, 137, 234, 0.12), 0 8px 24px -8px rgba(12, 137, 234, 0.35)',
        sidebar: '4px 0 24px -8px rgba(7, 39, 74, 0.35)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      backgroundImage: {
        'mesh-light':
          'radial-gradient(ellipse 90% 60% at 0% -10%, rgba(12, 137, 234, 0.09), transparent 50%), radial-gradient(ellipse 70% 50% at 100% 0%, rgba(1, 85, 162, 0.06), transparent 45%), radial-gradient(ellipse 50% 40% at 50% 100%, rgba(16, 185, 129, 0.04), transparent)',
        'sidebar-lux':
          'linear-gradient(165deg, #07274a 0%, #0b3d6f 42%, #0155a2 100%)',
        'hero-shine':
          'linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 45%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s ease-out both',
        shimmer: 'shimmer 2.5s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
