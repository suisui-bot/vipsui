import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { databaseEnabled, prisma } from "./db/prisma";

const sessionCookie = "vipsui_admin_session";
const sessionDays = 7;

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(8).toString("hex")}`;
}

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const digest = crypto.pbkdf2Sync(password, salt, 210000, 64, "sha512").toString("hex");
  return `pbkdf2_sha512$210000$${salt}$${digest}`;
}

export function verifyPassword(password: string, encoded: string) {
  const [algorithm, iterationsRaw, salt, digest] = encoded.split("$");
  if (algorithm !== "pbkdf2_sha512" || !iterationsRaw || !salt || !digest) return false;
  const candidate = crypto.pbkdf2Sync(password, salt, Number(iterationsRaw), 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(digest, "hex"));
}

export async function createAdminSession(userId: string) {
  if (!databaseEnabled) {
    throw new Error("Admin login requires DATABASE_URL.");
  }
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);
  await prisma.adminSession.create({
    data: {
      id: randomId("sess"),
      userId,
      tokenHash: hash(token),
      expiresAt,
    },
  });
  const cookieStore = await cookies();
  cookieStore.set(sessionCookie, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getAdminUserFromCookie() {
  if (!databaseEnabled) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookie)?.value;
  if (!token) return null;
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date() || !session.user.active) return null;
  return session.user;
}

export async function requireAdminUser() {
  const user = await getAdminUserFromCookie();
  if (!user) throw new Error("Admin login required.");
  return user;
}

export async function logoutAdmin() {
  if (!databaseEnabled) return;
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookie)?.value;
  if (token) {
    await prisma.adminSession.updateMany({
      where: { tokenHash: hash(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  cookieStore.delete(sessionCookie);
}

export async function assertAdminApiRequest(request: NextRequest) {
  if (!databaseEnabled) {
    const configuredKey = process.env.ADMIN_API_KEY;
    const providedKey = request.headers.get("x-admin-key") || "";
    if (configuredKey && providedKey === configuredKey) return process.env.ADMIN_USER || "admin";
    if (!configuredKey && process.env.NODE_ENV !== "production") return "local-admin";
    throw new Error("Admin authorization required.");
  }

  const cookieHeader = request.headers.get("cookie") || "";
  const token = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${sessionCookie}=`))
    ?.split("=")[1];
  if (!token) throw new Error("Admin login required.");
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hash(decodeURIComponent(token)) },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date() || !session.user.active) {
    throw new Error("Admin login required.");
  }
  return session.user.email;
}
