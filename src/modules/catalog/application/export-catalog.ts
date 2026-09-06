import {
  createSupabaseAdminClient,
  PRODUCT_PHOTOS_BUCKET,
} from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";

export type CatalogExportResult = {
  productsCreated: number;
  productsSkipped: number;
  typesCreated: number;
  photosCopied: number;
};

function catalogKey(value: string) {
  return value.trim().toLocaleLowerCase("es");
}

function extFromUrlOrPath(value: string) {
  const last = value.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(last)) return last;
  return "jpg";
}

function storagePathFromPublicUrl(url: string) {
  const marker = `/object/public/${PRODUCT_PHOTOS_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  try {
    return decodeURIComponent(url.slice(index + marker.length));
  } catch {
    return null;
  }
}

async function copyProductPhoto(sourceUrl: string, destClubId: string, destProductId: string) {
  const admin = createSupabaseAdminClient();
  const storagePath = storagePathFromPublicUrl(sourceUrl);

  let bytes: Buffer;
  let contentType = "image/jpeg";

  if (storagePath) {
    const { data, error } = await admin.storage
      .from(PRODUCT_PHOTOS_BUCKET)
      .download(storagePath);
    if (error || !data) return null;
    bytes = Buffer.from(await data.arrayBuffer());
    contentType = data.type || contentType;
  } else {
    const response = await fetch(sourceUrl);
    if (!response.ok) return null;
    bytes = Buffer.from(await response.arrayBuffer());
    contentType = response.headers.get("content-type") || contentType;
  }

  const ext = extFromUrlOrPath(storagePath ?? sourceUrl);
  const path = `${destClubId}/${destProductId}-${Date.now()}.${ext}`;
  const { error } = await admin.storage
    .from(PRODUCT_PHOTOS_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) return null;

  const { data } = admin.storage.from(PRODUCT_PHOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function exportCatalog(input: {
  sourceClubId: string;
  destClubId: string;
  createdById?: string;
}): Promise<CatalogExportResult> {
  const { sourceClubId, destClubId, createdById } = input;
  if (sourceClubId === destClubId) {
    return {
      productsCreated: 0,
      productsSkipped: 0,
      typesCreated: 0,
      photosCopied: 0,
    };
  }

  const createdPhotos: { destId: string; photoUrl: string }[] = [];

  const counts = await prisma.$transaction(
    async (tx) => {
      const [sourceTypes, destTypes, sourceProducts, destProducts] =
        await Promise.all([
          tx.productType.findMany({ where: { clubId: sourceClubId } }),
          tx.productType.findMany({ where: { clubId: destClubId } }),
          tx.product.findMany({
            where: { clubId: sourceClubId },
            include: { components: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          }),
          tx.product.findMany({
            where: { clubId: destClubId },
            select: { id: true, name: true, code: true },
          }),
        ]);

      const typeIdMap = new Map<string, string>();
      const destTypeByName = new Map(
        destTypes.map((type) => [catalogKey(type.name), type.id]),
      );
      let typesCreated = 0;

      for (const type of sourceTypes) {
        const existing = destTypeByName.get(catalogKey(type.name));
        if (existing) {
          typeIdMap.set(type.id, existing);
          continue;
        }
        const created = await tx.productType.create({
          data: {
            clubId: destClubId,
            name: type.name,
            active: type.active,
          },
        });
        destTypeByName.set(catalogKey(type.name), created.id);
        typeIdMap.set(type.id, created.id);
        typesCreated += 1;
      }

      const destByCode = new Map(
        destProducts
          .filter((product) => product.code)
          .map((product) => [product.code as string, product.id]),
      );
      const destByName = new Map(
        destProducts.map((product) => [catalogKey(product.name), product.id]),
      );

      function existingDestId(product: { name: string; code: string | null }) {
        if (product.code) {
          const byCode = destByCode.get(product.code);
          if (byCode) return byCode;
        }
        return destByName.get(catalogKey(product.name)) ?? null;
      }

      const productIdMap = new Map<string, string>();
      let productsCreated = 0;
      let productsSkipped = 0;

      const maxSort = await tx.product.aggregate({
        where: { clubId: destClubId },
        _max: { sortOrder: true },
      });
      let sortOrder = maxSort._max.sortOrder ?? -1;

      const simples = sourceProducts.filter((product) => !product.isComposite);
      const composites = sourceProducts.filter((product) => product.isComposite);

      for (const product of [...simples, ...composites]) {
        const existingId = existingDestId(product);
        if (existingId) {
          productIdMap.set(product.id, existingId);
          productsSkipped += 1;
          continue;
        }

        const components = product.isComposite
          ? product.components.flatMap((line) => {
              const componentId = productIdMap.get(line.componentId);
              return componentId
                ? [{ componentId, quantity: line.quantity }]
                : [];
            })
          : [];

        sortOrder += 1;
        let created;
        try {
          created = await tx.product.create({
            data: {
              clubId: destClubId,
              name: product.name,
              code: product.code ? product.code : null,
              description: product.description,
              notes: product.notes,
              typeId: product.typeId
                ? (typeIdMap.get(product.typeId) ?? null)
                : null,
              cost: product.cost,
              marginPct: product.marginPct,
              price: product.price,
              rounding: product.rounding,
              stock: 0,
              isComposite: product.isComposite,
              baseQuantity: product.isComposite ? 1 : product.baseQuantity,
              unit: product.isComposite ? "u" : product.unit,
              active: product.active,
              sortOrder,
              showInPriceMenu: product.showInPriceMenu,
              createdById: createdById ?? null,
            },
          });
        } catch (error) {
          if ((error as { code?: string }).code === "P2002" && product.code) {
            const conflict = await tx.product.findFirst({
              where: { clubId: destClubId, code: product.code },
              select: { id: true },
            });
            if (conflict) {
              productIdMap.set(product.id, conflict.id);
              destByCode.set(product.code, conflict.id);
              productsSkipped += 1;
              continue;
            }
          }
          throw error;
        }

        if (components.length > 0) {
          await tx.productComponent.createMany({
            data: components.map((line) => ({
              parentId: created.id,
              componentId: line.componentId,
              quantity: line.quantity,
            })),
          });
        }

        destByName.set(catalogKey(product.name), created.id);
        if (product.code) destByCode.set(product.code, created.id);
        productIdMap.set(product.id, created.id);
        productsCreated += 1;

        if (product.photoUrl) {
          createdPhotos.push({ destId: created.id, photoUrl: product.photoUrl });
        }
      }

      return { productsCreated, productsSkipped, typesCreated };
    },
    { timeout: 30_000 },
  );

  let photosCopied = 0;
  for (const photo of createdPhotos) {
    try {
      const url = await copyProductPhoto(photo.photoUrl, destClubId, photo.destId);
      if (!url) continue;
      await prisma.product.updateMany({
        where: { id: photo.destId, clubId: destClubId },
        data: { photoUrl: url },
      });
      photosCopied += 1;
    } catch {
      // El producto ya quedó copiado; la foto se puede cargar después.
    }
  }

  return { ...counts, photosCopied };
}
