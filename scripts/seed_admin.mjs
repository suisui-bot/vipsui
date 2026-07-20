import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();

function randomId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(8).toString("hex")}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const digest = crypto.pbkdf2Sync(password, salt, 210000, 64, "sha512").toString("hex");
  return `pbkdf2_sha512$210000$${salt}$${digest}`;
}

const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || "";
const name = process.env.ADMIN_NAME || "VIPSUI Admin";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

if (!email || !password) {
  throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
}

await prisma.adminUser.upsert({
  where: { email },
  update: {
    name,
    passwordHash: hashPassword(password),
    active: true,
  },
  create: {
    id: randomId("admin"),
    email,
    name,
    passwordHash: hashPassword(password),
    role: "admin",
    active: true,
  },
});

console.log(`Admin user ready: ${email}`);
await prisma.$disconnect();
