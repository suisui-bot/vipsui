import { NextResponse } from "next/server";
import { createAdminSession, verifyPassword } from "@/app/lib/admin-auth";
import { databaseEnabled, prisma } from "@/app/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const next = String(form.get("next") || "/admin/dashboard");

  if (!databaseEnabled) {
    return NextResponse.redirect(new URL(`/admin/login?error=${encodeURIComponent("Admin login requires DATABASE_URL.")}`, request.url));
  }

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin || !admin.active || !verifyPassword(password, admin.passwordHash)) {
    return NextResponse.redirect(new URL(`/admin/login?error=${encodeURIComponent("Invalid email or password.")}`, request.url));
  }

  await createAdminSession(admin.id);
  return NextResponse.redirect(new URL(next, request.url));
}
