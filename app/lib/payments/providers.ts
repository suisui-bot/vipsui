import type { PaymentProvider, PaymentProviderName } from "./types";

const now = new Date().toISOString();

function maskSecret(value?: string) {
  if (!value) return "Not configured";
  if (value.length <= 8) return "****";
  return `${value.slice(0, 7)}****${value.slice(-4)}`;
}

function countryCodes(countries: string) {
  return countries
    .split(",")
    .map((country) => country.trim())
    .filter(Boolean);
}

export function defaultPaymentProviders(): PaymentProvider[] {
  const paypalConfigured = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  const zelleRecipient = process.env.ZELLE_RECIPIENT_EMAIL || process.env.ZELLE_RECIPIENT_PHONE;
  const zelleConfigured = Boolean(zelleRecipient);

  return [
    {
      provider_name: "paypal",
      provider_type: "wallet",
      enabled: process.env.PAYPAL_ENABLED !== "false" && paypalConfigured,
      display_name: "PayPal",
      description: "Pay securely with PayPal.",
      payment_instructions: "Complete your payment in PayPal. We verify every payment on the server before marking an order paid.",
      supports_auto_confirmation: true,
      supports_refund: true,
      supports_webhook: true,
      environment: process.env.PAYPAL_ENV === "live" || process.env.PAYPAL_ENV === "production" ? "production" : "sandbox",
      configuration_status: paypalConfigured ? "configured" : "missing_configuration",
      allowed_countries: countryCodes(process.env.PAYPAL_ALLOWED_COUNTRIES || "ALL"),
      public_config: {},
      secret_preview: {
        PAYPAL_CLIENT_ID: maskSecret(process.env.PAYPAL_CLIENT_ID),
        PAYPAL_CLIENT_SECRET: maskSecret(process.env.PAYPAL_CLIENT_SECRET),
        PAYPAL_WEBHOOK_ID: maskSecret(process.env.PAYPAL_WEBHOOK_ID),
      },
      created_at: now,
      updated_at: now,
    },
    {
      provider_name: "stripe",
      provider_type: "card",
      enabled: process.env.STRIPE_ENABLED === "true" && stripeConfigured,
      display_name: "Credit / Debit Card",
      description: "Visa, Mastercard and American Express through a certified payment gateway.",
      payment_instructions:
        "Card payments must be processed by Stripe Checkout, Stripe Payment Element, Airwallex, or another certified PSP. VIPSUI never stores card numbers or CVV.",
      supports_auto_confirmation: true,
      supports_refund: true,
      supports_webhook: true,
      environment: stripeConfigured ? "sandbox" : "not_configured",
      configuration_status: stripeConfigured ? "configured" : "missing_configuration",
      allowed_countries: countryCodes(process.env.CARD_ALLOWED_COUNTRIES || "ALL"),
      public_config: {
        supported_cards: ["Visa", "Mastercard", "American Express"],
      },
      secret_preview: {
        STRIPE_SECRET_KEY: maskSecret(process.env.STRIPE_SECRET_KEY),
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: maskSecret(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
        STRIPE_WEBHOOK_SECRET: maskSecret(process.env.STRIPE_WEBHOOK_SECRET),
      },
      created_at: now,
      updated_at: now,
    },
    {
      provider_name: "zelle",
      provider_type: "manual",
      enabled: process.env.ZELLE_ENABLED !== "false" && zelleConfigured,
      display_name: "Zelle",
      description: "Pay using Zelle from your U.S. bank account.",
      payment_instructions:
        process.env.ZELLE_PAYMENT_INSTRUCTIONS ||
        "Please send the exact order amount using Zelle. Include your Order Number in the memo.",
      supports_auto_confirmation: false,
      supports_refund: false,
      supports_webhook: false,
      environment: "manual",
      configuration_status: zelleConfigured ? "manual_ready" : "missing_configuration",
      allowed_countries: countryCodes(process.env.ZELLE_ALLOWED_COUNTRIES || "United States,US,USA"),
      public_config: {
        recipient_name: process.env.ZELLE_RECIPIENT_NAME || "VIPSUI",
        recipient_email: process.env.ZELLE_RECIPIENT_EMAIL || "",
        recipient_phone: process.env.ZELLE_RECIPIENT_PHONE || "",
        show_email: Boolean(process.env.ZELLE_RECIPIENT_EMAIL),
        show_phone: Boolean(process.env.ZELLE_RECIPIENT_PHONE),
        customer_message:
          process.env.ZELLE_CUSTOMER_MESSAGE ||
          "Please send the exact order amount using Zelle. Please include your Order Number in the memo. Your order will be processed after payment is confirmed.",
      },
      created_at: now,
      updated_at: now,
    },
  ];
}

export function providerAvailableForCountry(provider: PaymentProvider, country: string) {
  const allowed = provider.allowed_countries.map((item) => item.toLowerCase());
  if (allowed.includes("all")) return true;
  const normalized = country.trim().toLowerCase();
  return allowed.includes(normalized);
}

export function getProviderDisplayOrder(name: PaymentProviderName) {
  return name === "paypal" ? 1 : name === "stripe" ? 2 : name === "zelle" ? 3 : 9;
}
