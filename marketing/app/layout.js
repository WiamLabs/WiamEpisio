// © 2026 WiamApp. Powered by WiamLabs
import { Manrope, Inter } from 'next/font/google';
import './globals.css';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600', '700', '800'] });
const inter = Inter({ subsets: ['latin'], variable: '--font-body', weight: ['400', '500', '600'] });

export const metadata = {
  title: { default: 'WiamApp — Find trusted, verified workers', template: '%s | WiamApp' },
  description: 'Book verified electricians, cleaners, plumbers, drivers, and more — trusted workers, real reviews, secure payment, built for Ghana and beyond.',
  metadataBase: new URL('https://wiamapp.com'),
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${inter.variable} font-body bg-white text-ink antialiased flex flex-col min-h-screen`}>
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
