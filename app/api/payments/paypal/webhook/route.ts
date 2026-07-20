import { NextResponse } from "next/server";
import { verifyPayPalWebhook } from "@/app/lib/payments/paypal";
import { hasProcessedWebhook, listOrders, markPayPalCompleted, rememberWebhook } from "@/app/lib/payments/service";

export const dynamic = "force-dynamic";

type PayPalWebhookEvent = {
  id: string;
  event_type: string;
  resource?: {
    id?: string;
    amount?: { value?: string; currency_code?: "USD" };
    supplementary_data?: { related_ids?: { order_id?: string } };
    invoice_id?: string;
    custom_id?: string;
  };
};

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const event = JSON.parse(rawBody) as PayPalWebhookEvent;
    if (!event.id) return NextResponse.json({ error: "Missing event ID" }, { status: 400 });
    if (await hasProcessedWebhook(event.id)) return NextResponse.json({ duplicate: true });

    const verified = await verifyPayPalWebhook(rawBody);
    if (!verified) return NextResponse.json({ error: "Invalid PayPal webhook signature" }, { status: 401 });
    await rememberWebhook(event.id, event as unknown as Record<string, unknown>);

    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const paypalOrderId = event.resource?.supplementary_data?.related_ids?.order_id;
      const captureId = event.resource?.id;
      const amount = Number(event.resource?.amount?.value || 0);
      const currency = event.resource?.amount?.currency_code || "USD";
      const order = (await listOrders()).find((item) => item.order_number === event.resource?.invoice_id || item.order_number === event.resource?.custom_id);
      if (order && paypalOrderId && captureId) {
        await markPayPalCompleted(order.id, paypalOrderId, captureId, amount, currency, event as unknown as Record<string, unknown>);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process PayPal webhook" }, { status: 400 });
  }
}
