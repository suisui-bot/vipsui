"use client";

import { useMemo, useState } from "react";
import type { PricingSettings } from "@/app/lib/pricing/settings";

type NumericField = Exclude<keyof PricingSettings, "scope" | "paymentFeeModel" | "updatedAt">;

const fields: Array<{ key: NumericField; label: string; suffix: string; description: string; step: string }> = [
  { key: "shippingCostRMB", label: "Fixed Shipping RMB", suffix: "RMB", description: "Fixed Phase 1 shipping reserve per watch.", step: "1" },
  { key: "packagingCostRMB", label: "Packaging Cost RMB", suffix: "RMB", description: "Protective packaging and handling consumables.", step: "1" },
  { key: "paymentFeePercent", label: "Payment Fee", suffix: "%", description: "Reserve for PayPal, Stripe, card, or future PSP fees.", step: "0.1" },
  { key: "exchangeRateBufferPercent", label: "Exchange Rate Buffer", suffix: "%", description: "Reserve for currency movement and settlement differences.", step: "0.1" },
  { key: "riskReservePercent", label: "Risk Reserve", suffix: "%", description: "After-sales, refund, reshipment, logistics, and dispute reserve.", step: "0.1" },
  { key: "exchangeRateRMBPerUSD", label: "RMB/USD Exchange Rate", suffix: "RMB per USD", description: "Centralized exchange rate used for watch pricing.", step: "0.01" },
  { key: "profitMultiplier", label: "Profit Multiplier", suffix: "x", description: "Multiplier applied after operating reserves.", step: "0.01" },
];

export default function PricingSettingsClient({
  settings: initialSettings,
  adminLoggedIn,
  databaseEnabled,
}: {
  settings: PricingSettings;
  adminLoggedIn: boolean;
  databaseEnabled: boolean;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [draft, setDraft] = useState(initialSettings);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = databaseEnabled ? adminLoggedIn : true;

  const preview = useMemo(() => {
    const supplierCostRMB = 145;
    const baseCostRMB = supplierCostRMB + Number(draft.shippingCostRMB) + Number(draft.packagingCostRMB);
    const reserve = (Number(draft.paymentFeePercent) + Number(draft.exchangeRateBufferPercent) + Number(draft.riskReservePercent)) / 100;
    const adjustedCostRMB = baseCostRMB * (1 + reserve);
    const raw = (adjustedCostRMB * Number(draft.profitMultiplier)) / Number(draft.exchangeRateRMBPerUSD);
    const minimum = Math.ceil(raw);
    const final = Math.ceil((minimum + 1) / 10) * 10 - 1;
    return { baseCostRMB, adjustedCostRMB, raw, final };
  }, [draft]);

  function updateField(key: NumericField, value: string) {
    setDraft((current) => ({ ...current, [key]: Number(value) }));
  }

  async function saveSettings() {
    setSaving(true);
    setNotice("");
    const response = await fetch("/api/admin/pricing/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setNotice(data.error || "Unable to save pricing settings.");
      return;
    }
    setSettings(data.settings);
    setDraft(data.settings);
    setNotice("Watch pricing settings saved.");
  }

  return (
    <div className="mt-8 grid gap-6">
      {!databaseEnabled && (
        <p className="rounded-3xl bg-[#fff8e5] p-4 text-sm text-[#6e5a21]">
          DATABASE_URL is not configured. Settings are editable in the interface for local preview, but production persistence requires the database.
        </p>
      )}

      {notice && <p className="rounded-3xl bg-white p-4 text-sm text-[#6e6e73] ring-1 ring-[#d2d2d7]/70">{notice}</p>}

      <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-[#d2d2d7]/70">
        <div className="grid gap-5 sm:grid-cols-2">
          {fields.map((field) => (
            <label key={field.key} className="block rounded-3xl bg-[#f5f5f7] p-4">
              <span className="text-sm font-semibold">{field.label}</span>
              <span className="mt-1 block text-xs leading-5 text-[#6e6e73]">{field.description}</span>
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[#d2d2d7] bg-white px-4 py-3">
                <input
                  type="number"
                  step={field.step}
                  value={draft[field.key]}
                  onChange={(event) => updateField(field.key, event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                />
                <span className="text-xs font-medium text-[#6e6e73]">{field.suffix}</span>
              </div>
            </label>
          ))}
        </div>

        <div className="mt-5 rounded-3xl bg-[#f5f5f7] p-4 text-sm">
          <p className="font-semibold">Payment Fee Model</p>
          <p className="mt-2 text-[#6e6e73]">
            Current model: cost-based reserve. The pricing engine keeps this modular so it can later switch to a selling-price-based fee calculation.
          </p>
        </div>

        <div className="mt-5 grid gap-4 text-sm sm:grid-cols-4">
          <div className="rounded-3xl border border-[#d2d2d7] p-4">
            <p className="text-[#6e6e73]">Sample Base Cost</p>
            <p className="mt-1 font-semibold">{preview.baseCostRMB.toFixed(2)} RMB</p>
          </div>
          <div className="rounded-3xl border border-[#d2d2d7] p-4">
            <p className="text-[#6e6e73]">Adjusted Cost</p>
            <p className="mt-1 font-semibold">{preview.adjustedCostRMB.toFixed(2)} RMB</p>
          </div>
          <div className="rounded-3xl border border-[#d2d2d7] p-4">
            <p className="text-[#6e6e73]">Raw USD</p>
            <p className="mt-1 font-semibold">${preview.raw.toFixed(2)}</p>
          </div>
          <div className="rounded-3xl border border-[#d2d2d7] p-4">
            <p className="text-[#6e6e73]">Rounded USD</p>
            <p className="mt-1 font-semibold">${preview.final}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#6e6e73]">
            Last saved: {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : "Default settings"}
          </p>
          <button
            type="button"
            onClick={saveSettings}
            disabled={!canSave || saving}
            className="rounded-full bg-[#1d1d1f] px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#d2d2d7]"
          >
            {saving ? "Saving..." : "Save Pricing Settings"}
          </button>
        </div>
      </section>
    </div>
  );
}
