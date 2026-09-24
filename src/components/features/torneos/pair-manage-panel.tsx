"use client";

import { useState, useTransition } from "react";

import { requestManagedPairCancellationAction } from "@/app/inscripcion/[publicSlug]/actions";
import { PublicInscriptionForm } from "@/components/features/torneos/public-inscription-form";
import { Button } from "@/components/ui/button";
import type { PublicManagedPairDetails } from "@/modules/tournaments/domain/pair-manage";
import { REGISTRATION_STATUS_LABELS } from "@/modules/tournaments/domain/pair-schema";
import type {
  SlotReservationItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";

export function PairManagePanel({
  publicSlug,
  manageToken,
  initialPair,
  categories,
  config,
  pickerCategories,
  preferenceReservations,
}: {
  publicSlug: string;
  manageToken: string;
  initialPair: PublicManagedPairDetails;
  categories: { id: string; name: string }[];
  config: TournamentConfig | null;
  pickerCategories: TournamentCategoryItem[];
  preferenceReservations: SlotReservationItem[];
}) {
  const [pair, setPair] = useState(initialPair);
  const [view, setView] = useState<"hub" | "edit" | "cancel">("hub");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function requestCancel() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await requestManagedPairCancellationAction(
        publicSlug,
        manageToken,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message);
      if (result.outcome === "cancelled") {
        setPair({ ...pair, status: "CANCELLED" });
      } else {
        setPair({ ...pair, status: "CANCEL_REQUESTED" });
      }
      setView("hub");
    });
  }

  if (pair.status === "CANCELLED") {
    return (
      <div className="rounded-xl border bg-background p-6 text-sm space-y-2">
        <p className="font-medium">Inscripción cancelada</p>
        <p className="text-muted-foreground">
          Esta pareja ya no está activa en el torneo.
        </p>
      </div>
    );
  }

  const summary = (
    <div>
      <p className="font-medium">
        {pair.player1Name}
        {pair.player2Name ? ` / ${pair.player2Name}` : ""}
      </p>
      <p className="text-muted-foreground">
        {pair.tournamentName} · {pair.categoryName} ·{" "}
        {REGISTRATION_STATUS_LABELS[pair.status]}
      </p>
    </div>
  );

  if (view === "edit") {
    return (
      <div className="space-y-4">
        {summary}
        <Button type="button" variant="outline" size="sm" onClick={() => setView("hub")}>
          Volver
        </Button>
        <PublicInscriptionForm
          publicSlug={publicSlug}
          categories={categories}
          config={config}
          pickerCategories={pickerCategories}
          preferenceReservations={preferenceReservations}
          edit={pair}
        />
      </div>
    );
  }

  if (view === "cancel") {
    return (
      <div className="rounded-xl border bg-background p-4 space-y-4 text-sm">
        {summary}
        {error ? <p className="text-destructive">{error}</p> : null}
        <p className="text-muted-foreground">
          ¿Confirmás la baja de esta inscripción? Si el cuadro ya está armado,
          el club la tiene que confirmar.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={requestCancel}
          >
            {isPending ? "Confirmando…" : "Confirmar baja"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => setView("hub")}
          >
            Volver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-background p-4 space-y-4 text-sm">
      {summary}
      {error ? <p className="text-destructive">{error}</p> : null}
      {message ? <p className="text-muted-foreground">{message}</p> : null}

      {pair.status === "CANCEL_REQUESTED" ? (
        <p className="text-muted-foreground">
          Ya hay un pedido de baja. El club lo tiene que confirmar.
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" className="w-full sm:flex-1" onClick={() => setView("edit")}>
            Editar inscripción
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="w-full sm:flex-1"
            onClick={() => setView("cancel")}
          >
            Dar de baja inscripción
          </Button>
        </div>
      )}
    </div>
  );
}
