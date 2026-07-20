import { headers } from "next/headers";

const paypalBaseUrl = () =>
  process.env.PAYPAL_ENV === "live" || process.env.PAYPAL_ENV === "production" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

export async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error("PayPal is not configured.");

  const response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`PayPal access token failed: ${response.status}`);
  }
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export async function createPayPalOrder(orderNumber: string, amount: number, currency: string, idempotencyKey: string, checkoutToken: string) {
  const accessToken = await getPayPalAccessToken();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vipsui.vercel.app";
  const response = await fetch(`${paypalBaseUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": idempotencyKey,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      application_context: {
        brand_name: "VIPSUI",
        landing_page: "LOGIN",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        return_url: `${siteUrl}/checkout/${checkoutToken}?paypal=approved`,
        cancel_url: `${siteUrl}/checkout/${checkoutToken}?paypal=cancelled`,
      },
      purchase_units: [
        {
          reference_id: orderNumber,
          invoice_id: orderNumber,
          custom_id: orderNumber,
          amount: {
            currency_code: currency,
            value: amount.toFixed(2),
          },
        },
      ],
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`PayPal create order failed: ${response.status}`);
  }
  return response.json() as Promise<{ id: string; status: string; links?: Array<{ href: string; rel: string; method: string }> }>;
}

export async function capturePayPalOrder(paypalOrderId: string, idempotencyKey: string) {
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${paypalBaseUrl()}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": idempotencyKey,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`PayPal capture failed: ${response.status}`);
  }
  return response.json() as Promise<{
    id: string;
    status: string;
    purchase_units?: Array<{
      payments?: { captures?: Array<{ id: string; status: string; amount: { value: string; currency_code: "USD" } }> };
    }>;
  }>;
}

export async function verifyPayPalWebhook(rawBody: string) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error("PAYPAL_WEBHOOK_ID is not configured.");
  const headerList = await headers();
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${paypalBaseUrl()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: headerList.get("paypal-auth-algo"),
      cert_url: headerList.get("paypal-cert-url"),
      transmission_id: headerList.get("paypal-transmission-id"),
      transmission_sig: headerList.get("paypal-transmission-sig"),
      transmission_time: headerList.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody),
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`PayPal webhook verification failed: ${response.status}`);
  }
  const data = (await response.json()) as { verification_status: string };
  return data.verification_status === "SUCCESS";
}
