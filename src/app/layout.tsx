import { identity } from '@/lib/copy';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Toaster } from 'sonner';
import '@/styles/globals.css';

const spaceGrotesk = localFont({
  src: './fonts/SpaceGrotesk-Variable.woff2',
  variable: '--font-space-grotesk',
  weight: '300 700',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'CHILE2 — Laboratorio de futuros', template: '%s | CHILE2' },
  description: identity.description,
  keywords: ['CHILE2', 'comunidades', 'agentes', 'laboratorio de futuros', 'inteligencia colectiva'],
  authors: [{ name: identity.name }],
  creator: identity.name,
  metadataBase: new URL('https://chile2.cl'),
  openGraph: {
    type: 'website',
    locale: 'es_CL',
    url: 'https://chile2.cl',
    siteName: identity.name,
    title: 'CHILE2 — Laboratorio de futuros',
    description: identity.description,

  },
  twitter: { card: 'summary_large_image', title: identity.name, description: identity.headline },
  icons: { icon: '/icon.svg' },
  manifest: '/site.webmanifest',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="bottom-right" closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
