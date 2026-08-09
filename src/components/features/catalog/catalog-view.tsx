"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Package,
  Pencil,
  Copy,
  Trash2,
  X,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  reorderProductsAction,
  setProductActiveAction,
  setProductShowInPriceMenuAction,
  updateProductTypeAction,
} from "@/app/(dashboard)/[clubSlug]/catalogo/actions";

const STICKY_GRIP =
  "sticky left-0 z-10 w-8 min-w-8 bg-background px-0.5 py-2 align-middle";
const STICKY_GRIP_HEAD =
  "sticky left-0 z-20 w-8 min-w-8 bg-muted/50 px-0.5 py-2";
const STICKY_PHOTO =
  "sticky left-8 z-10 w-14 min-w-14 bg-background py-2 pl-2 align-top";
const STICKY_PHOTO_HEAD =
  "sticky left-8 z-20 w-14 min-w-14 bg-muted/50 px-2 py-2";
const STICKY_NAME =
  "sticky left-[5.5rem] z-10 bg-background px-2 py-2 align-top shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)]";
const STICKY_NAME_HEAD =
  "sticky left-[5.5rem] z-20 bg-muted/50 px-2 py-2 font-medium shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)]";

type ColKey = "name" | "code" | "type" | "cost" | "price" | "pct" | "stock";

const COL_WIDTHS_KEY = "catalog-product-col-widths";

const DEFAULT_COL_WIDTHS: Record<ColKey, number> = {
  name: 200,
  code: 110,
  type: 140,
  cost: 100,
  price: 100,
  pct: 56,
  stock: 64,
};

const MIN_COL_WIDTHS: Record<ColKey, number> = {
  name: 100,
  code: 64,
  type: 80,
  cost: 72,
  price: 72,
  pct: 40,
  stock: 48,
};

function loadColWidths(): Record<ColKey, number> {
  if (typeof window === "undefined") return { ...DEFAULT_COL_WIDTHS };
  try {
    const raw = localStorage.getItem(COL_WIDTHS_KEY);
    if (!raw) return { ...DEFAULT_COL_WIDTHS };
    const parsed = JSON.parse(raw) as Partial<Record<ColKey, number>>;
    return { ...DEFAULT_COL_WIDTHS, ...parsed };
  } catch {
    return { ...DEFAULT_COL_WIDTHS };
  }
}

function colStyle(width: number): CSSProperties {
  return { width, minWidth: width, maxWidth: width };
}

