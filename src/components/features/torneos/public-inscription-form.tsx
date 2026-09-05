"use client";

import { useActionState, useState } from "react";

import { submitPublicInscriptionAction } from "@/app/inscripcion/[publicSlug]/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type {
  SlotReservationItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import {
  PairZonesSlotPicker,
  type PairDraftPreferences,
} from "./pair-zones-slot-picker";
import { PublicPlayerFields } from "./public-player-fields";

const SELECT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function PublicInscriptionForm({
  publicSlug,
  categories,
  config,
  pickerCategories,
  preferenceReservations,
}: {
  publicSlug: string;
  categories: { id: string; name: string }[];
  config: TournamentConfig | null;
  pickerCategories: TournamentCategoryItem[];
  preferenceReservations: SlotReservationItem[];
}) {
  const [state, action, pending] = useActionState(submitPublicInscriptionAction, {});
  const [categoryId, setCategoryId] = useState(
    categories.length === 1 ? categories[0]!.id : "",
  );
  const [player1Id, setPlayer1Id] = useState("");
  const [player2Id, setPlayer2Id] = useState("");
  const [draftPreferences, setDraftPreferences] = useState<PairDraftPreferences>({
    dayPreference: "ANY",
    slots: [],
  });
  const selectedCategoryName =
    categories.find((category) => category.id === categoryId)?.name ?? "";

  if (state.ok) {
    return (
      <div className="rounded-xl border bg-background p-6 text-sm">
        <p className="font-medium">Inscripción enviada</p>
        <p className="mt-2 text-muted-foreground">
          El club va a confirmar la pareja. Si hace falta, te van a contactar.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="publicSlug" value={publicSlug} />
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
      <div className="space-y-1.5">
        <Label htmlFor="categoryId">Categoría</Label>
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
      />
      <PublicPlayerFields
        prefix="player2"
        title="Jugador 2"
        publicSlug={publicSlug}
        categoryName={selectedCategoryName}
        excludeId={player1Id}
        onMatchedIdChange={setPlayer2Id}
      />
      <div className="rounded-xl border p-4">
        <p className="text-sm font-medium">Preferencias horarias</p>
        {categoryId ? (
          <div className="mt-3">
            <PairZonesSlotPicker
              key={`draft-${categoryId}`}
              clubSlug=""
              tournamentId=""
              pairId="draft"
              categoryId={categoryId}
              config={config}
              courtCount={config?.courtCount ?? 1}
              categories={pickerCategories}
              reservations={preferenceReservations}
              persist={false}
              onDraftChange={setDraftPreferences}
              title="Horarios de zonas"
              hint="Marcá en azul los horarios en los que podrían jugar. El verde es libre. La barrita de arriba es el mapa de calor: cuántas parejas ya pidieron ese horario."
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
        {pending ? "Enviando…" : "Inscribir pareja"}
      </Button>
    </form>
  );
}
