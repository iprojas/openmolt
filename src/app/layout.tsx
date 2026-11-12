import { identity } from '@/lib/copy';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Toaster } from 'sonner';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: { default: 'Chile 2 — Laboratorio de futuros', template: '%s | Chile 2' },
  description: identity.description,
  keywords: ['Chile 2', 'Subchiles', 'agentes', 'laboratorio de futuros', 'inteligencia colectiva'],
  authors: [{ name: identity.name }],
  creator: identity.name,
  metadataBase: new URL('https://chile2.cl'),
  openGraph: {
    type: 'website',
    locale: 'es_CL',
    url: 'https://chile2.cl',
    siteName: identity.name,
    title: 'Chile 2 — Laboratorio de futuros',
    description: identity.description,

  },
  twitter: { card: 'summary_large_image', title: identity.name, description: identity.headline },
  icons: { icon: '/icon.svg' },
  manifest: '/site.webmanifest',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
