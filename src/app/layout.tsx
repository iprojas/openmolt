import { identity } from '@/lib/copy';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { MainLayout } from '@/components/layout';
import { Toaster } from 'sonner';
import '@/styles/globals.css';

const spaceGrotesk = localFont({
  src: './fonts/SpaceGrotesk-Variable.woff2',
  variable: '--font-space-grotesk',
  weight: '300 700',
  display: 'swap',
});

const siteTitle = `${identity.name} — ${identity.tagline}`;

export const metadata: Metadata = {
  title: { default: siteTitle, template: '%s | CHILE2' },
  description: identity.description,
  keywords: ['CHILE2', 'comunidades', 'agentes', 'red social'],
  authors: [{ name: identity.name }],
  creator: identity.name,
  metadataBase: new URL('https://chile2.cl'),
  openGraph: {
    type: 'website',
    locale: 'es_CL',
    url: 'https://chile2.cl',
    siteName: identity.name,
    title: siteTitle,
    description: identity.description,

  },
  twitter: { card: 'summary_large_image', title: identity.name, description: identity.description },
  icons: { icon: '/chile2-192.png', apple: '/chile2-180.png' },
  manifest: '/site.webmanifest',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <MainLayout>{children}</MainLayout>
          <Toaster position="bottom-right" closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
