"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Search,
  Trash2,
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
import { normalizeText } from "@/components/features/turnos/player-combobox";
import { NewPlayerDialog } from "@/components/features/turnos/new-player-dialog";
import { AccountDialog } from "@/components/features/turnos/account-dialog";
import { formatPhoneDisplay, whatsAppUrl } from "@/lib/phone";
import {
  deletePlayerAction,
  getPlayerProfileAction,
} from "@/app/(dashboard)/[clubSlug]/turnos/actions";

export function PlayersTable({
  clubSlug,
  currency,
  players,
  categories,
}: {
  clubSlug: string;
  currency: string;
  players: PlayerListItem[];
  categories: string[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [accountPlayer, setAccountPlayer] = useState<PlayerRef | null>(null);
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

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    return q
      ? players.filter((p) => normalizeText(p.fullName).includes(q))
      : players;
  }, [players, query]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar jugador..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <UserPlus className="size-4" />
          Nuevo jugador
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2" />
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">Teléfono</th>
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
                  colSpan={9}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  Sin jugadores.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="border-b last:border-b-0">
                  <td className="py-2 pl-3">
                    <Avatar name={p.fullName} url={p.photoUrl} />
                  </td>
                  <td className="px-3 py-2 font-medium">{p.fullName}</td>
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
