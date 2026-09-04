"use server";

import { revalidatePath } from "next/cache";

import {
  AuthorizationError,
  requireClubOwnerRole,
} from "@/lib/auth/access";
import {
  createSupabaseAdminClient,
  PRODUCT_PHOTOS_BUCKET,
} from "@/lib/supabase/admin";
import { clubProfileSchema } from "@/modules/clubs/domain/club-profile-schema";
import {
  getClubProfile,
  setClubLogoUrl,
  updateClubProfile,
} from "@/modules/clubs/infrastructure/club-profile";

function revalidate(clubSlug: string) {
  revalidatePath(`/${clubSlug}/control-usuarios/club`);
  revalidatePath(`/${clubSlug}/torneos`);
}

export async function saveClubProfileAction(
  clubSlug: string,
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const access = await requireClubOwnerRole(clubSlug);
    const parsed = clubProfileSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    await updateClubProfile(access.club.id, {
      name: parsed.data.name,
      locality: parsed.data.locality?.trim() || null,
      address: parsed.data.address?.trim() || null,
    });
    revalidate(clubSlug);
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "No se pudo guardar" };
  }
}

export async function uploadClubLogoAction(
  clubSlug: string,
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const access = await requireClubOwnerRole(clubSlug);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Elegí una imagen" };
    }
    if (!file.type.startsWith("image/")) {
      return { ok: false, error: "El archivo debe ser una imagen" };
    }
    if (file.size > 5 * 1024 * 1024) {
      return { ok: false, error: "La imagen supera 5MB" };
    }

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `clubs/${access.club.id}/logo-${Date.now()}.${ext}`;
    const admin = createSupabaseAdminClient();
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error } = await admin.storage
      .from(PRODUCT_PHOTOS_BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: true });
    if (error) return { ok: false, error: error.message };

    const { data } = admin.storage.from(PRODUCT_PHOTOS_BUCKET).getPublicUrl(path);
    await setClubLogoUrl(access.club.id, data.publicUrl);
    revalidate(clubSlug);
    return { ok: true, url: data.publicUrl };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "No se pudo subir el logo" };
  }
}

export async function removeClubLogoAction(
  clubSlug: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const access = await requireClubOwnerRole(clubSlug);
    await setClubLogoUrl(access.club.id, null);
    revalidate(clubSlug);
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "No se pudo quitar el logo" };
  }
}

export async function getClubProfileAction(clubSlug: string) {
  const access = await requireClubOwnerRole(clubSlug);
  return getClubProfile(access.club.id);
}
