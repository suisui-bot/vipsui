import Link from "next/link";
import { redirect } from "next/navigation";
import PricingSettingsClient from "./PricingSettingsClient";
import { getAdminUserFromCookie } from "@/app/lib/admin-auth";
import { databaseEnabled } from "@/app/lib/db/prisma";
import { getPricingSettings } from "@/app/lib/pricing/settings";

export const dynamic = "force-dynamic";

export default async function PricingSettingsPage() {
  const admin = await getAdminUserFromCookie();
  if (databaseEnabled && !admin) redirect("/admin/login?next=/admin/settings/pricing");

  return (
    <main className="min-h-screen bg-[#f5f5f7] px-4 py-8 text-[#1d1d1f] sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase text-[#6e6e73]">Admin Settings</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Watch Pricing</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6e6e73]">
              Configure the internal cost reserve and USD conversion logic for Watches only. Customer pages only show the final USD price.
            </p>
          </div>
          <Link href="/admin/dashboard" className="shrink-0 rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-semibold text-white">
            Dashboard
          </Link>
        </div>
        <PricingSettingsClient settings={await getPricingSettings()} adminLoggedIn={Boolean(admin)} databaseEnabled={databaseEnabled} />
      </div>
    </main>
  );
}
