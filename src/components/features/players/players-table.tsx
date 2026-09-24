"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  History,
  Pencil,
  Search,
  Trash2,
  Trophy,
  UserPlus,
  Wallet,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import type { PlayerListItem, PlayerRef } from "@/modules/bookings/domain/types";
import {
  COURT_POSITION_LABELS,
  type CourtPosition,
  type NewPlayerValues,
} from "@/modules/bookings/domain/new-player-schema";
import type { TournamentInscriptionsItem } from "@/modules/tournaments/domain/types";
import { normalizeText } from "@/components/features/turnos/player-combobox";
import { NewPlayerDialog } from "@/components/features/turnos/new-player-dialog";
import { AccountDialog } from "@/components/features/turnos/account-dialog";
import {
  PlayerEventsDialog,
  type PlayerEventsTarget,
} from "@/components/features/players/player-events-dialog";
import { TournamentFilterDialog } from "@/components/features/players/tournament-filter-dialog";
import { formatPhoneDisplay, whatsAppUrl } from "@/lib/phone";
import {
  deletePlayerAction,
  getPlayerProfileAction,
} from "@/app/(dashboard)/[clubSlug]/turnos/actions";
import {
  setPlayerInviteNoteAction,
  setPlayerInviteSentAction,
} from "@/app/(dashboard)/[clubSlug]/jugadores/actions";

const ALL_CATEGORIES = "";
const NO_CATEGORY = "__none__";
const ALL_GENDERS = "";
const ALL_CITIES = "";
const NO_CITY = "__none__";
const ALL_TOURNAMENTS = "";
const ALL_TOURNAMENT_CATEGORIES = "";

