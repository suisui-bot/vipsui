import Link from "next/link";
import { redirect } from "next/navigation";
import PaymentSettingsClient from "./PaymentSettingsClient";
import { adminLockedMessage } from "@/app/lib/payments/admin";
import { getAdminUserFromCookie } from "@/app/lib/admin-auth";
import { listPaymentProviders } from "@/app/lib/payments/service";
import { databaseEnabled } from "@/app/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function PaymentSettingsPage() {
  const admin = await getAdminUserFromCookie();
  if (databaseEnabled && !admin) redirect("/admin/login?next=/admin/settings/payments");
  return (
    <main className="min-h-screen bg-[#f5f5f7] px-4 py-8 text-[#1d1d1f] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium uppercase text-[#6e6e73]">Admin Settings</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Payments</h1>
          </div>
          <Link href="/admin/dashboard" className="rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-semibold text-white">
            Dashboard
          </Link>
        </div>
        {adminLockedMessage() && <p className="mt-5 rounded-3xl bg-[#fff8e5] p-4 text-sm text-[#6e5a21]">{adminLockedMessage()}</p>}
        <PaymentSettingsClient providers={await listPaymentProviders()} adminLoggedIn={Boolean(admin)} databaseEnabled={databaseEnabled} />
      </div>
    </main>
  );
}
