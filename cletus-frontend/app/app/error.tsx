'use client';

export default function AppSectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">App section unavailable</h1>
        <p className="mt-3 text-sm text-white/60">
          This page crashed, but the rest of the app is still running.
        </p>
        {error?.digest && (
          <p className="mt-3 text-xs font-mono text-white/35">Error: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
