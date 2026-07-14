"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlayerCombobox } from "@/components/features/turnos/player-combobox";
import type { PlayerRef } from "@/modules/bookings/domain/types";
import type {
  PairListItem,
  SlotReservationItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import {
  collectInscribedPlayerIds,
  filterAvailablePlayersForInscription,
} from "@/modules/tournaments/domain/category-player-filter";
import {
  addPairAction,
  replacePairSlotPreferencesAction,
  updatePairAction,
  updatePairZonesDayPreferenceAction,
} from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/actions";
import {
  PairZonesSlotPicker,
  type PairDraftPreferences,
} from "./pair-zones-slot-picker";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const DRAFT_PAIR_ID = "draft";

export function EditPairDialog({
  clubSlug,
  tournamentId,
  mode,
  pair,
  players,
  pairs,
  categories,
  config,
  courtCount,
  reservations,
  defaultCategoryId = null,
  lockCategory = false,
  open,
  onOpenChange,
  onSaved,
}: {
  clubSlug: string;
  tournamentId: string;
  mode: "add" | "edit";
  pair: PairListItem | null;
  players: PlayerRef[];
  pairs: PairListItem[];
  categories: TournamentCategoryItem[];
  config: TournamentConfig | null;
  courtCount: number;
  reservations: SlotReservationItem[];
  /// Categoría preseleccionada al abrir alta (p. ej. desde Inscripciones).
  defaultCategoryId?: string | null;
  /// Si true, no se puede cambiar la categoría en el alta.
  lockCategory?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const isAdd = mode === "add";
  const [player1Id, setPlayer1Id] = useState("");
  const [player2Id, setPlayer2Id] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [draftPreferences, setDraftPreferences] = useState<PairDraftPreferences>({
    dayPreference: "ANY",
    slots: [],
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    if (isAdd) {
      setPlayer1Id("");
      setPlayer2Id("");
      setCategoryId(
        defaultCategoryId &&
          categories.some((c) => c.id === defaultCategoryId)
          ? defaultCategoryId
          : (categories[0]?.id ?? ""),
      );
      setDraftPreferences({ dayPreference: "ANY", slots: [] });
      return;
    }
    if (!pair) return;
    setPlayer1Id(pair.player1.id);
    setPlayer2Id(pair.player2?.id ?? "");
    setCategoryId(pair.categoryId);
  }, [open, isAdd, pair, categories, defaultCategoryId]);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const inscribedPlayerIds = useMemo(
    () => collectInscribedPlayerIds(pairs, isAdd ? undefined : pair?.id),
    [pairs, isAdd, pair?.id],
  );
  const eligiblePlayers = useMemo(
    () =>
      filterAvailablePlayersForInscription(
        players,
        selectedCategory?.name ?? "",
        inscribedPlayerIds,
        [player1Id, player2Id],
      ),
    [players, selectedCategory, inscribedPlayerIds, player1Id, player2Id],
  );

  useEffect(() => {
    if (!selectedCategory) return;
    const allowed = new Set(
      filterAvailablePlayersForInscription(
        players,
        selectedCategory.name,
        inscribedPlayerIds,
        [player1Id, player2Id],
      ).map((p) => p.id),
    );
    if (player1Id && !allowed.has(player1Id)) setPlayer1Id("");
    if (player2Id && !allowed.has(player2Id)) setPlayer2Id("");
  }, [
    selectedCategory,
    players,
    inscribedPlayerIds,
    player1Id,
    player2Id,
  ]);

  function submit() {
    if (!player1Id) {
      toast.error("Elegí el jugador");
      return;
    }
    if (!categoryId) {
      toast.error(
        isAdd
          ? "Creá una categoría antes de inscribir"
          : "Elegí la categoría del torneo",
      );
      return;
    }

    startTransition(async () => {
      if (isAdd) {
        const result = await addPairAction(clubSlug, tournamentId, {
          player1Id,
          player2Id: player2Id || undefined,
          categoryId,
        });
        if (!result.ok) {
          toast.error("No se pudo inscribir", {
            description: result.error,
          });
          return;
        }

        const pairId = result.id;
        if (draftPreferences.slots.length > 0) {
          const prefResult = await replacePairSlotPreferencesAction(
            clubSlug,
            tournamentId,
            pairId,
            { slots: draftPreferences.slots },
          );
          if (!prefResult.ok) {
            toast.error("Inscripción creada, pero no se guardaron las preferencias", {
              description: prefResult.error,
            });
            onSaved();
            onOpenChange(false);
            return;
          }
        }

        if (draftPreferences.dayPreference !== "ANY") {
          const prefResult = await updatePairZonesDayPreferenceAction(
            clubSlug,
            tournamentId,
            pairId,
            { zonesDayPreference: draftPreferences.dayPreference },
          );
          if (!prefResult.ok) {
            toast.error(
              "Inscripción creada, pero no se guardó la preferencia de días",
              { description: prefResult.error },
            );
            onSaved();
            onOpenChange(false);
            return;
          }
        }

        toast.success(player2Id ? "Pareja inscripta" : "Jugador inscripto");
        onSaved();
        onOpenChange(false);
        return;
      }

      if (!pair) return;
      const result = await updatePairAction(clubSlug, tournamentId, pair.id, {
        player1Id,
        player2Id: player2Id || undefined,
        categoryId,
      });
      if (result.ok) {
        toast.success("Inscripción actualizada");
        onSaved();
      } else {
        toast.error("No se pudo actualizar", {
          description: result.error,
        });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-max max-w-[96vw] overflow-y-auto sm:w-max sm:max-w-[96vw]">
        <DialogHeader>
          <DialogTitle>
            {isAdd
              ? selectedCategory
                ? `Inscribir · ${selectedCategory.name}`
                : "Inscribir"
              : "Editar inscripción"}
          </DialogTitle>
          <DialogDescription>
            {isAdd
              ? selectedCategory
                ? `Alta en ${selectedCategory.name}. Cargá jugadores y rangos de preferencia (días de fase de zonas).`
                : "Cargá jugadores, categoría y rangos de preferencia (solo días de fase de zonas)."
              : "Modificá jugadores, categoría y rangos de preferencia (solo días de fase de zonas)."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Jugador</Label>
            <PlayerCombobox
              players={eligiblePlayers}
              value={player1Id}
              onChange={setPlayer1Id}
              exclude={player2Id ? [player2Id] : undefined}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label>Compañero</Label>
              {player2Id && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setPlayer2Id("")}
                >
                  {isAdd ? "Sin compañero" : "Quitar compañero"}
                </Button>
              )}
            </div>
            <PlayerCombobox
              players={eligiblePlayers}
              value={player2Id}
              onChange={setPlayer2Id}
              exclude={player1Id ? [player1Id] : undefined}
              placeholder="Opcional — busca compañero..."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pair-category">Categoría del torneo</Label>
            <select
              id="pair-category"
              className={SELECT_CLASS}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={categories.length === 0 || (isAdd && lockCategory)}
            >
              {categories.length === 0 ? (
                <option value="">Sin categorías</option>
              ) : (
                categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))
              )}
            </select>
            {isAdd && lockCategory && selectedCategory ? (
              <p className="text-xs text-muted-foreground">
                Categoría fijada desde Inscripciones.
              </p>
            ) : null}
          </div>

          {(isAdd || pair) && (
            <PairZonesSlotPicker
              key={isAdd ? `add-${categoryId}` : pair!.id}
              clubSlug={clubSlug}
              tournamentId={tournamentId}
              pairId={isAdd ? DRAFT_PAIR_ID : pair!.id}
              categoryId={categoryId || pair?.categoryId || ""}
              config={config}
              courtCount={courtCount}
              categories={categories}
              reservations={reservations}
              zonesDayPreference={isAdd ? "ANY" : pair!.zonesDayPreference}
              persist={!isAdd}
              onDraftChange={isAdd ? setDraftPreferences : undefined}
              onChanged={isAdd ? undefined : onSaved}
            />
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cerrar
            </Button>
            <Button
              onClick={submit}
              disabled={isPending || categories.length === 0 || (!isAdd && !pair)}
            >
              {isPending
                ? "Guardando..."
                : isAdd
                  ? "Inscribir"
                  : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
