import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { WebMCPProvider } from '@/context/WebMCPContext';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Uranus · WebMCP Gateway',
  description:
    'Browser-native WebMCP security proxy and human-in-the-loop execution gateway for autonomous AI agents.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen bg-base text-hi antialiased">
        <WebMCPProvider>{children}</WebMCPProvider>
      </body>
    </html>
  );
}
