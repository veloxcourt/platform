"use server";

import { redirect } from "next/navigation";

import { DEFAULT_PHONE_DIAL, normalizeToE164 } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RegisterState = { error?: string };

function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export async function registerPlayerAction(
  _previousState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const next = safeNextPath(String(formData.get("next") ?? "").trim() || null);

  if (!email || !password) {
    return { error: "Ingresá email y contraseña." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (!firstName || !lastName) {
    return { error: "Ingresá nombre y apellido." };
  }

  const phone = normalizeToE164(phoneRaw, DEFAULT_PHONE_DIAL);
  if (!phone) {
    return { error: "Teléfono inválido." };
  }

  const fullName = `${firstName} ${lastName}`.trim();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error || !data.user) {
    const message = error?.message?.toLowerCase() ?? "";
    if (message.includes("already") || message.includes("registered")) {
      return { error: "Ese email ya tiene una cuenta. Ingresá con tu contraseña." };
    }
    return { error: error?.message ?? "No se pudo crear la cuenta." };
  }

  const authUserId = data.user.id;

  const existingByEmail = await prisma.user.findFirst({
    where: { email },
  });
  const existingByAuth = await prisma.user.findFirst({
    where: { authUserId },
  });

  if (existingByAuth) {
    await prisma.user.update({
      where: { id: existingByAuth.id },
      data: {
        email,
        firstName,
        lastName,
        fullName,
        ...(phone ? { phone } : {}),
      },
    });
  } else if (existingByEmail) {
    if (existingByEmail.authUserId && existingByEmail.authUserId !== authUserId) {
      await supabase.auth.signOut();
      return { error: "Ese email ya está vinculado a otra cuenta." };
    }
    await prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        authUserId,
        firstName: existingByEmail.firstName || firstName,
        lastName: existingByEmail.lastName || lastName,
        fullName: existingByEmail.fullName || fullName,
        ...(phone && !existingByEmail.phone ? { phone } : {}),
      },
    });
  } else {
    await prisma.user.create({
      data: {
        authUserId,
        email,
        firstName,
        lastName,
        fullName,
        phone,
      },
    });
  }

  redirect(next ?? "/cuenta");
}
