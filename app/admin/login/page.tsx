import Link from "next/link";
import { getAdminUserFromCookie } from "@/app/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const admin = await getAdminUserFromCookie();
  const next = params.next || "/admin/dashboard";

  return (
    <main className="min-h-screen bg-[#f5f5f7] px-4 py-10 text-[#1d1d1f] sm:px-6">
      <div className="mx-auto max-w-md rounded-[32px] bg-white p-6 shadow-sm ring-1 ring-[#d2d2d7]/70 sm:p-8">
        <Link href="/" className="text-sm font-semibold tracking-[0.28em]">
          VIPSUI
        </Link>
        <p className="mt-10 text-sm font-medium uppercase text-[#6e6e73]">Admin</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Sign in.</h1>
        {admin ? (
          <div className="mt-8">
            <p className="text-sm text-[#6e6e73]">You are already signed in as {admin.email}.</p>
            <Link href={next} className="mt-5 inline-flex rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-semibold text-white">
              Continue
            </Link>
          </div>
        ) : (
          <form action="/api/admin/login" method="post" className="mt-8 grid gap-4">
            <input type="hidden" name="next" value={next} />
            <label className="grid gap-2 text-sm font-semibold">
              Email
              <input name="email" type="email" required className="rounded-2xl border border-[#d2d2d7] px-4 py-3 text-sm outline-none focus:border-[#1d1d1f]" />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Password
              <input name="password" type="password" required className="rounded-2xl border border-[#d2d2d7] px-4 py-3 text-sm outline-none focus:border-[#1d1d1f]" />
            </label>
            {params.error && <p className="rounded-2xl bg-[#fff8e5] p-3 text-sm text-[#6e5a21]">{params.error}</p>}
            <button className="rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-semibold text-white">Sign In</button>
          </form>
        )}
      </div>
    </main>
  );
}
