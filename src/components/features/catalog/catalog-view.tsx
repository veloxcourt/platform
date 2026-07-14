"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Package, Pencil, Copy, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatMoney, storeToPct } from "@/lib/money";
import { normalizeText } from "@/components/features/turnos/player-combobox";
import type {
  ProductListItem,
  ProductType,
} from "@/modules/catalog/domain/types";
import type { ProductValues } from "@/modules/catalog/domain/product-schema";
import { ProductFormDialog } from "./product-form-dialog";
import {
  createProductTypeAction,
  deleteProductTypeAction,
  getProductAction,
  setProductActiveAction,
  updateProductTypeAction,
} from "@/app/(dashboard)/[clubSlug]/catalogo/actions";

const STICKY_PHOTO =
  "sticky left-0 z-10 w-14 min-w-14 bg-background py-2 pl-3 align-top";
const STICKY_PHOTO_HEAD =
  "sticky left-0 z-20 w-14 min-w-14 bg-muted/50 px-3 py-2";
const STICKY_NAME =
  "sticky left-14 z-10 w-[7rem] min-w-[7rem] max-w-[7rem] bg-background px-2 py-2 align-top shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)]";
const STICKY_NAME_HEAD =
  "sticky left-14 z-20 w-[7rem] min-w-[7rem] max-w-[7rem] bg-muted/50 px-2 py-2 font-medium shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)]";

