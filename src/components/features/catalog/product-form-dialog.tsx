"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import type { ProductType } from "@/modules/catalog/domain/types";
import type { ProductValues } from "@/modules/catalog/domain/product-schema";
import {
  bindImagePasteListener,
  imageFileFromPasteEventAsync,
  isImageFile,
  readImageFileFromClipboard,
} from "@/lib/clipboard-image";
import { AvatarCropStep } from "@/components/features/turnos/avatar-crop-step";
import {
  createProductAction,
  removeProductPhotoAction,
  updateProductAction,
  uploadProductPhotoAction,
} from "@/app/(dashboard)/[clubSlug]/catalogo/actions";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ProductFormDialog({
  clubSlug,
  types,
  open,
  onOpenChange,
  editing,
  defaults,
  onDone,
  onPhotoChanged,
}: {
  clubSlug: string;
  types: ProductType[];
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
      active,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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

            <Field label="Costo ($)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
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

            <div className="col-span-2 flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Es un conjunto (combo)</p>
                <p className="text-xs text-muted-foreground">
                  Compuesto por otros productos (la receta se define más adelante).
                </p>
              </div>
              <Checkbox
                checked={isComposite}
                onCheckedChange={(v) => setIsComposite(v === true)}
              />
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