function moveProduct(
  list: ProductListItem[],
  fromId: string,
  toId: string,
): ProductListItem[] {
  const from = list.findIndex((p) => p.id === fromId);
  const to = list.findIndex((p) => p.id === toId);
  if (from < 0 || to < 0 || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function ResizableTh({
  col,
  width,
  onResize,
  className,
  align = "left",
  children,
  title,
}: {
  col: ColKey;
  width: number;
  onResize: (col: ColKey, width: number) => void;
  className?: string;
  align?: "left" | "right" | "center";
  children?: ReactNode;
  title?: string;
}) {
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = width;
      const min = MIN_COL_WIDTHS[col];

      function onMove(ev: MouseEvent) {
        onResize(col, Math.max(min, startW + (ev.clientX - startX)));
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [col, onResize, width],
  );

  return (
    <th
      className={cn(
        "relative select-none px-3 py-2 font-medium",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      style={colStyle(width)}
      title={title}
    >
      {children}
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label={`Redimensionar columna`}
        onMouseDown={onMouseDown}
        className="absolute inset-y-0 right-0 z-30 w-1.5 cursor-col-resize touch-none hover:bg-primary/30 active:bg-primary/40"
      />
    </th>
  );
}

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
  /** Filtro por tipo de venta: all | simple | composite */
  const [saleKind, setSaleKind] = useState<"all" | "simple" | "composite">(
    "all",
  );
  /** Filtro por tipo de producto (`all` | `none` | typeId). */
  const [typeFilter, setTypeFilter] = useState("all");
  const [ordered, setOrdered] = useState(products);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
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
  const [colWidths, setColWidths] = useState(DEFAULT_COL_WIDTHS);

  useEffect(() => {
    setColWidths(loadColWidths());
  }, []);

  useEffect(() => {
    setOrdered(products);
  }, [products]);

  function resizeCol(col: ColKey, width: number) {
    setColWidths((prev) => {
      const next = { ...prev, [col]: width };
      try {
        localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(next));
      } catch {
        // ignore quota / private mode
      }
      return next;
    });
  }

  const canReorder =
    !normalizeText(query) && saleKind === "all" && typeFilter === "all";

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    return ordered.filter((p) => {
      if (saleKind === "simple" && p.isComposite) return false;
      if (saleKind === "composite" && !p.isComposite) return false;
      if (typeFilter === "none" && p.typeId) return false;
      if (
        typeFilter !== "all" &&
        typeFilter !== "none" &&
        p.typeId !== typeFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        normalizeText(p.name).includes(q) ||
        normalizeText(p.code ?? "").includes(q)
      );
    });
  }, [ordered, query, saleKind, typeFilter]);

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

  function toggleMenu(id: string, showInPriceMenu: boolean) {
    setOrdered((prev) =>
      prev.map((p) => (p.id === id ? { ...p, showInPriceMenu } : p)),
    );
    startTransition(async () => {
      const r = await setProductShowInPriceMenuAction(
        clubSlug,
        id,
        showInPriceMenu,
      );
      if (r.ok) router.refresh();
      else {
        toast.error("Error", { description: r.error });
        router.refresh();
      }
    });
  }

  function onDragStart(id: string, e: React.DragEvent) {
    if (!canReorder) {
      e.preventDefault();
      return;
    }
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function onDragOverRow(id: string, e: React.DragEvent) {
    if (!canReorder) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overId !== id) setOverId(id);
  }

  function onDropRow(id: string, e: React.DragEvent) {
    e.preventDefault();
    if (!canReorder) return;
    const fromId = e.dataTransfer.getData("text/plain") || dragId;
    if (!fromId || fromId === id) {
      setDragId(null);
      setOverId(null);
      return;
    }
    const next = moveProduct(ordered, fromId, id);
    setOrdered(next);
    setDragId(null);
    setOverId(null);
    startTransition(async () => {
      const r = await reorderProductsAction(
        clubSlug,
        next.map((p) => p.id),
      );
      if (r.ok) router.refresh();
      else {
        toast.error("No se pudo reordenar", { description: r.error });
        router.refresh();
      }
    });
  }

  function onDragEnd() {
    setDragId(null);
    setOverId(null);
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por nombre o código..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label="Tipo de venta"
              value={saleKind}
              onChange={(e) =>
                setSaleKind(e.target.value as "all" | "simple" | "composite")
              }
            >
              <option value="all">Todos</option>
              <option value="simple">Individual</option>
              <option value="composite">Conjunto</option>
            </select>
            <select
              className="h-8 max-w-[14rem] rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label="Tipo de producto"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">Todos los tipos</option>
              <option value="none">Sin tipo</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          {!canReorder && (
            <p className="text-xs text-muted-foreground">
              Limpiá la búsqueda y los filtros para reordenar productos.
            </p>
          )}

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-max min-w-full border-collapse text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className={STICKY_GRIP_HEAD} aria-label="Reordenar" />
                  <th className={STICKY_PHOTO_HEAD} />
                  <ResizableTh
                    col="name"
                    width={colWidths.name}
                    onResize={resizeCol}
                    className={STICKY_NAME_HEAD}
                  >
                    Nombre
                  </ResizableTh>
                  <ResizableTh
                    col="code"
                    width={colWidths.code}
                    onResize={resizeCol}
                  >
                    Código
                  </ResizableTh>
                  <ResizableTh
                    col="type"
                    width={colWidths.type}
                    onResize={resizeCol}
                  >
                    Tipo
                  </ResizableTh>
                  <ResizableTh
                    col="cost"
                    width={colWidths.cost}
                    onResize={resizeCol}
                    align="right"
                  >
                    Costo
                  </ResizableTh>
                  <ResizableTh
                    col="price"
                    width={colWidths.price}
                    onResize={resizeCol}
                    align="right"
                  >
                    Precio
                  </ResizableTh>
                  <ResizableTh
                    col="pct"
                    width={colWidths.pct}
                    onResize={resizeCol}
                    align="right"
                  >
                    %
                  </ResizableTh>
                  <ResizableTh
                    col="stock"
                    width={colWidths.stock}
                    onResize={resizeCol}
                    align="right"
                  >
                    Stock
                  </ResizableTh>
                  <th
                    className="px-3 py-2 text-center font-medium"
                    title="Publicar en menú de precios"
                  >
                    Menú
                  </th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-3 py-6 text-center text-muted-foreground"
                    >
                      Sin productos.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => {
                    const isDragging = dragId === p.id;
                    const isOver = overId === p.id && dragId !== p.id;
                    return (
                      <tr
                        key={p.id}
                        onDragOver={(e) => onDragOverRow(p.id, e)}
                        onDrop={(e) => onDropRow(p.id, e)}
                        className={cn(
                          "border-b last:border-b-0",
                          !p.active && "opacity-50",
                          isDragging && "opacity-40",
                          isOver && "border-t-2 border-t-primary",
                        )}
                      >
                        <td className={STICKY_GRIP}>
                          <button
                            type="button"
                            draggable={canReorder}
                            disabled={!canReorder}
                            onDragStart={(e) => onDragStart(p.id, e)}
                            onDragEnd={onDragEnd}
                            aria-label="Arrastrar para reordenar"
                            className={cn(
                              "flex items-center justify-center rounded-md p-1 text-muted-foreground",
                              canReorder
                                ? "cursor-grab touch-none hover:bg-muted hover:text-foreground active:cursor-grabbing"
                                : "cursor-not-allowed opacity-40",
                            )}
                          >
                            <GripVertical className="size-4" />
                          </button>
                        </td>
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
                        <td
                          className={cn(STICKY_NAME, "font-medium")}
                          style={colStyle(colWidths.name)}
                        >
                          <div
                            className="break-words leading-snug"
                            title={
                              p.isComposite
                                ? `${p.name} (combo)`
                                : `${p.name} · ${p.baseQuantity} ${p.unit}`
                            }
                          >
                            {p.name}
                            {!p.isComposite && (
                              <span className="text-xs text-muted-foreground">
                                {" "}
                                · {p.baseQuantity} {p.unit}
                              </span>
                            )}
                            {p.isComposite && (
                              <span className="text-xs text-muted-foreground">
                                {" "}
                                (combo)
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          className="truncate px-3 py-2 text-muted-foreground"
                          style={colStyle(colWidths.code)}
                          title={p.code || undefined}
                        >
                          {p.code || "—"}
                        </td>
                        <td
                          className="break-words px-3 py-2 text-muted-foreground"
                          style={colStyle(colWidths.type)}
                          title={p.typeName || undefined}
                        >
                          {p.typeName || "—"}
                        </td>
                        <td
                          className="px-3 py-2 text-right tabular-nums"
                          style={colStyle(colWidths.cost)}
                        >
                          {formatMoney(p.cost, currency)}
                        </td>
                        <td
                          className="px-3 py-2 text-right font-medium tabular-nums"
                          style={colStyle(colWidths.price)}
                        >
                          {formatMoney(p.price, currency)}
                        </td>
                        <td
                          className="px-3 py-2 text-right tabular-nums text-muted-foreground"
                          style={colStyle(colWidths.pct)}
                        >
                          {storeToPct(p.marginPct).toFixed(0)}%
                        </td>
                        <td
                          className="px-3 py-2 text-right tabular-nums"
                          style={colStyle(colWidths.stock)}
                        >
                          {p.stock}
                        </td>
                        <td className="px-3 py-2 text-center align-middle">
                          <Checkbox
                            checked={p.showInPriceMenu}
                            disabled={isPending}
                            onCheckedChange={(v) =>
                              toggleMenu(p.id, v === true)
                            }
                            aria-label={`Publicar ${p.name} en menú de precios`}
                          />
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
                    );
                  })
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
        products={ordered}
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
        products={ordered}
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
