"use server";

import { revalidatePath } from "next/cache";

import {
  AuthenticationError,
  AuthorizationError,
  requireClubModuleAccess,
} from "@/lib/auth/access";
import { toModuleKeys } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getBookingRepository } from "@/modules/bookings/infrastructure/repository";
import {
  createSupabaseAdminClient,
  PRODUCT_PHOTOS_BUCKET,
} from "@/lib/supabase/admin";
import { exportCatalog } from "@/modules/catalog/application/export-catalog";
import {
  productSchema,
  productTypeSchema,
  type ProductValues,
  type ProductTypeValues,
} from "@/modules/catalog/domain/product-schema";
import type { SellableProduct } from "@/modules/catalog/domain/types";

type Result = { ok: true } | { ok: false; error: string };

async function resolveClubId(clubSlug: string) {
  await requireClubModuleAccess(clubSlug, "catalogo");
  const repo = getBookingRepository();
  const club = await repo.getClubBySlug(clubSlug);
  return { repo, clubId: club?.id ?? null };
}

function revalidate(clubSlug: string) {
  revalidatePath(`/${clubSlug}/catalogo`);
  revalidatePath(`/${clubSlug}/catalogo/menu`);
}

// --- Tipos de producto ---
export async function createProductTypeAction(
  clubSlug: string,
  values: ProductTypeValues,
): Promise<Result> {
  const parsed = productTypeSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Nombre inválido" };
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };
  await repo.createProductType(clubId, parsed.data.name);
  revalidate(clubSlug);
  return { ok: true };
}

export async function updateProductTypeAction(
  clubSlug: string,
  id: string,
  values: ProductTypeValues,
): Promise<Result> {
  const parsed = productTypeSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Nombre inválido" };
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };
  await repo.updateProductType(clubId, id, parsed.data.name);
  revalidate(clubSlug);
  return { ok: true };
}

export async function deleteProductTypeAction(
  clubSlug: string,
  id: string,
): Promise<Result> {
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };
  const result = await repo.deleteProductType(clubId, id);
  if (result.ok) revalidate(clubSlug);
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Error" };
}

// --- Productos ---
export async function createProductAction(
  clubSlug: string,
  values: ProductValues,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Datos del producto inválidos" };
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };
  const result = await repo.createProduct(clubId, parsed.data);
  if (result.ok) {
    revalidate(clubSlug);
    return { ok: true, id: result.id! };
  }
  return { ok: false, error: result.error ?? "Error" };
}

export async function updateProductAction(
  clubSlug: string,
  id: string,
  values: ProductValues,
): Promise<Result> {
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Datos del producto inválidos" };
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };
  const result = await repo.updateProduct(clubId, id, parsed.data);
  if (result.ok) revalidate(clubSlug);
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Error" };
}

export async function setProductActiveAction(
  clubSlug: string,
  id: string,
  active: boolean,
): Promise<Result> {
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };
  await repo.setProductActive(clubId, id, active);
  revalidate(clubSlug);
  return { ok: true };
}

export async function setProductShowInPriceMenuAction(
  clubSlug: string,
  id: string,
  showInPriceMenu: boolean,
): Promise<Result> {
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };
  await repo.setProductShowInPriceMenu(clubId, id, showInPriceMenu);
  revalidate(clubSlug);
  return { ok: true };
}

export async function reorderProductsAction(
  clubSlug: string,
  orderedIds: string[],
): Promise<Result> {
  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== "string")) {
    return { ok: false, error: "Orden inválido" };
  }
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };
  await repo.reorderProducts(clubId, orderedIds);
  revalidate(clubSlug);
  return { ok: true };
}

export async function getProductAction(
  clubSlug: string,
  id: string,
): Promise<
  | { ok: true; product: ProductValues & { photoUrl: string | null } }
  | { ok: false; error: string }
> {
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };
  const product = await repo.getProduct(clubId, id);
  if (!product) return { ok: false, error: "Producto no encontrado" };
  return { ok: true, product };
}

