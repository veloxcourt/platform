"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, Wallet, X } from "lucide-react";
import { toast } from "sonner";

import { AccountDialog } from "@/components/features/turnos/account-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { normalizeText } from "@/components/features/turnos/player-combobox";
import type { PlayerRef } from "@/modules/bookings/domain/types";
import type {
  PairListItem,
  SlotReservationItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import {
  updatePairPlayerConfirmationAction,
  updatePairPlayerPaymentAction,
  updatePairStatusAction,
} from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/actions";
import { EditPairDialog } from "./edit-pair-dialog";

type RowFilter = "all" | "incomplete" | "pending";

const ROW_FILTER_LABELS: Record<RowFilter, string> = {
  all: "Todas",
  incomplete: "Sin compañero",
  pending: "Sin confirmar",
};

function pairRowState(pair: PairListItem) {
  if (pair.status === "CANCELLED") return "cancelled" as const;
  if (!pair.player2) return "incomplete" as const;
  if (pair.status === "CONFIRMED") return "confirmed" as const;
  return "pending" as const;
}

export function PairsTable({
  clubSlug,
  tournamentId,
  currency,
  pairs,
  players,
  categories,
  config,
  courtCount,
  reservations,
  categoryFilterId = null,
  onCategoryFilterChange,
}: {
  clubSlug: string;
  tournamentId: string;
  currency: string;
  pairs: PairListItem[];
  players: PlayerRef[];
  categories: TournamentCategoryItem[];
  config: TournamentConfig | null;
  courtCount: number;
  reservations: SlotReservationItem[];
  categoryFilterId?: string | null;
  onCategoryFilterChange?: (categoryId: string | null) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [rowFilter, setRowFilter] = useState<RowFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [addCategoryId, setAddCategoryId] = useState<string | null>(null);
  const [editPair, setEditPair] = useState<PairListItem | null>(null);
  const [accountPlayer, setAccountPlayer] = useState<PlayerRef | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    return pairs.filter((pair) => {
      if (pair.status === "CANCELLED") return false;
      if (categoryFilterId && pair.categoryId !== categoryFilterId) return false;
      const state = pairRowState(pair);
      if (rowFilter === "incomplete" && state !== "incomplete") return false;
      if (rowFilter === "pending" && state !== "pending") return false;
      if (!q) return true;
      return (
        normalizeText(pair.player1.name).includes(q) ||
        normalizeText(pair.player2?.name ?? "").includes(q) ||
        normalizeText(pair.categoryName).includes(q) ||
        normalizeText(pair.zoneLabel ?? "").includes(q)
      );
    });
  }, [pairs, query, rowFilter, categoryFilterId]);

  function openAdd(categoryId?: string) {
    const id = categoryId ?? categoryFilterId ?? categories[0]?.id ?? null;
    if (!id) {
      toast.error("Agregá una categoría antes de inscribir");
      return;
    }
    setAddCategoryId(id);
    onCategoryFilterChange?.(id);
    setAddOpen(true);
  }

  function runToggle(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        router.refresh();
      } else {
        toast.error("Error", { description: result.error });
      }
    });
  }

  function runAction(
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error("Error", { description: result.error });
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {categories.map((category) => (
            <Button
              key={category.id}
              type="button"
              variant={
                categoryFilterId === category.id ? "secondary" : "outline"
              }
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => onCategoryFilterChange?.(category.id)}
            >
              {category.name}
            </Button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar inscripción..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            {(Object.keys(ROW_FILTER_LABELS) as RowFilter[]).map((key) => (
              <Button
                key={key}
                type="button"
                variant={rowFilter === key ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setRowFilter(key)}
              >
                {ROW_FILTER_LABELS[key]}
              </Button>
            ))}
          </div>
          <Button
            onClick={() => openAdd()}
            disabled={categories.length === 0 || !categoryFilterId}
          >
            <Plus className="size-4" />
            Inscribir
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Jugadores</th>
              <th className="px-3 py-2 font-medium">Categoría</th>
              <th className="px-3 py-2 font-medium">Zona</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="w-20 px-3 py-2 text-center font-medium">Confirmó</th>
              <th className="w-20 px-3 py-2 text-center font-medium">Pagó</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  Sin inscripciones.
                </td>
              </tr>
            ) : (
              filtered.map((pair) => {
                const inactive = pair.status === "CANCELLED";
                const toggleDisabled = isPending || inactive;
                const rowState = pairRowState(pair);

                return (
                  <tr
                    key={pair.id}
                    className={cn(
                      "border-b last:border-b-0",
                      rowState === "incomplete" && "bg-amber-50/40 dark:bg-amber-950/10",
                    )}
                  >
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1.5">
                        <PairPlayerRow
                          name={pair.player1.name}
                          onAccount={() =>
                            setAccountPlayer({
                              id: pair.player1.id,
                              name: pair.player1.name,
                            })
                          }
                        />
                        {pair.player2 ? (
                          <PairPlayerRow
                            name={pair.player2.name}
                            onAccount={() =>
                              setAccountPlayer({
                                id: pair.player2!.id,
                                name: pair.player2!.name,
                              })
                            }
                          />
                        ) : (
                          <span className="text-sm italic text-muted-foreground">
                            Sin compañero
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {pair.categoryName}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {pair.zoneLabel || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <PairStateBadge state={rowState} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-center gap-3">
                        <PlayerToggle
                          checked={pair.player1Confirmed}
                          disabled={toggleDisabled}
                          label={`Confirmó ${pair.player1.name}`}
                          onToggle={(checked) =>
                            runToggle(() =>
                              updatePairPlayerConfirmationAction(
                                clubSlug,
                                tournamentId,
                                pair.id,
                                1,
                                checked,
                              ),
                            )
                          }
                        />
                        {pair.player2 ? (
                          <PlayerToggle
                            checked={pair.player2Confirmed}
                            disabled={toggleDisabled}
                            label={`Confirmó ${pair.player2.name}`}
                            onToggle={(checked) =>
                              runToggle(() =>
                                updatePairPlayerConfirmationAction(
                                  clubSlug,
                                  tournamentId,
                                  pair.id,
                                  2,
                                  checked,
                                ),
                              )
                            }
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-center gap-3">
                        <PlayerToggle
                          checked={pair.player1PaymentStatus === "PAID"}
                          disabled={toggleDisabled}
                          label={`Pagó ${pair.player1.name}`}
                          onToggle={(paid) =>
                            runToggle(() =>
                              updatePairPlayerPaymentAction(
                                clubSlug,
                                tournamentId,
                                pair.id,
                                1,
                                paid ? "PAID" : "UNPAID",
                              ),
                            )
                          }
                        />
                        {pair.player2 ? (
                          <PlayerToggle
                            checked={pair.player2PaymentStatus === "PAID"}
                            disabled={toggleDisabled}
                            label={`Pagó ${pair.player2.name}`}
                            onToggle={(paid) =>
                              runToggle(() =>
                                updatePairPlayerPaymentAction(
                                  clubSlug,
                                  tournamentId,
                                  pair.id,
                                  2,
                                  paid ? "PAID" : "UNPAID",
                                ),
                              )
                            }
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {!inactive && (
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isPending}
                            onClick={() => setEditPair(pair)}
                          >
                            <Pencil className="size-4" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isPending}
                            onClick={() =>
                              runAction(
                                () =>
                                  updatePairStatusAction(
                                    clubSlug,
                                    tournamentId,
                                    pair.id,
                                    "CANCELLED",
                                  ),
                                "Inscripción eliminada",
                              )
                            }
                          >
                            <X className="size-4" />
                            <span className="sr-only">Eliminar</span>
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <EditPairDialog
        clubSlug={clubSlug}
        tournamentId={tournamentId}
        mode={addOpen ? "add" : "edit"}
        pair={addOpen ? null : editPair}
        players={players}
        pairs={pairs}
        categories={categories}
        config={config}
        courtCount={courtCount}
        reservations={reservations}
        defaultCategoryId={addOpen ? addCategoryId : null}
        lockCategory={addOpen && Boolean(addCategoryId)}
        open={addOpen || editPair !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAddOpen(false);
            setAddCategoryId(null);
            setEditPair(null);
          }
        }}
        onSaved={() => router.refresh()}
      />

      <AccountDialog
        clubSlug={clubSlug}
        player={accountPlayer}
        currency={currency}
        open={accountPlayer !== null}
        onOpenChange={(open) => !open && setAccountPlayer(null)}
      />
    </div>
  );
}

function PairStateBadge({
  state,
}: {
  state: ReturnType<typeof pairRowState>;
}) {
  if (state === "cancelled") {
    return <Badge variant="outline">Cancelada</Badge>;
  }
  if (state === "incomplete") {
    return <Badge variant="secondary">Sin compañero</Badge>;
  }
  if (state === "confirmed") {
    return <Badge>Confirmada</Badge>;
  }
  return <Badge variant="outline">Pendiente</Badge>;
}

function PairPlayerRow({
  name,
  onAccount,
}: {
  name: string;
  onAccount: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={onAccount}
        aria-label={`Cuenta de ${name}`}
        title="Cuenta corriente: cargar inscripción o pago"
      >
        <Wallet className="size-4" />
      </Button>
    </div>
  );
}

function PlayerToggle({
  checked,
  disabled,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <Checkbox
      checked={checked}
      disabled={disabled}
      aria-label={label}
      title={label}
      onCheckedChange={(value) => onToggle(value === true)}
    />
  );
}
