import { NextResponse } from "next/server";
import { cancelPendingZelle, getOrderByToken } from "@/app/lib/payments/service";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const order = await getOrderByToken(token);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const payment = await cancelPendingZelle(order.id);
    return NextResponse.json({ payment });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to cancel Zelle payment" }, { status: 400 });
  }
}
