import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { RootProvider } from 'fumadocs-ui/provider/next';
import PlausibleProvider from 'next-plausible';

import './global.css';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://nexasign.nexastack.co/docs'),
  title: {
    template: '%s | NexaSign Docs',
    default: 'NexaSign Docs',
  },
  description:
    'The official documentation for NexaSign, the open-source document signing platform.',
  openGraph: {
    siteName: 'NexaSign Docs',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@nexasign',
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <PlausibleProvider domain="nexastack.co">
          <RootProvider>{children}</RootProvider>
        </PlausibleProvider>
      </body>
    </html>
  );
}
