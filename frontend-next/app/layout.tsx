import Providers from '@/components/shell/Providers';
import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'OmniScale AI — Workspace', description: 'Build digital platforms and run AI-powered workflows.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><Providers>{children}</Providers></body></html>; }
