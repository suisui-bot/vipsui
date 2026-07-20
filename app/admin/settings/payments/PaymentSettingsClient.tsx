"use client";

import { useState } from "react";
import type { PaymentProvider } from "@/app/lib/payments/types";

function joinCountries(provider: PaymentProvider) {
  return provider.allowed_countries.join(", ");
}

export default function PaymentSettingsClient({
  providers: initialProviders,
  adminLoggedIn,
  databaseEnabled,
}: {
  providers: PaymentProvider[];
  adminLoggedIn: boolean;
  databaseEnabled: boolean;
}) {
  const [providers, setProviders] = useState(initialProviders);
  const [adminKey, setAdminKey] = useState("");
  const [notice, setNotice] = useState("");

  async function toggleProvider(provider: PaymentProvider) {
    setNotice("");
    const response = await fetch("/api/admin/payments/providers", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey,
      },
      body: JSON.stringify({
        provider_name: provider.provider_name,
        enabled: !provider.enabled,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setNotice(data.error || "Unable to update payment provider.");
      return;
    }
    setProviders((items) => items.map((item) => (item.provider_name === data.provider.provider_name ? data.provider : item)));
    setNotice(`${data.provider.display_name} updated.`);
  }

  return (
    <div className="mt-8">
      <label className="block rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#d2d2d7]/70">
        <span className="text-sm font-semibold">{databaseEnabled ? "Admin Session" : "Admin API Key"}</span>
        <input
          value={adminKey}
          onChange={(event) => setAdminKey(event.target.value)}
          placeholder={databaseEnabled ? (adminLoggedIn ? "Logged in with secure session" : "Login required") : "Required in production"}
          disabled={databaseEnabled}
          className="mt-3 w-full rounded-2xl border border-[#d2d2d7] px-4 py-3 text-sm outline-none focus:border-[#1d1d1f]"
        />
      </label>

      {notice && <p className="mt-5 rounded-3xl bg-white p-4 text-sm text-[#6e6e73] ring-1 ring-[#d2d2d7]/70">{notice}</p>}

      <div className="mt-6 grid gap-5">
        {providers.map((provider) => (
          <section key={provider.provider_name} className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-[#d2d2d7]/70">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium uppercase text-[#6e6e73]">{provider.provider_type}</p>
                <h2 className="mt-1 text-2xl font-semibold">{provider.display_name}</h2>
                <p className="mt-2 max-w-2xl text-sm text-[#6e6e73]">{provider.description}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleProvider(provider)}
                disabled={databaseEnabled && !adminLoggedIn}
                className={`rounded-full px-5 py-3 text-sm font-semibold ${provider.enabled ? "bg-[#1d1d1f] text-white" : "bg-[#f5f5f7] text-[#1d1d1f]"}`}
              >
                {provider.enabled ? "Enabled" : "Disabled"}
              </button>
            </div>

            <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-3xl bg-[#f5f5f7] p-4">
                <p className="text-[#6e6e73]">Environment</p>
                <p className="mt-1 font-semibold capitalize">{provider.environment.replace("_", " ")}</p>
              </div>
              <div className="rounded-3xl bg-[#f5f5f7] p-4">
                <p className="text-[#6e6e73]">Configuration Status</p>
                <p className="mt-1 font-semibold capitalize">{provider.configuration_status.replace("_", " ")}</p>
              </div>
              <div className="rounded-3xl bg-[#f5f5f7] p-4">
                <p className="text-[#6e6e73]">Allowed Countries</p>
                <p className="mt-1 font-semibold">{joinCountries(provider)}</p>
              </div>
              <div className="rounded-3xl bg-[#f5f5f7] p-4">
                <p className="text-[#6e6e73]">Automation</p>
                <p className="mt-1 font-semibold">{provider.supports_auto_confirmation ? "Auto confirmation" : "Manual verification"}</p>
              </div>
            </div>

            <div className="mt-5 rounded-3xl bg-[#f5f5f7] p-4 text-sm">
              <p className="font-semibold">Instructions</p>
              <p className="mt-2 text-[#6e6e73]">{provider.payment_instructions}</p>
            </div>

            {provider.secret_preview && (
              <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                {Object.entries(provider.secret_preview).map(([key, value]) => (
                  <div key={key} className="rounded-3xl border border-[#d2d2d7] p-4">
                    <p className="text-[#6e6e73]">{key}</p>
                    <p className="mt-1 font-mono text-xs">{value}</p>
                  </div>
                ))}
              </div>
            )}

            {provider.provider_name === "zelle" && (
              <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-3xl border border-[#d2d2d7] p-4">
                  <p className="text-[#6e6e73]">Recipient Name</p>
                  <p className="mt-1 font-semibold">{String(provider.public_config.recipient_name || "Not configured")}</p>
                </div>
                <div className="rounded-3xl border border-[#d2d2d7] p-4">
                  <p className="text-[#6e6e73]">Recipient Email</p>
                  <p className="mt-1 font-semibold">{String(provider.public_config.recipient_email || "Not configured")}</p>
                </div>
                <div className="rounded-3xl border border-[#d2d2d7] p-4">
                  <p className="text-[#6e6e73]">Recipient Phone</p>
                  <p className="mt-1 font-semibold">{String(provider.public_config.recipient_phone || "Not configured")}</p>
                </div>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
