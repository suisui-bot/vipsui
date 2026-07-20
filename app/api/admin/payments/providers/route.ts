import { NextRequest, NextResponse } from "next/server";
import { assertAdminApiRequest } from "@/app/lib/admin-auth";
import { listPaymentProviders, updateProvider } from "@/app/lib/payments/service";
import type { PaymentProviderName } from "@/app/lib/payments/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ providers: await listPaymentProviders() });
}

export async function PATCH(request: NextRequest) {
  try {
    await assertAdminApiRequest(request);
    const body = (await request.json()) as {
      provider_name?: PaymentProviderName;
      enabled?: boolean;
      display_name?: string;
      description?: string;
      payment_instructions?: string;
      allowed_countries?: string[];
    };
    if (!body.provider_name) return NextResponse.json({ error: "Missing provider name" }, { status: 400 });
    const provider = await updateProvider(body.provider_name, {
      enabled: body.enabled,
      display_name: body.display_name,
      description: body.description,
      payment_instructions: body.payment_instructions,
      allowed_countries: body.allowed_countries,
    });
    if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    return NextResponse.json({ provider });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update provider" }, { status: 401 });
  }
}
