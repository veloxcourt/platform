"use client";

import { useEffect, useState, useTransition } from "react";
import { History } from "lucide-react";
import { toast } from "sonner";

import {
  createPlayerEventAction,
  listPlayedTournamentsAction,
  listPlayerEventsAction,
  syncPlayerTournamentEventsAction,
} from "@/app/(dashboard)/[clubSlug]/jugadores/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PLAYER_EVENT_TYPE_LABELS,
  PLAYER_EVENT_TYPES,
  TOURNAMENT_ROUNDS,
  playerEventSummary,
  type PlayerInscriptionOption,
  type PlayedTournamentOption,
  type PlayerEventItem,
  type PlayerEventType,
  type TournamentRound,
} from "@/modules/players/domain/player-event";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const TEXTAREA_CLASS =
  "min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export type PlayerEventsTarget = {
  id: string;
  name: string;
  category: string | null;
};

function todayInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatOccurredOn(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatLoadedAt(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(iso));
}

function categoryOptions(categories: string[], extra: string | null) {
  const names = categories.map((name) => name.trim()).filter(Boolean);
  const current = extra?.trim();
  if (current && !names.includes(current)) names.unshift(current);
  return names;
}

export function PlayerEventsDialog({
  clubSlug,
  player,
  categories,
  open,
  onOpenChange,
}: {
  clubSlug: string;
  player: PlayerEventsTarget | null;
  categories: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [events, setEvents] = useState<PlayerEventItem[]>([]);
  const [playedTournaments, setPlayedTournaments] = useState<
    PlayedTournamentOption[]
  >([]);
  const [inscriptions, setInscriptions] = useState<PlayerInscriptionOption[]>(
    [],
  );
  const [playedError, setPlayedError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [composing, setComposing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [type, setType] = useState<PlayerEventType>("CATEGORY_CHANGE");
  const [occurredOn, setOccurredOn] = useState(todayInputValue);
  const [note, setNote] = useState("");
  const [previousCategory, setPreviousCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [linkedTournamentKey, setLinkedTournamentKey] = useState("");
  const [tournamentName, setTournamentName] = useState("");
  const [pickedInscriptionKey, setPickedInscriptionKey] = useState("");
  const [tournamentCategory, setTournamentCategory] = useState("");
  const [roundReached, setRoundReached] = useState<TournamentRound | "">("");
  const [partnerName, setPartnerName] = useState("");

  const options = categoryOptions(
    categories,
    player?.category ?? previousCategory,
  );

  useEffect(() => {
    if (!open || !player) return;
    const playerId = player.id;
    let cancelled = false;
    let pending = 2;
    const finish = () => {
      pending -= 1;
      if (pending === 0) setLoading(false);
    };
    setComposing(false);
    setPlayedError(null);
    setLoading(true);
    listPlayerEventsAction(clubSlug, playerId)
      .then((eventsResult) => {
        if (cancelled) return;
        if (eventsResult.ok) setEvents(eventsResult.events);
        else {
          setEvents([]);
          toast.error(eventsResult.error);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setEvents([]);
        toast.error("No se pudo cargar el historial");
      })
      .finally(finish);
    listPlayedTournamentsAction(clubSlug, playerId)
      .then((playedResult) => {
        if (cancelled) return;
        if (playedResult.ok) {
          setPlayedTournaments(playedResult.tournaments);
          setInscriptions(playedResult.inscriptions);
          setPlayedError(null);
        } else {
          setPlayedTournaments([]);
          setInscriptions([]);
          setPlayedError(playedResult.error);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setPlayedTournaments([]);
        setInscriptions([]);
        setPlayedError("No se pudieron cargar los torneos de este jugador");
      })
      .finally(finish);
    return () => {
      cancelled = true;
    };
  }, [open, player, clubSlug]);

  function syncMessage(created: number, updated: number) {
    if (created === 0 && updated === 0) {
      return "No hay torneos inscriptos para actualizar";
    }
    const added =
      created === 1 ? "Se agregó 1 suceso" : `Se agregaron ${created} sucesos`;
    const changed =
      updated === 1 ? "se actualizó 1" : `se actualizaron ${updated}`;
    if (created > 0 && updated > 0) return `${added} y ${changed}`;
    if (created > 0) return added;
    return updated === 1 ? "Se actualizó 1 suceso" : `Se actualizaron ${updated} sucesos`;
  }

  function syncFromTournaments() {
    if (!player) return;
    startTransition(async () => {
      try {
        const result = await syncPlayerTournamentEventsAction(
          clubSlug,
          player.id,
        );
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(syncMessage(result.created, result.updated));
        const [listed, played] = await Promise.all([
          listPlayerEventsAction(clubSlug, player.id),
          listPlayedTournamentsAction(clubSlug, player.id),
        ]);
        if (listed.ok) setEvents(listed.events);
        if (played.ok) {
          setPlayedTournaments(played.tournaments);
          setInscriptions(played.inscriptions);
          setPlayedError(null);
        }
        if (result.created > 0 || result.updated > 0) setComposing(false);
      } catch {
        toast.error("No se pudieron actualizar los torneos");
      }
    });
  }

  function startCreate() {
    setType("CATEGORY_CHANGE");
    setOccurredOn(todayInputValue());
    setNote("");
    setPreviousCategory(player?.category?.trim() ?? "");
    setNewCategory("");
    setLinkedTournamentKey("");
    setTournamentName("");
    setPickedInscriptionKey("");
    setTournamentCategory(player?.category?.trim() ?? "");
    setRoundReached("");
    setPartnerName("");
    setComposing(true);
  }

  function submit() {
    if (!player) return;
    const noteValue = note.trim();
    const input =
      type === "CATEGORY_CHANGE"
        ? {
            type,
            occurredOn,
            note: noteValue,
            data: {
              previousCategory,
              newCategory,
              linkedTournamentKey,
            },
          }
        : {
            type,
            occurredOn,
            note: noteValue,
            data: {
              tournamentName,
              category: tournamentCategory,
              roundReached,
              partnerName,
            },
          };

    startTransition(async () => {
      try {
        const result = await createPlayerEventAction(
          clubSlug,
          player.id,
          input,
        );
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Suceso cargado");
        setComposing(false);
        const [listed, played] = await Promise.all([
          listPlayerEventsAction(clubSlug, player.id),
          listPlayedTournamentsAction(clubSlug, player.id),
        ]);
        if (listed.ok) setEvents(listed.events);
        if (played.ok) {
          setPlayedTournaments(played.tournaments);
          setInscriptions(played.inscriptions);
        }
      } catch {
        toast.error("No se pudo guardar el suceso");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sucesos</DialogTitle>
          <DialogDescription>
            {player
              ? `Historial de ${player.name}`
              : "Historial de sucesos del jugador"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Cargando historial…
          </p>
        ) : events.length === 0 && !composing ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
            <History className="size-8 text-muted-foreground/70" />
            <p className="text-sm font-medium">Todavía no hay sucesos</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Acá van a aparecer los cambios de categoría y las participaciones
              en torneos de este jugador.
            </p>
          </div>
        ) : events.length > 0 ? (
          <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {events.map((event) => (
              <li key={event.id} className="rounded-lg border px-3 py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium">
                    {PLAYER_EVENT_TYPE_LABELS[event.type]}
                  </p>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {formatOccurredOn(event.occurredOn)}
                  </p>
                </div>
                <p className="mt-1 text-sm">{playerEventSummary(event)}</p>
                {event.note ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {event.note}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  Cargado el {formatLoadedAt(event.createdAt)} por{" "}
                  {event.createdByName}
                </p>
              </li>
            ))}
          </ul>
        ) : null}

        {composing ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="event-date">Fecha del suceso</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={occurredOn}
                  onChange={(event) => setOccurredOn(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-type">Tipo</Label>
                <select
                  id="event-type"
                  className={SELECT_CLASS}
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as PlayerEventType)
                  }
                >
                  {PLAYER_EVENT_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {PLAYER_EVENT_TYPE_LABELS[item]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {type === "TOURNAMENT" ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={syncFromTournaments}
                >
                  {isPending ? "Actualizando…" : "Actualizar"}
                </Button>
              </div>
            ) : null}

            {type === "CATEGORY_CHANGE" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="event-previous-category">
                    Categoría anterior
                  </Label>
                  <select
                    id="event-previous-category"
                    className={SELECT_CLASS}
                    value={previousCategory}
                    onChange={(event) =>
                      setPreviousCategory(event.target.value)
                    }
                  >
                    <option value="">Sin categoría</option>
                    {options.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="event-new-category">Categoría nueva</Label>
                  <select
                    id="event-new-category"
                    className={SELECT_CLASS}
                    value={newCategory}
                    onChange={(event) => setNewCategory(event.target.value)}
                    required
                  >
                    <option value="">Elegir…</option>
                    {options.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="event-linked-tournament">
                    Torneo vinculado
                  </Label>
                  <select
                    id="event-linked-tournament"
                    className={SELECT_CLASS}
                    value={linkedTournamentKey}
                    onChange={(event) =>
                      setLinkedTournamentKey(event.target.value)
                    }
                  >
                    <option value="">Sin vincular</option>
                    {playedTournaments.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.name} · {formatOccurredOn(item.date)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {playedError
                      ? playedError
                      : playedTournaments.length > 0
                        ? "Opcional. Son los torneos del club en los que este jugador está inscripto."
                        : "Opcional. Este jugador no está inscripto en ningún torneo del club."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {inscriptions.length > 0 ? (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="event-tournament-pick">
                      Traer un torneo jugado
                    </Label>
                    <select
                      id="event-tournament-pick"
                      className={SELECT_CLASS}
                      value={pickedInscriptionKey}
                      onChange={(event) => {
                        const key = event.target.value;
                        setPickedInscriptionKey(key);
                        const item = inscriptions.find(
                          (entry) => entry.key === key,
                        );
                        if (!item) return;
                        setTournamentName(item.name);
                        setTournamentCategory(item.categoryName);
                        if (item.partnerName) setPartnerName(item.partnerName);
                      }}
                    >
                      <option value="">Elegir…</option>
                      {inscriptions.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.name} · {item.categoryName} ·{" "}
                          {formatOccurredOn(item.date)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="event-tournament">Nombre del torneo</Label>
                  <Input
                    id="event-tournament"
                    value={tournamentName}
                    onChange={(event) => {
                      setTournamentName(event.target.value);
                      setPickedInscriptionKey("");
                    }}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="event-tournament-category">
                    Categoría en la que jugó
                  </Label>
                  <Input
                    id="event-tournament-category"
                    list="event-category-options"
                    value={tournamentCategory}
                    onChange={(event) =>
                      setTournamentCategory(event.target.value)
                    }
                    required
                  />
                  <datalist id="event-category-options">
                    {options.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="event-round">Instancia alcanzada</Label>
                  <select
                    id="event-round"
                    className={SELECT_CLASS}
                    value={roundReached}
                    onChange={(event) =>
                      setRoundReached(event.target.value as TournamentRound)
                    }
                    required
                  >
                    <option value="">Elegir…</option>
                    {TOURNAMENT_ROUNDS.map((round) => (
                      <option key={round} value={round}>
                        {round}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="event-partner">Compañero</Label>
                  <Input
                    id="event-partner"
                    value={partnerName}
                    onChange={(event) => setPartnerName(event.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="event-note">Observación</Label>
              <textarea
                id="event-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                className={TEXTAREA_CLASS}
                placeholder="Opcional"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setComposing(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando…" : "Guardar suceso"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex justify-end">
            <Button type="button" onClick={startCreate} disabled={!player}>
              Nuevo suceso
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
