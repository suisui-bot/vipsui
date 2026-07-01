import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-stone-100">
      <div className="text-center">
        <p className="mb-3 text-sm uppercase tracking-[0.4em] text-amber-400">404</p>
        <h1 className="mb-4 text-3xl font-semibold">The requested watch is unavailable.</h1>
        <Link href="/" className="text-amber-400 underline underline-offset-4">
          Return to the collection
        </Link>
      </div>
    </main>
  );
}
