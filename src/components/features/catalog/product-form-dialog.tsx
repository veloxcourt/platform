"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Camera,
  ClipboardPaste,
  Copy,
  Crop,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PRODUCT_IMAGE_OPTIONS, blobToPng } from "@/lib/image";
import {
  centsToPesos,
  pctToStore,
  pesosToCents,
  storeToPct,
} from "@/lib/money";
import { computePrice, realMarginPct } from "@/modules/catalog/domain/pricing";
import { lineCostCents } from "@/modules/catalog/domain/recipe-cost";
import type {
  ProductListItem,
  ProductType,
} from "@/modules/catalog/domain/types";
import {
  PRODUCT_UNITS,
  type ProductUnit,
  type ProductValues,
} from "@/modules/catalog/domain/product-schema";
import {
  bindImagePasteListener,
  imageFileFromPasteEventAsync,
  isImageFile,
  readImageFileFromClipboard,
} from "@/lib/clipboard-image";
import { AvatarCropStep } from "@/components/features/turnos/avatar-crop-step";
import { RecipeProductPicker } from "@/components/features/catalog/recipe-product-picker";
import {
  createProductAction,
  removeProductPhotoAction,
  updateProductAction,
  uploadProductPhotoAction,
} from "@/app/(dashboard)/[clubSlug]/catalogo/actions";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const UNIT_LABELS: Record<ProductUnit, string> = {
  u: "u (unidad)",
  g: "g",
  kg: "kg",
  ml: "ml",
  l: "l",
};

type RecipeLine = { componentId: string; quantity: number };