const FILTER_SELECT_CLASS =
  "h-8 max-w-[14rem] shrink-0 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function PlayersTable({
  clubSlug,
  currency,
  players,
  categories,
  tournaments = [],
}: {
  clubSlug: string;
  currency: string;
  players: PlayerListItem[];
  categories: string[];
  tournaments?: TournamentInscriptionsItem[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [gender, setGender] = useState(ALL_GENDERS);
  const [city, setCity] = useState(ALL_CITIES);
  const [tournamentId, setTournamentId] = useState(ALL_TOURNAMENTS);
  const [tournamentCategoryId, setTournamentCategoryId] = useState(
    ALL_TOURNAMENT_CATEGORIES,
  );
  const [tournamentPickerOpen, setTournamentPickerOpen] = useState(false);
  const [hideLatestInscribed, setHideLatestInscribed] = useState(false);
  const [sentOverride, setSentOverride] = useState<Record<string, boolean>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [newOpen, setNewOpen] = useState(false);
  const [accountPlayer, setAccountPlayer] = useState<PlayerRef | null>(null);
  const [eventsPlayer, setEventsPlayer] = useState<PlayerEventsTarget | null>(
    null,
  );
  const [editing, setEditing] = useState<{
    id: string;
    values: NewPlayerValues;
    photoUrl?: string | null;
  } | null>(null);
  const [, startLoad] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  function openEdit(p: PlayerListItem) {
    startLoad(async () => {
      const result = await getPlayerProfileAction(clubSlug, p.id);
      if (result.ok)
        setEditing({ id: p.id, values: result.profile, photoUrl: p.photoUrl });
      else toast.error("No se pudo abrir la ficha", { description: result.error });
    });
  }

  function messageWasSent(player: PlayerListItem) {
    if (player.id in sentOverride) return sentOverride[player.id]!;
    if (!player.inviteSentAt) return false;
    if (!latestTournament) return player.inviteForTournamentId == null;
    return player.inviteForTournamentId === latestTournament.id;
  }

  function toggleMessage(player: PlayerListItem) {
    const next = !messageWasSent(player);
    setSentOverride((current) => ({ ...current, [player.id]: next }));
    void setPlayerInviteSentAction(
      clubSlug,
      player.id,
      latestTournament?.id ?? null,
      next,
    ).then((result) => {
      if (result.ok) return;
      setSentOverride((current) => {
        const copy = { ...current };
        delete copy[player.id];
        return copy;
      });
      toast.error("No se pudo guardar la marca", { description: result.error });
    });
  }

  function savedObservation(player: PlayerListItem) {
    if (!player.inviteNote) return "";
    if (!latestTournament) {
      return player.inviteForTournamentId == null ? player.inviteNote : "";
    }
    return player.inviteForTournamentId === latestTournament.id
      ? player.inviteNote
      : "";
  }

  function observationText(player: PlayerListItem) {
    return player.id in noteDraft ? noteDraft[player.id]! : savedObservation(player);
  }

  function commitObservation(player: PlayerListItem) {
    const value = observationText(player);
    const trimmed = value.trim();
    if (trimmed === savedObservation(player)) {
      if (player.id in noteDraft && noteDraft[player.id] !== trimmed) {
        setNoteDraft((current) => ({ ...current, [player.id]: trimmed }));
      }
      return;
    }
    setNoteDraft((current) => ({ ...current, [player.id]: trimmed }));
    void setPlayerInviteNoteAction(
      clubSlug,
      player.id,
      latestTournament?.id ?? null,
      trimmed,
    ).then((result) => {
      if (result.ok) return;
      setNoteDraft((current) => {
        const copy = { ...current };
        delete copy[player.id];
        return copy;
      });
      toast.error("No se pudo guardar la observación", {
        description: result.error,
      });
    });
  }

  function removePlayer(p: PlayerListItem) {
    const ok = window.confirm(
      `¿Eliminar a ${p.fullName} de este club?\n\nEsta acción no se puede deshacer.`,
    );
    if (!ok) return;

    startDelete(async () => {
      const result = await deletePlayerAction(clubSlug, p.id);
      if (result.ok) {
        toast.success("Jugador eliminado");
        router.refresh();
      } else {
        toast.error("No se pudo eliminar", { description: result.error });
      }
    });
  }

  const categoryOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: string[] = [];
    for (const name of categories) {
      const trimmed = name.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      options.push(trimmed);
    }
    for (const player of players) {
      const name = player.category?.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      options.push(name);
    }
    return options;
  }, [categories, players]);

  const hasUncategorized = useMemo(
    () => players.some((p) => !p.category?.trim()),
    [players],
  );

  const cityOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: string[] = [];
    for (const player of players) {
      const name = player.city?.trim();
      if (!name) continue;
      const key = normalizeText(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      options.push(name);
    }
    return options.sort((a, b) => a.localeCompare(b, "es"));
  }, [players]);

  const hasNoCity = useMemo(
    () => players.some((p) => !p.city?.trim()),
    [players],
  );

  const selectedTournament = useMemo(
    () => tournaments.find((t) => t.id === tournamentId) ?? null,
    [tournaments, tournamentId],
  );

  const selectedTournamentCategory = useMemo(
    () =>
      selectedTournament?.categories.find((c) => c.id === tournamentCategoryId) ??
      null,
    [selectedTournament, tournamentCategoryId],
  );

  const tournamentButtonLabel = selectedTournament
    ? selectedTournamentCategory
      ? `${selectedTournament.name} · ${selectedTournamentCategory.name}`
      : selectedTournament.name
    : "Todos los torneos";

  const latestTournament = useMemo(() => {
    let latest: TournamentInscriptionsItem | null = null;
    for (const item of tournaments) {
      if (!latest || item.startDate > latest.startDate) latest = item;
    }
    return latest;
  }, [tournaments]);

  const latestInscribedIds = useMemo(() => {
    const ids = new Set<string>();
    if (!latestTournament) return ids;
    for (const category of latestTournament.categories) {
      for (const id of category.playerIds) ids.add(id);
    }
    return ids;
  }, [latestTournament]);

  /// IDs inscriptos en el torneo (o en una de sus categorías). Null = sin filtro de torneo.
  const inscribedIds = useMemo(() => {
    if (!selectedTournament) return null;
    const scope =
      tournamentCategoryId === ALL_TOURNAMENT_CATEGORIES
        ? selectedTournament.categories
        : selectedTournament.categories.filter(
            (c) => c.id === tournamentCategoryId,
          );
    const ids = new Set<string>();
    for (const category of scope) {
      for (const id of category.playerIds) ids.add(id);
    }
    return ids;
  }, [selectedTournament, tournamentCategoryId]);

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    return players.filter((p) => {
      if (inscribedIds && !inscribedIds.has(p.id)) return false;
      if (hideLatestInscribed && latestInscribedIds.has(p.id)) return false;
      if (q && !normalizeText(p.fullName).includes(q) && !normalizeText(p.city ?? "").includes(q)) return false;
      if (category === NO_CATEGORY) {
        if (p.category?.trim()) return false;
      } else if (category !== ALL_CATEGORIES && p.category?.trim() !== category) {
        return false;
      }
      if (gender !== ALL_GENDERS && p.gender !== gender) return false;
      if (city === NO_CITY) {
        if (p.city?.trim()) return false;
      } else if (
        city !== ALL_CITIES &&
        normalizeText(p.city ?? "") !== normalizeText(city)
      ) {
        return false;
      }
      return true;
    });
  }, [
    players,
    query,
    category,
    gender,
    city,
    inscribedIds,
    hideLatestInscribed,
    latestInscribedIds,
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div className="relative max-w-xs min-w-40 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar jugador..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className={FILTER_SELECT_CLASS}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filtrar por categoría"
            title="Filtrar por categoría"
          >
            <option value={ALL_CATEGORIES}>Todas las categorías</option>
            {hasUncategorized && (
              <option value={NO_CATEGORY}>Sin categoría</option>
            )}
            {categoryOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            className={FILTER_SELECT_CLASS}
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            aria-label="Filtrar por género"
            title="Filtrar por género"
          >
            <option value={ALL_GENDERS}>Todos</option>
            <option value="MALE">Masculino</option>
            <option value="FEMALE">Femenina</option>
          </select>
          <select
            className={FILTER_SELECT_CLASS}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            aria-label="Filtrar por localidad"
            title="Filtrar por localidad"
          >
            <option value={ALL_CITIES}>Todas las localidades</option>
            {hasNoCity && <option value={NO_CITY}>Sin localidad</option>}
            {cityOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {tournaments.length > 0 && (
            <Button
              type="button"
              variant="outline"
              className="max-w-[18rem] justify-between"
              onClick={() => setTournamentPickerOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={tournamentPickerOpen}
              title="Elegir torneo y categoría"
            >
              <Trophy className="size-4" />
              <span className="min-w-0 truncate">{tournamentButtonLabel}</span>
              <ChevronDown className="size-4" />
            </Button>
          )}
          {latestTournament && (
            <Button
              type="button"
              variant={hideLatestInscribed ? "default" : "outline"}
              aria-pressed={hideLatestInscribed}
              title={`Muestra a quien no está inscripto en ${latestTournament.name}, para invitar`}
              onClick={() => setHideLatestInscribed((value) => !value)}
            >
              Para invitar
            </Button>
          )}
          <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {filtered.length}{" "}
            {filtered.length === 1 ? "jugador" : "jugadores"}
          </span>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <UserPlus className="size-4" />
          Nuevo jugador
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2" />
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 text-center font-medium">Mensaje</th>
              <th className="px-3 py-2 font-medium">Observación</th>
              <th className="px-3 py-2 font-medium">Teléfono</th>
              <th className="px-3 py-2 font-medium">Localidad</th>
              <th className="px-3 py-2 font-medium">Categoría</th>
              <th className="px-3 py-2 font-medium">Posición</th>
              <th className="px-3 py-2 text-right font-medium">Ranking</th>
              <th className="px-3 py-2 text-right font-medium">Puntos</th>
              <th className="px-3 py-2 text-right font-medium">Saldo</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={12}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  {players.length === 0
                    ? "Sin jugadores."
                    : "Ningún jugador coincide con el filtro."}
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="border-b last:border-b-0">
                  <td className="py-2 pl-3">
                    <Avatar name={p.fullName} url={p.photoUrl} />
                  </td>
                  <td className="px-3 py-2 font-medium">{p.fullName}</td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      className="size-4 accent-foreground"
                      checked={messageWasSent(p)}
                      onChange={() => toggleMessage(p)}
                      aria-label={
                        messageWasSent(p)
                          ? `Mensaje enviado a ${p.fullName}`
                          : `Sin mensaje a ${p.fullName}`
                      }
                      title={
                        messageWasSent(p)
                          ? "Mensaje enviado"
                          : "Todavía no se mandó el mensaje"
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      value={observationText(p)}
                      placeholder="Observación"
                      aria-label={`Observación de ${p.fullName}`}
                      maxLength={500}
                      className="h-8 w-44"
                      onChange={(event) =>
                        setNoteDraft((current) => ({
                          ...current,
                          [p.id]: event.target.value,
                        }))
                      }
                      onBlur={() => commitObservation(p)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span>{formatPhoneDisplay(p.phone) || "—"}</span>
                      {whatsAppUrl(p.phone) && (
                        <a
                          href={whatsAppUrl(p.phone)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-700"
                          title="Abrir WhatsApp"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MessageCircle className="size-4" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {p.city?.trim() || "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {p.category || "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {p.courtPosition
                      ? COURT_POSITION_LABELS[p.courtPosition as CourtPosition]
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {p.ranking ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {p.accumulatedPoints}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span
                      className={cn(
                        p.balance > 0 && "text-rose-600 dark:text-rose-400",
                        p.balance < 0 &&
                          "text-emerald-600 dark:text-emerald-400",
                      )}
                    >
                      {formatMoney(Math.abs(p.balance), currency)}
                    </span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      {p.balance > 0 ? "debe" : p.balance < 0 ? "a favor" : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(p)}
                      >
                        <Pencil className="size-4" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setEventsPlayer({
                            id: p.id,
                            name: p.fullName,
                            category: p.category,
                          })
                        }
                      >
                        <History className="size-4" />
                        Sucesos
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setAccountPlayer({ id: p.id, name: p.fullName })
                        }
                      >
                        <Wallet className="size-4" />
                        Cuenta
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isDeleting}
                        onClick={() => removePlayer(p)}
                        aria-label={`Eliminar a ${p.fullName}`}
                        title="Eliminar"
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">Eliminar</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TournamentFilterDialog
        open={tournamentPickerOpen}
        onOpenChange={setTournamentPickerOpen}
        tournaments={tournaments}
        selectedTournamentId={tournamentId}
        selectedCategoryId={tournamentCategoryId}
        onApply={(nextTournamentId, nextCategoryId) => {
          setTournamentId(nextTournamentId);
          setTournamentCategoryId(nextCategoryId);
        }}
      />

      <NewPlayerDialog
        clubSlug={clubSlug}
        categories={categories}
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={() => router.refresh()}
      />

      <NewPlayerDialog
        clubSlug={clubSlug}
        categories={categories}
        editing={editing}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
        onPhotoChanged={() => router.refresh()}
      />

      <PlayerEventsDialog
        clubSlug={clubSlug}
        categories={categories}
        player={eventsPlayer}
        open={eventsPlayer !== null}
        onOpenChange={(o) => !o && setEventsPlayer(null)}
      />

      <AccountDialog
        clubSlug={clubSlug}
        player={accountPlayer}
        currency={currency}
        open={accountPlayer !== null}
        onOpenChange={(o) => !o && setAccountPlayer(null)}
        onChanged={() => router.refresh()}
      />
    </div>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div className="grid size-8 place-items-center overflow-hidden rounded-full border bg-muted text-[11px] font-medium text-muted-foreground">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="size-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}
