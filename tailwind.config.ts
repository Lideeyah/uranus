import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/context/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        base: '#0B0B0C',
        surface: '#141416',
        border: '#232326',
        hi: '#EDEDEF',
        muted: '#A1A1AA',
        meta: '#71717A',
        // extended zinc tokens for tags / secondary buttons
        tagbg: '#1F1F23',
        tagtext: '#D4D4D8',
        tagborder: '#2E2E33',
        borderhover: '#323238',
        // functional accents (used sparingly)
        emerald: '#10B981',
        rose: '#F43F5E',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        panel: '0 0 0 1px #232326, 0 20px 60px -20px rgba(0,0,0,0.7)',
      },
    },
  },
  plugins: [],
};

export default config;