export function CatalogView({
  clubSlug,
  currency,
  products,
  types,
}: {
  clubSlug: string;
  currency: string;
  products: ProductListItem[];
  types: ProductType[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [cloneDefaults, setCloneDefaults] = useState<{
    values: ProductValues;
    photoUrl: string | null;
  } | null>(null);
  const [editing, setEditing] = useState<{
    id: string;
    values: ProductValues;
    photoUrl: string | null;
  } | null>(null);
  const [, startLoad] = useTransition();
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    return q
      ? products.filter(
          (p) =>
            normalizeText(p.name).includes(q) ||
            normalizeText(p.code ?? "").includes(q),
        )
      : products;
  }, [products, query]);

  function openEdit(id: string) {
    startLoad(async () => {
      const result = await getProductAction(clubSlug, id);
      if (result.ok) {
        const { photoUrl, ...values } = result.product;
        setEditing({ id, values, photoUrl });
      } else {
        toast.error("No se pudo abrir", { description: result.error });
      }
    });
  }

  function openClone(id: string) {
    startLoad(async () => {
      const result = await getProductAction(clubSlug, id);
      if (result.ok) {
        const { photoUrl, ...values } = result.product;
        // Código vacío: el unique por club no permite duplicarlo.
        setCloneDefaults({
          values: { ...values, code: "" },
          photoUrl,
        });
        setNewOpen(true);
      } else {
        toast.error("No se pudo clonar", { description: result.error });
      }
    });
  }

  function toggleActive(id: string, active: boolean) {
    startTransition(async () => {
      const r = await setProductActiveAction(clubSlug, id, active);
      if (r.ok) router.refresh();
      else toast.error("Error", { description: r.error });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Productos</CardTitle>
            <CardDescription>{products.length} en el catálogo</CardDescription>
          </div>
          <Button
            onClick={() => {
              setCloneDefaults(null);
              setNewOpen(true);
            }}
          >
            <Plus className="size-4" /> Nuevo producto
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por nombre o código..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-max text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className={STICKY_PHOTO_HEAD} />
                  <th className={STICKY_NAME_HEAD}>Nombre</th>
                  <th className="px-3 py-2 font-medium">Código</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 text-right font-medium">Costo</th>
                  <th className="px-3 py-2 text-right font-medium">Precio</th>
                  <th className="px-3 py-2 text-right font-medium">%</th>
                  <th className="px-3 py-2 text-right font-medium">Stock</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-3 py-6 text-center text-muted-foreground"
                    >
                      Sin productos.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr
                      key={p.id}
                      className={cn(
                        "border-b last:border-b-0",
                        !p.active && "opacity-50",
                      )}
                    >
                      <td className={STICKY_PHOTO}>
                        <div className="grid size-8 place-items-center overflow-hidden rounded-md border bg-muted">
                          {p.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.photoUrl}
                              alt={p.name}
                              className="size-full object-cover"
                            />
                          ) : (
                            <Package className="size-4 text-muted-foreground" />
                          )}
                        </div>
                      </td>
                      <td className={cn(STICKY_NAME, "font-medium")}>
                        <div
                          className="line-clamp-2 break-words leading-snug"
                          title={
                            p.isComposite ? `${p.name} (combo)` : p.name
                          }
                        >
                          {p.name}
                          {p.isComposite && (
                            <span className="text-xs text-muted-foreground">
                              {" "}
                              (combo)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {p.code || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {p.typeName || "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatMoney(p.cost, currency)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatMoney(p.price, currency)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {storeToPct(p.marginPct).toFixed(0)}%
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {p.stock}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(p.id)}
                          >
                            <Pencil className="size-4" /> Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            title="Clonar producto"
                            aria-label="Clonar producto"
                            onClick={() => openClone(p.id)}
                          >
                            <Copy className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isPending}
                            onClick={() => toggleActive(p.id, !p.active)}
                          >
                            {p.active ? "Desactivar" : "Activar"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <TypesManager clubSlug={clubSlug} types={types} />

      <ProductFormDialog
        clubSlug={clubSlug}
        types={types}
        open={newOpen}
        defaults={cloneDefaults}
        onOpenChange={(o) => {
          setNewOpen(o);
          if (!o) setCloneDefaults(null);
        }}
        onDone={() => {
          setCloneDefaults(null);
          router.refresh();
        }}
      />
      <ProductFormDialog
        clubSlug={clubSlug}
        types={types}
        editing={editing}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        onPhotoChanged={() => router.refresh()}
        onDone={() => {
          setEditing(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function TypesManager({
  clubSlug,
  types,
}: {
  clubSlug: string;
  types: ProductType[];
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  function add() {
    const name = value.trim();
    if (!name) return;
    startTransition(async () => {
      const r = await createProductTypeAction(clubSlug, { name });
      if (r.ok) {
        setValue("");
        router.refresh();
      } else toast.error("Error", { description: r.error });
    });
  }

  function rename(id: string, name: string) {
    startTransition(async () => {
      const r = await updateProductTypeAction(clubSlug, id, { name });
      if (r.ok) router.refresh();
      else toast.error("Error", { description: r.error });
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const r = await deleteProductTypeAction(clubSlug, id);
      if (r.ok) router.refresh();
      else toast.error("No se pudo eliminar", { description: r.error });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tipos de producto</CardTitle>
        <CardDescription>
          Sirven para clasificar y filtrar el catálogo. No se pueden eliminar si
          están en uso.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {types.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin tipos.</p>
          )}
          {types.map((t) => (
            <TypeRow
              key={t.id}
              name={t.name}
              disabled={isPending}
              onRename={(name) => rename(t.id, name)}
              onRemove={() => remove(t.id)}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            className="max-w-xs"
            placeholder="Nuevo tipo (ej. Bar, Insumos)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={add}
            disabled={isPending}
          >
            <Plus className="size-4" /> Agregar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TypeRow({
  name,
  disabled,
  onRename,
  onRemove,
}: {
  name: string;
  disabled: boolean;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          className="max-w-xs"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <Button
          size="sm"
          disabled={disabled}
          onClick={() => {
            if (value.trim() && value.trim() !== name) onRename(value.trim());
            setEditing(false);
          }}
        >
          Guardar
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => {
            setValue(name);
            setEditing(false);
          }}
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="min-w-40 text-sm">{name}</span>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => setEditing(true)}
        aria-label="Renombrar"
      >
        <Pencil className="size-4" />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={disabled}
        onClick={onRemove}
        aria-label="Eliminar"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
