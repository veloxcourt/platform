"use server";

import { revalidatePath } from "next/cache";

import { getBookingRepository } from "@/modules/bookings/infrastructure/repository";
import {
  createSupabaseAdminClient,
  PRODUCT_PHOTOS_BUCKET,
} from "@/lib/supabase/admin";
import {
  productSchema,
  productTypeSchema,
  type ProductValues,
  type ProductTypeValues,
} from "@/modules/catalog/domain/product-schema";
import type { SellableProduct } from "@/modules/catalog/domain/types";

type Result = { ok: true } | { ok: false; error: string };

async function resolveClubId(clubSlug: string) {
  const repo = getBookingRepository();
  const club = await repo.getClubBySlug(clubSlug);
  return { repo, clubId: club?.id ?? null };
}

function revalidate(clubSlug: string) {
  revalidatePath(`/${clubSlug}/catalogo`);
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
