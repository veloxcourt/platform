"use client";

import { useRef, useState, useTransition } from "react";
import { Building2, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClubProfile } from "@/modules/clubs/domain/club-profile-schema";
import {
  removeClubLogoAction,
  saveClubProfileAction,
  uploadClubLogoAction,
} from "@/app/(dashboard)/[clubSlug]/control-usuarios/club/actions";

export function ClubProfileForm({
  clubSlug,
  initial,
}: {
  clubSlug: string;
  initial: ClubProfile;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial.name);
  const [locality, setLocality] = useState(initial.locality ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [isSaving, startSave] = useTransition();
  const [isUploading, startUpload] = useTransition();

  function handleSave() {
    startSave(async () => {
      const result = await saveClubProfileAction(clubSlug, {
        name,
        locality,
        address,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Datos del club guardados");
    });
  }

  function handleLogo(file: File | undefined) {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    startUpload(async () => {
      const result = await uploadClubLogoAction(clubSlug, form);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setLogoUrl(result.url);
      toast.success("Logo actualizado");
    });
  }

  function handleRemoveLogo() {
    startUpload(async () => {
      const result = await removeClubLogoAction(clubSlug);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setLogoUrl(null);
      toast.success("Logo quitado");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" />
          Datos del club
        </CardTitle>
        <CardDescription>
          Solo el dueño puede editar estos datos. Se usan en la llave y en los
          PDF del torneo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isUploading}
            className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/40"
            aria-label="Subir logo"
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo del club"
                className="size-full object-cover"
              />
            ) : (
              <ImagePlus className="size-6 text-muted-foreground" />
            )}
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-sm font-medium">Logo</p>
            <p className="text-xs text-muted-foreground">
              PNG o JPG, hasta 5 MB. Se muestra arriba a la derecha en el PDF
              de la llave.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isUploading}
                onClick={() => fileRef.current?.click()}
              >
                {logoUrl ? "Cambiar logo" : "Subir logo"}
              </Button>
              {logoUrl ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={isUploading}
                  onClick={handleRemoveLogo}
                >
                  <Trash2 className="size-4" />
                  Quitar
                </Button>
              ) : null}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              handleLogo(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="club-name">Nombre del complejo</Label>
            <Input
              id="club-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="club-locality">Localidad</Label>
            <Input
              id="club-locality"
              value={locality}
              onChange={(event) => setLocality(event.target.value)}
              maxLength={80}
              placeholder="Ciudad o barrio"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="club-address">Dirección</Label>
            <Input
              id="club-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              maxLength={160}
              placeholder="Calle y número"
            />
          </div>
        </div>

        <div>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
