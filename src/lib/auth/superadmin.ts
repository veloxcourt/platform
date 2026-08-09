import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

import {
  AuthenticationError,
  AuthorizationError,
  getCurrentUser,
  requireCurrentUser,
} from "./access";

function envSuperAdminEmails(): string[] {
  return (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function isSuperAdminUser(options: {
  userId: string;
  email?: string | null;
}) {
  const user = await prisma.user.findUnique({
    where: { id: options.userId },
    select: { isSuperAdmin: true, email: true },
  });
  if (!user) return false;
  if (user.isSuperAdmin) return true;

  const email = (options.email ?? user.email)?.toLowerCase();
  if (!email) return false;
  return envSuperAdminEmails().includes(email);
}

export const getSuperAdminAccess = cache(async () => {
  const current = await getCurrentUser();
  if (!current) return null;
  const allowed = await isSuperAdminUser({
    userId: current.user.id,
    email: current.user.email,
  });
  if (!allowed) return null;
  return current;
});

export async function requireSuperAdmin() {
  const current = await requireCurrentUser();
  const allowed = await isSuperAdminUser({
    userId: current.user.id,
    email: current.user.email,
  });
  if (!allowed) {
    throw new AuthorizationError("Solo el superadministrador puede hacer esto.");
  }
  return current;
}

export async function enforceSuperAdminPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login?next=/superadmin");
  const allowed = await isSuperAdminUser({
    userId: current.user.id,
    email: current.user.email,
  });
  if (!allowed) redirect("/");
  return current;
}

export { AuthenticationError, AuthorizationError };
