// © 2026 WiamApp. Powered by WiamLabs
import { Manrope, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600', '700', '800'] });
const inter = Inter({ subsets: ['latin'], variable: '--font-body', weight: ['400', '500', '600'] });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['500'] });

export const metadata = {
  title: 'WiamApp Business',
  description: 'Manage your team, bookings, and billing on WiamApp.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${inter.variable} ${jetbrainsMono.variable} font-body bg-paper text-ink antialiased`}>
        {children}
      </body>
    </html>
  );
}
