import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Padelclubbing | Dein Verein', description: 'Training, Turniere und Community – Padelclubbing Verein.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="de"><body>{children}</body></html>; }
