"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Camera, ClipboardPaste, Copy, Crop, Trash2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { blobToPng } from "@/lib/image";
import { DEFAULT_PHONE_DIAL } from "@/lib/phone";
import {
  bindImagePasteListener,
  imageFileFromPasteEventAsync,
  isImageFile,
  readImageFileFromClipboard,
} from "@/lib/clipboard-image";
import { AvatarCropStep } from "@/components/features/turnos/avatar-crop-step";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  newPlayerSchema,
  type NewPlayerValues,
  EMPTY_PHONE_FIELDS,
  GENDERS,
  GENDER_LABELS,
  COURT_POSITIONS,
  COURT_POSITION_LABELS,
} from "@/modules/bookings/domain/new-player-schema";
import type { PlayerRef } from "@/modules/bookings/domain/types";
import {
  createPlayerAction,
  removePlayerPhotoAction,
  updatePlayerAction,
  uploadPlayerPhotoAction,
} from "@/app/(dashboard)/[clubSlug]/turnos/actions";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const EMPTY_PLAYER: NewPlayerValues = {
  firstName: "",
  lastName: "",
  ...EMPTY_PHONE_FIELDS,
  email: "",
  gender: "",
  birthDate: "",
  city: "",
  address: "",
  country: "",
  category: "",
  courtPosition: "",
  ranking: null,
  accumulatedPoints: 0,
};

export function NewPlayerDialog({
  clubSlug,
  categories,
  open,
  onOpenChange,
  onCreated,
  editing,
  onSaved,
  onPhotoChanged,
}: {
  clubSlug: string;
  categories: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (player: PlayerRef) => void;
  /// Si se provee, el modal funciona en modo edición de ese jugador.
  editing?: { id: string; values: NewPlayerValues; photoUrl?: string | null } | null;
  onSaved?: () => void;
  onPhotoChanged?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isPhotoPending, startPhoto] = useTransition();
  const [dragging, setDragging] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const pasteZoneRef = useRef<HTMLDivElement>(null);
  const handleFileRef = useRef<(file: File) => void>(() => {});

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<NewPlayerValues>({
    resolver: zodResolver(newPlayerSchema),
    defaultValues: EMPTY_PLAYER,
  });

  // Al abrir, precargar valores (edición) o limpiar (alta).
  useEffect(() => {
    if (open) {
      reset(editing?.values ?? EMPTY_PLAYER);
      setPhotoPreview(editing?.photoUrl ?? null);
      setPhotoFile(null);
      setCropFile(null);
      setSourceFile(null);
    }
  }, [open, editing, reset]);

  function applyPhotoFile(file: File) {
    startPhoto(async () => {
      try {
        // Alta: se guarda el archivo y se sube después de crear el jugador.
        if (!editing) {
          setPhotoFile(file);
          if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
          setPhotoPreview(URL.createObjectURL(file));
          return;
        }
        // Edición: el jugador ya existe, se sube al instante.
        const fd = new FormData();
        fd.append("file", file);
        const result = await uploadPlayerPhotoAction(clubSlug, editing.id, fd);
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
      const file = new File([blob], "foto.jpg", { type: blob.type || "image/jpeg" });
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
        const result = await removePlayerPhotoAction(clubSlug, editing.id);
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

  function onSubmit(values: NewPlayerValues) {
    startTransition(async () => {
      if (editing) {
        const result = await updatePlayerAction(clubSlug, editing.id, values);
        if (result.ok) {
          toast.success("Ficha actualizada");
          onSaved?.();
          onOpenChange(false);
        } else {
          toast.error("No se pudo guardar", { description: result.error });
        }
        return;
      }

      const result = await createPlayerAction(clubSlug, values);
      if (result.ok) {
        if (photoFile) {
          const fd = new FormData();
          fd.append("file", photoFile);
          const up = await uploadPlayerPhotoAction(
            clubSlug,
            result.player.id,
            fd,
          );
          if (!up.ok) {
            toast.error("Jugador creado, pero no se pudo subir la foto", {
              description: up.error,
            });
          }
        }
        toast.success("Jugador dado de alta", {
          description: result.player.name,
        });
        reset(EMPTY_PLAYER);
        setPhotoFile(null);
        setPhotoPreview(null);
        onCreated?.(result.player);
        onOpenChange(false);
      } else {
        toast.error("No se pudo dar de alta", { description: result.error });
      }
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
                ? "Editar jugador"
                : "Nuevo jugador / cliente"}
          </DialogTitle>
          <DialogDescription>
            {cropFile
              ? "Centrá la cara del jugador dentro del círculo."
              : editing
                ? "Editá los datos y la foto del jugador."
                : "Completá los datos del jugador. Podés cargar la foto ahora o después."}
          </DialogDescription>
        </DialogHeader>

        {cropFile ? (
          <AvatarCropStep
            file={cropFile}
            onCancel={onCropCancel}
            onConfirm={onCropConfirm}
          />
        ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2"
        >
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
                  "grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border bg-muted text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  dragging && "border-primary ring-2 ring-primary/40",
                )}
              >
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoPreview}
                    alt="Foto del jugador"
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

          <Field label="Nombre" error={errors.firstName?.message}>
            <Input {...register("firstName")} />
          </Field>
          <Field label="Apellido" error={errors.lastName?.message}>
            <Input {...register("lastName")} />
          </Field>
          <PhoneInput
            dial={watch("phoneCountryDial") ?? DEFAULT_PHONE_DIAL}
            local={watch("phoneLocal") ?? ""}
            onDialChange={(dial) =>
              setValue("phoneCountryDial", dial, { shouldValidate: true })
            }
            onLocalChange={(local) =>
              setValue("phoneLocal", local, { shouldValidate: true })
            }
            error={errors.phoneLocal?.message}
            disabled={isPhotoPending}
          />
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" {...register("email")} />
          </Field>
          <Field label="Sexo">
            <select className={SELECT_CLASS} {...register("gender")}>
              <option value="">—</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {GENDER_LABELS[g]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fecha de nacimiento" error={errors.birthDate?.message}>
            <Input type="date" {...register("birthDate")} />
          </Field>
          <Field label="Categoría">
            <select className={SELECT_CLASS} {...register("category")}>
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Posición en cancha">
            <select className={SELECT_CLASS} {...register("courtPosition")}>
              <option value="">—</option>
              {COURT_POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {COURT_POSITION_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ranking" error={errors.ranking?.message}>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="—"
              {...register("ranking", {
                setValueAs: (v) => {
                  if (v === "" || v === null || v === undefined) return null;
                  const n = Number(v);
                  return Number.isFinite(n) ? n : null;
                },
              })}
            />
          </Field>
          <Field
            label="Puntos acumulados"
            error={errors.accumulatedPoints?.message}
          >
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              {...register("accumulatedPoints", {
                setValueAs: (v) => {
                  if (v === "" || v === null || v === undefined) return 0;
                  const n = Number(v);
                  return Number.isFinite(n) ? n : 0;
                },
              })}
            />
          </Field>
          <Field label="Localidad">
            <Input {...register("city")} />
          </Field>
          <Field label="País">
            <Input {...register("country")} />
          </Field>
          <div className="col-span-2">
            <Field label="Dirección">
              <Input {...register("address")} />
            </Field>
          </div>

          <div className="col-span-2 mt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Guardando..."
                : editing
                  ? "Guardar cambios"
                  : "Dar de alta"}
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
