"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { submitPublicInscriptionAction } from "@/app/inscripcion/[publicSlug]/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatPhoneDisplay, splitPhoneForForm } from "@/lib/phone";
import type { Gender } from "@/modules/bookings/domain/new-player-schema";
import type { PublicManagedPairDetails } from "@/modules/tournaments/domain/pair-manage";
import type {
  SlotReservationItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import {
  PairZonesSlotPicker,
  type PairDraftPreferences,
} from "./pair-zones-slot-picker";
import {
  PublicPlayerFields,
  type PublicPlayerDefaults,
} from "./public-player-fields";

const SELECT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 dark:bg-background";

export type LoggedInInscriptionPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  gender: Gender | null;
  city: string | null;
};

function playerToDefaults(
  player: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    gender: Gender | null;
    city?: string | null;
  } | null,
): PublicPlayerDefaults | null {
  if (!player) return null;
  return {
    id: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    phone: player.phone
      ? splitPhoneForForm(player.phone).local ||
        formatPhoneDisplay(player.phone)
      : "",
    gender: player.gender ?? "",
    city: player.city ?? "",
  };
}

export function PublicInscriptionForm({
  publicSlug,
  categories,
  config,
  pickerCategories,
  preferenceReservations,
  loggedInPlayer = null,
  edit = null,
}: {
  publicSlug: string;
  categories: { id: string; name: string }[];
  config: TournamentConfig | null;
  pickerCategories: TournamentCategoryItem[];
  preferenceReservations: SlotReservationItem[];
  loggedInPlayer?: LoggedInInscriptionPlayer | null;
  edit?: PublicManagedPairDetails | null;
}) {
  const [state, action, pending] = useActionState(submitPublicInscriptionAction, {});
  const [categoryId, setCategoryId] = useState(
    edit?.categoryId || (categories.length === 1 ? categories[0]!.id : ""),
  );
  const [player1Id, setPlayer1Id] = useState(
    edit?.player1.id ?? loggedInPlayer?.id ?? "",
  );
  const [player2Id, setPlayer2Id] = useState(edit?.player2?.id ?? "");
  const [draftPreferences, setDraftPreferences] = useState<PairDraftPreferences>({
    dayPreference: edit?.zonesDayPreference ?? "ANY",
    slots: edit?.slots ?? [],
  });
  const selectedCategoryName =
    categories.find((category) => category.id === categoryId)?.name ?? "";

  const player1Defaults: PublicPlayerDefaults | null =
    playerToDefaults(edit?.player1 ?? null) ??
    (loggedInPlayer && !edit
      ? {
          id: loggedInPlayer.id,
          firstName:
            loggedInPlayer.firstName ||
            loggedInPlayer.fullName.split(/\s+/)[0] ||
            "",
          lastName:
            loggedInPlayer.lastName ||
            loggedInPlayer.fullName.split(/\s+/).slice(1).join(" "),
          phone: loggedInPlayer.phone
            ? splitPhoneForForm(loggedInPlayer.phone).local ||
              formatPhoneDisplay(loggedInPlayer.phone)
            : "",
          gender: loggedInPlayer.gender ?? "",
          city: loggedInPlayer.city ?? "",
        }
      : null);
  const player2Defaults = playerToDefaults(edit?.player2 ?? null);

  useEffect(() => {
    if (!state.updated) return;
    toast.success("Inscripción actualizada");
  }, [state.updated]);

  if (state.ok && !edit) {
    const managePath = state.managePath;
    return (
      <div className="rounded-xl border bg-background p-6 text-sm space-y-3">
        <p className="font-medium">Inscripción enviada</p>
        <p className="text-muted-foreground">
          El club va a confirmar la pareja. Si hace falta, te van a contactar.
        </p>
        {managePath ? (
          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <p className="font-medium">Guardá este link privado</p>
            <p className="text-muted-foreground">
              Con este link (no con el teléfono) podés cambiar preferencias o
              pedir la baja. Compartilo solo con tu compañero.
            </p>
            <p className="break-all rounded-md bg-muted px-2 py-1.5 font-mono text-xs">
              {managePath}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={managePath}
                className="cursor-pointer underline underline-offset-4"
              >
                Abrir gestión
              </Link>
              <button
                type="button"
                className="cursor-pointer underline underline-offset-4"
                onClick={() => {
                  const url = `${window.location.origin}${managePath}`;
                  void navigator.clipboard.writeText(url).then(
                    () => toast.success("Link copiado"),
                    () => toast.error("No se pudo copiar el link"),
                  );
                }}
              >
                Copiar link
              </button>
            </div>
          </div>
        ) : null}
        <p className="text-muted-foreground">
          {loggedInPlayer ? (
            <>
              También podés gestionar desde{" "}
              <Link href="/cuenta" className="underline underline-offset-4">
                Mi cuenta
              </Link>
              .
            </>
          ) : (
            <>
              Opcional:{" "}
              <Link
                href={`/registro?next=${encodeURIComponent(managePath ?? `/inscripcion/${publicSlug}`)}`}
                className="underline underline-offset-4"
              >
                crear una cuenta
              </Link>{" "}
              para ver tus torneos después.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="publicSlug" value={publicSlug} />
      {edit ? (
        <input type="hidden" name="manageToken" value={edit.manageToken} />
      ) : null}
      {loggedInPlayer && !edit ? (
        <input type="hidden" name="loggedInUserId" value={loggedInPlayer.id} />
      ) : null}
      <input
        type="hidden"
        name="zonesDayPreference"
        value={draftPreferences.dayPreference}
      />
      <input
        type="hidden"
        name="slotsJson"
        value={JSON.stringify(draftPreferences.slots)}
      />
      <div className="space-y-1.5 rounded-xl border border-orange-200/80 bg-orange-50/40 p-4 dark:border-orange-900/50 dark:bg-orange-950/20">
        <Label
          htmlFor="categoryId"
          className="text-base font-semibold text-orange-800 dark:text-orange-300"
        >
          <span className="inline-block h-4 w-1 rounded-full bg-orange-500" aria-hidden />
          Categoría
        </Label>
        <select
          id="categoryId"
          name="categoryId"
          required
          className={SELECT_CLASS}
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          {categories.length !== 1 ? <option value="">Elegí…</option> : null}
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <PublicPlayerFields
        prefix="player1"
        title="Jugador 1"
        publicSlug={publicSlug}
        categoryName={selectedCategoryName}
        excludeId={player2Id}
        onMatchedIdChange={setPlayer1Id}
        defaults={player1Defaults}
        locked={Boolean(loggedInPlayer) && !edit}
      />
      <PublicPlayerFields
        prefix="player2"
        title="Jugador 2"
        publicSlug={publicSlug}
        categoryName={selectedCategoryName}
        excludeId={player1Id}
        onMatchedIdChange={setPlayer2Id}
        defaults={player2Defaults}
      />
      <div className="rounded-xl border border-orange-200/80 bg-orange-50/30 p-4 dark:border-orange-900/50 dark:bg-orange-950/15">
        <p className="flex items-center gap-2 text-base font-semibold text-orange-800 dark:text-orange-300">
          <span className="inline-block h-4 w-1 rounded-full bg-orange-500" aria-hidden />
          Preferencias horarias
        </p>
        {categoryId ? (
          <div className="mt-3">
            <PairZonesSlotPicker
              key={`${edit?.id ?? "draft"}-${categoryId}`}
              clubSlug=""
              tournamentId=""
              pairId={edit?.id ?? "draft"}
              categoryId={categoryId}
              config={config}
              courtCount={config?.courtCount ?? 1}
              categories={pickerCategories}
              reservations={preferenceReservations}
              zonesDayPreference={edit?.zonesDayPreference ?? "ANY"}
              persist={false}
              onDraftChange={setDraftPreferences}
              title="Horarios de zonas"
              hint="Marcá en azul los horarios en los que podrían jugar. El número de arriba es cuántas parejas ya pidieron ese horario (todas las categorías). El color va de verde a rojo según la demanda."
            />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Elegí la categoría arriba para marcar horarios. Vas a ver cuáles
            están libres y cuáles ya están saturados.
          </p>
        )}
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending
          ? edit
            ? "Guardando…"
            : "Enviando…"
          : edit
            ? "Guardar cambios"
            : "Inscribir pareja"}
      </Button>
    </form>
  );
}
