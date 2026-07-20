import { notFound } from "next/navigation";
import CheckoutClient from "./CheckoutClient";
import { getLatestPaymentForOrder, getOrderByToken, listEnabledProvidersForOrder, listPaymentsForOrder } from "@/app/lib/payments/service";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getOrderByToken(token);
  if (!order) notFound();

  return (
    <CheckoutClient
      order={order}
      providers={await listEnabledProvidersForOrder(order)}
      payments={await listPaymentsForOrder(order.id)}
      latestPayment={await getLatestPaymentForOrder(order.id)}
    />
  );
}
