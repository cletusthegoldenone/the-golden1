'use client';

import Image from 'next/image';
import Link from 'next/link';

/**
 * Shared layout for every Cletus page.
 * Rules: black background, logo on every page.
 */
export default function AppShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/cletus-logo.png"
              alt="Cletus"
              width={40}
              height={40}
              className="object-contain"
              priority
            />
            <div>
              <div className="font-bold text-lg tracking-tight leading-none">Cletus</div>
              {subtitle && (
                <div className="text-xs text-white/50 mt-0.5">{subtitle}</div>
              )}
            </div>
          </Link>
          {title && (
            <div className="ml-auto text-sm text-white/60 font-medium">{title}</div>
          )}
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-2xl">{children}</div>
      </main>
    </div>
  );
}
