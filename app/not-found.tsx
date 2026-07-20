import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-6 text-[#1d1d1f]">
      <div className="text-center">
        <p className="mb-3 text-sm font-semibold tracking-[0.28em] text-[#6e6e73]">404</p>
        <h1 className="mb-4 text-3xl font-semibold">This page is unavailable.</h1>
        <Link href="/shop" className="text-[#0066cc] underline underline-offset-4">
          Return to the catalog
        </Link>
      </div>
    </main>
  );
}
