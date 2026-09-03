'use client';

import Image from 'next/image';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <Image
          src="/cletus-logo.png"
          alt="Cletus"
          width={72}
          height={72}
          className="mx-auto mb-5 object-contain"
          priority
        />
        <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
        <p className="mt-3 text-sm text-white/60">
          The page hit an error, but the app is still available. Try again and continue.
        </p>
        {error?.digest && (
          <p className="mt-3 text-xs font-mono text-white/35">Error: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
        >
          Reload page
        </button>
      </div>
    </div>
  );
}