export function ProductFormDialog({
  clubSlug,
  types,
  products,
  open,
  onOpenChange,
  editing,
  defaults,
  onDone,
  onPhotoChanged,
}: {
  clubSlug: string;
  types: ProductType[];
  /** Catálogo completo para armar la receta (se filtran simples). */
  products: ProductListItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: {
    id: string;
    values: ProductValues;
    photoUrl: string | null;
  } | null;
  /** Prefill for create (e.g. clone). Ignored when editing. */
  defaults?: {
    values: ProductValues;
    photoUrl: string | null;
  } | null;
  onDone: () => void;
  onPhotoChanged?: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [typeId, setTypeId] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [isComposite, setIsComposite] = useState(false);
  const [stock, setStock] = useState(0);
  const [active, setActive] = useState(true);
  const [baseQuantity, setBaseQuantity] = useState(1);
  const [unit, setUnit] = useState<ProductUnit>("u");
  const [recipe, setRecipe] = useState<RecipeLine[]>([]);

  // Valores en unidades de pantalla (pesos / porcentaje)
  const [cost, setCost] = useState(0);
  const [margin, setMargin] = useState(0);
  const [rounding, setRounding] = useState(0);
  const [price, setPrice] = useState(0);
  const [priceManual, setPriceManual] = useState(false);

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isPhotoPending, startPhoto] = useTransition();
  const pasteZoneRef = useRef<HTMLDivElement>(null);
  const handleFileRef = useRef<(file: File) => void>(() => {});

  const simpleProducts = useMemo(
    () =>
      products.filter(
        (p) => !p.isComposite && (!editing || p.id !== editing.id),
      ),
    [products, editing],
  );

  const productById = useMemo(() => {
    const map = new Map(products.map((p) => [p.id, p]));
    return map;
  }, [products]);

  const recipeCostCents = useMemo(() => {
    return recipe.reduce((sum, line) => {
      const comp = productById.get(line.componentId);
      if (!comp) return sum;
      return sum + lineCostCents(comp.cost, comp.baseQuantity, line.quantity);
    }, 0);
  }, [recipe, productById]);

  useEffect(() => {
    if (!open) return;
    const seed = editing ?? defaults ?? null;
    const v = seed?.values;
    setName(v?.name ?? "");
    setCode(v?.code ?? "");
    setTypeId(v?.typeId ?? "");
    setDescription(v?.description ?? "");
    setNotes(v?.notes ?? "");
    setIsComposite(v?.isComposite ?? false);
    setStock(v?.stock ?? 0);
    setActive(v?.active ?? true);
    setBaseQuantity(v?.baseQuantity ?? 1);
    setUnit((v?.unit as ProductUnit) ?? "u");
    setRecipe(v?.components ?? []);
    setCost(v ? centsToPesos(v.cost) : 0);
    setMargin(v ? storeToPct(v.marginPct) : 0);
    setRounding(v ? centsToPesos(v.rounding) : 0);
    setPrice(v ? centsToPesos(v.price) : 0);
    setPriceManual(false);
    setPhotoPreview(seed?.photoUrl ?? null);
    setPhotoFile(null);
    setCropFile(null);
    setSourceFile(null);

    // Clone: copy remote photo into a File so create uploads it.
    const cloneUrl = !editing && defaults?.photoUrl ? defaults.photoUrl : null;
    if (!cloneUrl) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(cloneUrl);
        const blob = await res.blob();
        if (cancelled) return;
        const file = new File([blob], "foto.jpg", {
          type: blob.type || "image/jpeg",
        });
        setPhotoFile(file);
        setSourceFile(file);
      } catch {
        // Preview still shows; user can re-add the photo.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, editing, defaults]);

  // Costo del conjunto = suma de la receta
  useEffect(() => {
    if (!isComposite) return;
    setCost(centsToPesos(recipeCostCents));
  }, [isComposite, recipeCostCents]);

  // Recalcula el precio salvo que el usuario lo haya fijado a mano
  useEffect(() => {
    if (priceManual) return;
    const computed = computePrice(
      pesosToCents(cost),
      pctToStore(margin),
      pesosToCents(rounding),
    );
    setPrice(centsToPesos(computed));
  }, [cost, margin, rounding, priceManual]);

  const realPct = realMarginPct(pesosToCents(cost), pesosToCents(price)) / 100;

  function addRecipeLine(componentId: string) {
    if (!componentId) return;
    if (recipe.some((l) => l.componentId === componentId)) {
      toast.error("Ese producto ya está en la receta");
      return;
    }
    const comp = productById.get(componentId);
    setRecipe((prev) => [
      ...prev,
      { componentId, quantity: comp?.baseQuantity ?? 1 },
    ]);
  }

  function updateRecipeQty(componentId: string, quantity: number) {
    setRecipe((prev) =>
      prev.map((l) =>
        l.componentId === componentId ? { ...l, quantity } : l,
      ),
    );
  }

  function removeRecipeLine(componentId: string) {
    setRecipe((prev) => prev.filter((l) => l.componentId !== componentId));
  }

  function applyPhotoFile(file: File) {
    startPhoto(async () => {
      try {
        // Alta: se guarda el archivo y se sube después de crear el producto.
        if (!editing) {
          setPhotoFile(file);
          if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
          setPhotoPreview(URL.createObjectURL(file));
          return;
        }
        // Edición: el producto ya existe, se sube al instante.
        const fd = new FormData();
        fd.append("file", file);
        const result = await uploadProductPhotoAction(clubSlug, editing.id, fd);
        if (result.ok) {
          setPhotoPreview(result.url);
          toast.success("Foto actualizada");
          onPhotoChanged?.();
        } else {
          toast.error("No se pudo subir la foto", {
            description: result.error,
          });
        }
      } catch {
        toast.error("No se pudo procesar la imagen");
      }
    });
  }

  function handleFile(file: File) {
    if (!isImageFile(file)) {
      toast.error("El archivo debe ser una imagen");
      return;
    }
    setSourceFile(file);
    setCropFile(file);
  }

  handleFileRef.current = handleFile;

  useEffect(() => {
    if (!open || cropFile) return;
    return bindImagePasteListener((file) => handleFileRef.current(file));
  }, [open, cropFile]);

  async function applyPastedImage(e: ClipboardEvent | React.ClipboardEvent) {
    const native = "nativeEvent" in e ? e.nativeEvent : e;
    const file = await imageFileFromPasteEventAsync(native);
    if (file) {
      native.preventDefault();
      handleFile(file);
      return true;
    }
    return false;
  }

  function onCropConfirm(cropped: File) {
    setCropFile(null);
    applyPhotoFile(cropped);
  }

  function onCropCancel() {
    setCropFile(null);
  }

  async function reopenCrop() {
    if (sourceFile) {
      setCropFile(sourceFile);
      return;
    }
    if (!photoPreview) return;
    try {
      const res = await fetch(photoPreview);
      const blob = await res.blob();
      const file = new File([blob], "foto.jpg", {
        type: blob.type || "image/jpeg",
      });
      setSourceFile(file);
      setCropFile(file);
    } catch {
      toast.error("No se pudo abrir el encuadre");
    }
  }

  function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) handleFile(file);
  }

  function clearLocalPhoto() {
    if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setPhotoFile(null);
    setSourceFile(null);
    setCropFile(null);
  }

  function removePhoto() {
    if (editing) {
      startPhoto(async () => {
        const result = await removeProductPhotoAction(clubSlug, editing.id);
        if (result.ok) {
          clearLocalPhoto();
          toast.success("Foto quitada");
          onPhotoChanged?.();
        } else {
          toast.error("No se pudo quitar la foto", {
            description: result.error,
          });
        }
      });
      return;
    }
    clearLocalPhoto();
  }

  async function pasteFromClipboard() {
    pasteZoneRef.current?.focus();
    const fromApi = await readImageFileFromClipboard();
    if (fromApi) {
      handleFile(fromApi);
      return;
    }
    toast.error("No se detectó imagen en el portapapeles", {
      description:
        "Copiá la imagen (clic derecho → Copiar imagen), tocá el recuadro y Ctrl+V.",
    });
  }

  async function copyToClipboard() {
    if (!photoPreview) {
      toast.error("No hay foto para copiar");
      return;
    }
    try {
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
        toast.error("Tu navegador no permite copiar imágenes");
        return;
      }
      const res = await fetch(photoPreview);
      const png = await blobToPng(await res.blob());
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": png }),
      ]);
      toast.success("Foto copiada al portapapeles");
    } catch {
      toast.error("No se pudo copiar la foto");
    }
  }

  function submit() {
    if (!name.trim()) {
      toast.error("Ingresá el nombre del producto");
      return;
    }
    if (!isComposite && !(baseQuantity > 0)) {
      toast.error("La cantidad base debe ser mayor a 0");
      return;
    }
    if (isComposite) {
      for (const line of recipe) {
        if (!(line.quantity > 0)) {
          toast.error("Cada ítem de la receta debe tener cantidad mayor a 0");
          return;
        }
      }
    }
    const values: ProductValues = {
      name: name.trim(),
      code: code.trim(),
      description: description.trim(),
      notes: notes.trim(),
      typeId,
      cost: pesosToCents(cost),
      marginPct: pctToStore(margin),
      price: pesosToCents(price),
      rounding: pesosToCents(rounding),
      stock,
      isComposite,
      baseQuantity: isComposite ? 1 : baseQuantity,
      unit: isComposite ? "u" : unit,
      active,
      components: isComposite ? recipe : [],
    };
    startTransition(async () => {
      if (editing) {
        const result = await updateProductAction(clubSlug, editing.id, values);
        if (result.ok) {
          toast.success("Producto actualizado");
          onDone();
          onOpenChange(false);
        } else {
          toast.error("No se pudo guardar", { description: result.error });
        }
        return;
      }

      // Alta: crear el producto y, si hay foto elegida, subirla con el id nuevo.
      const result = await createProductAction(clubSlug, values);
      if (!result.ok) {
        toast.error("No se pudo crear", { description: result.error });
        return;
      }
      if (photoFile) {
        const fd = new FormData();
        fd.append("file", photoFile);
        await uploadProductPhotoAction(clubSlug, result.id, fd);
      }
      toast.success("Producto creado");
      onDone();
      onOpenChange(false);
    });
  }

  const recipeExcludeIds = useMemo(
    () => recipe.map((l) => l.componentId),
    [recipe],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {cropFile
              ? "Encuadrar foto"
              : editing
                ? "Editar producto"
                : "Nuevo producto"}
          </DialogTitle>
          <DialogDescription>
            {cropFile
              ? "Ajustá el encuadre de la imagen del producto."
              : editing
                ? "Editá los datos y la foto del producto."
                : "Los precios se muestran en pesos; se guardan con 2 decimales de precisión."}
          </DialogDescription>
        </DialogHeader>

        {cropFile ? (
          <AvatarCropStep
            file={cropFile}
            compressOptions={PRODUCT_IMAGE_OPTIONS}
            defaultFitFullImage
            shape="square"
            hint="Arrastrá la imagen para centrar el producto dentro del recuadro."
            onCancel={onCropCancel}
            onConfirm={onCropConfirm}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="col-span-2 flex items-center gap-3">
              <div
                ref={pasteZoneRef}
                tabIndex={0}
                role="button"
                aria-label="Zona de imagen. Tocá acá y pegá con Ctrl+V."
                onClick={() => pasteZoneRef.current?.focus()}
                onPaste={(e) => {
                  void applyPastedImage(e).then((ok) => {
                    if (!ok) {
                      toast.error("No hay una imagen en el portapapeles");
                    }
                  });
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFile(f);
                }}
                className={cn(
                  "grid size-20 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  dragging && "border-primary ring-2 ring-primary/40",
                )}
              >
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoPreview}
                    alt="Producto"
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="px-1 text-[10px] text-muted-foreground">
                    {dragging ? "Soltá acá" : "Arrastrá o pegá acá"}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <label
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "cursor-pointer",
                  )}
                >
                  <Camera className="size-4" />
                  Tomar foto
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={onPhotoSelected}
                    disabled={isPhotoPending}
                  />
                </label>
                <label
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "cursor-pointer",
                  )}
                >
                  {isPhotoPending
                    ? "Procesando..."
                    : photoPreview
                      ? "Cambiar"
                      : "Elegir"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onPhotoSelected}
                    disabled={isPhotoPending}
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={reopenCrop}
                  disabled={!photoPreview || isPhotoPending}
                >
                  <Crop className="size-4" /> Encuadrar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={pasteFromClipboard}
                  disabled={isPhotoPending}
                >
                  <ClipboardPaste className="size-4" /> Pegar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyToClipboard}
                  disabled={!photoPreview}
                >
                  <Copy className="size-4" /> Copiar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={removePhoto}
                  disabled={!photoPreview || isPhotoPending}
                >
                  <Trash2 className="size-4" /> Quitar
                </Button>
              </div>
            </div>

            <Field label="Nombre" className="col-span-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Código">
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Field label="Tipo">
              <select
                className={SELECT_CLASS}
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
              >
                <option value="">— Sin tipo —</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="col-span-2 flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Es un conjunto (combo)</p>
                <p className="text-xs text-muted-foreground">
                  Armá la receta con productos simples; el costo se calcula solo.
                </p>
              </div>
              <Checkbox
                checked={isComposite}
                onCheckedChange={(v) => {
                  const next = v === true;
                  setIsComposite(next);
                  if (!next) setRecipe([]);
                }}
              />
            </div>

            {!isComposite && (
              <>
                <Field label="Cantidad">
                  <Input
                    type="number"
                    min={0.001}
                    step="any"
                    value={baseQuantity}
                    onChange={(e) => setBaseQuantity(Number(e.target.value))}
                  />
                </Field>
                <Field label="Unidad">
                  <select
                    className={SELECT_CLASS}
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as ProductUnit)}
                  >
                    {PRODUCT_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {UNIT_LABELS[u]}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}

            {isComposite && (
              <div className="col-span-2 space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">Receta</p>
                {recipe.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Todavía no hay ítems. Agregá productos simples.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {recipe.map((line) => {
                      const comp = productById.get(line.componentId);
                      const lineCost = comp
                        ? lineCostCents(
                            comp.cost,
                            comp.baseQuantity,
                            line.quantity,
                          )
                        : 0;
                      return (
                        <li
                          key={line.componentId}
                          className="grid grid-cols-[1fr_5.5rem_auto_auto] items-center gap-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm">
                              {comp?.name ?? "Producto"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Base {comp?.baseQuantity ?? "?"}{" "}
                              {comp?.unit ?? ""} · $
                              {centsToPesos(lineCost).toFixed(2)}
                            </p>
                          </div>
                          <Input
                            type="number"
                            min={0.001}
                            step="any"
                            value={line.quantity}
                            onChange={(e) =>
                              updateRecipeQty(
                                line.componentId,
                                Number(e.target.value),
                              )
                            }
                          />
                          <span className="text-xs text-muted-foreground">
                            {comp?.unit ?? ""}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Quitar"
                            onClick={() => removeRecipeLine(line.componentId)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs text-muted-foreground">
                    Buscá y tocá un producto para agregarlo a la receta.
                  </p>
                  <RecipeProductPicker
                    products={simpleProducts}
                    types={types}
                    excludeIds={recipeExcludeIds}
                    onPick={addRecipeLine}
                  />
                </div>
              </div>
            )}

            <Field
              label="Costo ($)"
              hint={
                isComposite
                  ? "Calculado desde la receta"
                  : `Costo de ${baseQuantity} ${unit}`
              }
            >
              <Input
                type="number"
                min={0}
                step="0.01"
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
                readOnly={isComposite}
                disabled={isComposite}
              />
            </Field>
            <Field label="% Ganancia">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={margin}
                onChange={(e) => setMargin(Number(e.target.value))}
              />
            </Field>
            <Field label="Redondeo ($)">
              <Input
                type="number"
                min={0}
                step="1"
                value={rounding}
                onChange={(e) => setRounding(Number(e.target.value))}
              />
            </Field>
            <Field
              label="Precio de venta ($)"
              hint={
                priceManual
                  ? `Manual · % real ${realPct.toFixed(2)}%`
                  : `Calculado · % real ${realPct.toFixed(2)}%`
              }
            >
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={price}
                  onChange={(e) => {
                    setPrice(Number(e.target.value));
                    setPriceManual(true);
                  }}
                />
                {priceManual && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Volver a calcular automáticamente"
                    onClick={() => setPriceManual(false)}
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                )}
              </div>
            </Field>

            <Field label="Stock">
              <Input
                type="number"
                min={0}
                step="1"
                value={stock}
                onChange={(e) => setStock(Number(e.target.value))}
              />
            </Field>
            <div className="flex flex-col gap-1.5">
              <Label>Disponible para venta</Label>
              <label className="flex h-8 items-center gap-2 text-sm">
                <Checkbox
                  checked={active}
                  onCheckedChange={(v) => setActive(v === true)}
                />
                {active ? "Activo" : "Inactivo"}
              </label>
            </div>

            <Field label="Descripción" className="col-span-2">
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <Field label="Observación" className="col-span-2">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>

            <div className="col-span-2 mt-1 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={submit} disabled={isPending}>
                {isPending ? "Guardando..." : editing ? "Guardar" : "Crear"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