export async function uploadProductPhotoAction(
  clubSlug: string,
  id: string,
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Elegí una imagen" };
  if (!file.type.startsWith("image/"))
    return { ok: false, error: "El archivo debe ser una imagen" };
  if (file.size > 5 * 1024 * 1024)
    return { ok: false, error: "La imagen supera 5MB" };

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${clubId}/${id}-${Date.now()}.${ext}`;
  const admin = createSupabaseAdminClient();
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage
    .from(PRODUCT_PHOTOS_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (error) return { ok: false, error: error.message };

  const { data } = admin.storage.from(PRODUCT_PHOTOS_BUCKET).getPublicUrl(path);
  await repo.setProductPhoto(clubId, id, data.publicUrl);
  revalidate(clubSlug);
  return { ok: true, url: data.publicUrl };
}

export async function removeProductPhotoAction(
  clubSlug: string,
  id: string,
): Promise<Result> {
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const product = await repo.getProduct(clubId, id);
  if (!product) return { ok: false, error: "Producto no encontrado" };

  await repo.setProductPhoto(clubId, id, null);
  revalidate(clubSlug);
  return { ok: true };
}

export async function getSellableProductsAction(
  clubSlug: string,
): Promise<SellableProduct[]> {
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return [];
  return repo.getSellableProducts(clubId);
}

// --- Venta ---
export async function sellProductAction(
  clubSlug: string,
  userId: string,
  productId: string,
  quantity: number,
): Promise<Result> {
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };
  const result = await repo.sellProduct(clubId, userId, productId, quantity);
  if (result.ok) {
    revalidatePath(`/${clubSlug}/turnos`);
    revalidatePath(`/${clubSlug}/jugadores`);
  }
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Error" };
}

export type ExportableClub = { slug: string; name: string };

export async function listExportableClubsAction(
  sourceClubSlug: string,
): Promise<ExportableClub[]> {
  const access = await requireClubModuleAccess(sourceClubSlug, "catalogo");
  const memberships = await prisma.membership.findMany({
    where: {
      userId: access.user.id,
      club: { slug: { not: sourceClubSlug } },
      OR: [{ role: "OWNER" }, { role: "CLUB_ADMIN", staffStatus: "ACTIVE" }],
    },
    include: {
      club: { select: { slug: true, name: true } },
      userType: { select: { privileges: true, active: true } },
    },
    orderBy: { club: { name: "asc" } },
  });

  const bySlug = new Map<string, ExportableClub>();
  for (const membership of memberships) {
    const privileges =
      membership.userType?.active === false
        ? []
        : membership.userType
          ? toModuleKeys(membership.userType.privileges)
          : toModuleKeys(membership.allowedModules);
    const canEditCatalog =
      membership.role === "OWNER" || privileges.includes("catalogo");
    if (!canEditCatalog) continue;
    if (!bySlug.has(membership.club.slug)) {
      bySlug.set(membership.club.slug, {
        slug: membership.club.slug,
        name: membership.club.name,
      });
    }
  }
  return [...bySlug.values()];
}

export async function exportCatalogAction(
  sourceClubSlug: string,
  destClubSlug: string,
): Promise<
  | {
      ok: true;
      destName: string;
      productsCreated: number;
      productsSkipped: number;
      typesCreated: number;
      photosCopied: number;
    }
  | { ok: false; error: string }
> {
  if (!destClubSlug || destClubSlug === sourceClubSlug) {
    return { ok: false, error: "Elegí un club distinto al actual." };
  }

  try {
    const source = await requireClubModuleAccess(sourceClubSlug, "catalogo");
    const dest = await requireClubModuleAccess(destClubSlug, "catalogo");
    const result = await exportCatalog({
      sourceClubId: source.club.id,
      destClubId: dest.club.id,
      createdById: source.user.id,
    });
    revalidate(destClubSlug);
    return { ok: true, destName: dest.club.name, ...result };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return { ok: false, error: "Debes iniciar sesión." };
    }
    if (error instanceof AuthorizationError) {
      return {
        ok: false,
        error: "No tenés permiso para editar el catálogo de ese club.",
      };
    }
    throw error;
  }
}
