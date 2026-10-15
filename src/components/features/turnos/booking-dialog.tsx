"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Unlock, UserPlus, Wallet, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatLongDate } from "@/lib/date";
import type {
  Booking,
  BookingType,
  PaymentStatus,
  PlayerRef,
  ReleasedFixedSlot,
} from "@/modules/bookings/domain/types";
import {
  isFixedOccurrenceId,
  isFixedType,
  MAX_PLAYERS_PER_BOOKING,
  templateIdFromOccurrence,
} from "@/modules/bookings/domain/rules";
import {
  confirmBookingAction,
  updateBookingAction,
  updateFixedBookingAction,
} from "@/app/(dashboard)/[clubSlug]/turnos/actions";
import {
  isPendingBookingId,
  type CreateDraft,
} from "./use-schedule-board";
import {
  BOOKING_TYPE_LABELS,
  BOOKING_TYPE_OPTIONS,
  PAYMENT_STATUS_META,
  SLOT_STATUS_STYLES,
} from "./booking-status";
import { PlayerCombobox } from "./player-combobox";
import { NewPlayerDialog } from "./new-player-dialog";
import { AccountDialog } from "./account-dialog";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

/// Celda seleccionada en el calendario (día o semana). Incluye la fecha.
export type BookingSelection = {
  booking: Booking | null;
  released: ReleasedFixedSlot | null;
  courtId: string;
  courtName: string;
  slot: string;
  date: string;
} | null;

export function BookingDialog({
  clubSlug,
  players,
  categories,
  requirePrePayment,
  defaultPrice,
  currency,
  selected,
  onClose,
  onDone,
  onCancelBooking,
  onCancelFixedSeries,
  onReleaseFixedDay,
  onRestoreFixedDay,
  onCreateBooking,
}: {
  clubSlug: string;
  players: PlayerRef[];
  categories: string[];
  requirePrePayment: boolean;
  defaultPrice: number;
  currency: string;
  selected: BookingSelection;
  onClose: () => void;
  onDone: () => void;
  onCancelBooking: (booking: Booking) => void;
  onCancelFixedSeries: (booking: Booking) => void;
  onReleaseFixedDay: (booking: Booking) => void;
  onRestoreFixedDay: (released: ReleasedFixedSlot) => void;
  onCreateBooking: (draft: CreateDraft) => void;
}) {
  const open = selected !== null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {selected && (
          <BookingDialogBody
            key={`${selected.date}|${selected.courtId}|${selected.slot}|${selected.booking?.id ?? ""}|${selected.released?.fixedBookingId ?? ""}`}
            clubSlug={clubSlug}
            players={players}
            categories={categories}
            requirePrePayment={requirePrePayment}
            defaultPrice={defaultPrice}
            currency={currency}
            selected={selected}
            onDone={onDone}
            onCancelBooking={onCancelBooking}
            onCancelFixedSeries={onCancelFixedSeries}
            onReleaseFixedDay={onReleaseFixedDay}
            onRestoreFixedDay={onRestoreFixedDay}
            onCreateBooking={onCreateBooking}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BookingDialogBody({
  clubSlug,
  players,
  categories,
  requirePrePayment,
  defaultPrice,
  currency,
  selected,
  onDone,
  onCancelBooking,
  onCancelFixedSeries,
  onReleaseFixedDay,
  onRestoreFixedDay,
  onCreateBooking,
}: {
  clubSlug: string;
  players: PlayerRef[];
  categories: string[];
  requirePrePayment: boolean;
  defaultPrice: number;
  currency: string;
  selected: NonNullable<BookingSelection>;
  onDone: () => void;
  onCancelBooking: (booking: Booking) => void;
  onCancelFixedSeries: (booking: Booking) => void;
  onReleaseFixedDay: (booking: Booking) => void;
  onRestoreFixedDay: (released: ReleasedFixedSlot) => void;
  onCreateBooking: (draft: CreateDraft) => void;
}) {
  const booking = selected.booking;
  const released = selected.released;
  const [creatingOnRelease, setCreatingOnRelease] = useState(false);
  const showReleased = released !== null && !booking && !creatingOnRelease;

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {booking
            ? "Detalle del turno"
            : showReleased
              ? "Turno fijo liberado"
              : "Nueva reserva"}
        </DialogTitle>
        <DialogDescription>
          {selected.courtName} · {selected.slot} hs
        </DialogDescription>
      </DialogHeader>

      {booking ? (
        <BookingDetail
          clubSlug={clubSlug}
          booking={booking}
          players={players}
          categories={categories}
          currency={currency}
          onDone={onDone}
          onCancelBooking={onCancelBooking}
          onCancelFixedSeries={onCancelFixedSeries}
          onReleaseFixedDay={onReleaseFixedDay}
        />
      ) : showReleased && released ? (
        <ReleasedFixedDetail
          released={released}
          onBookSomeone={() => setCreatingOnRelease(true)}
          onRestore={() => onRestoreFixedDay(released)}
        />
      ) : (
        <CreateBookingForm
          clubSlug={clubSlug}
          date={selected.date}
          courtId={selected.courtId}
          startTime={selected.slot}
          initialPlayers={players}
          categories={categories}
          requirePrePayment={requirePrePayment}
          defaultPrice={defaultPrice}
          singleDateOnly={released !== null}
          onCreateBooking={onCreateBooking}
        />
      )}
    </>
  );
}

function CreateBookingForm({
  clubSlug,
  date,
  courtId,
  startTime,
  initialPlayers,
  categories,
  requirePrePayment,
  defaultPrice,
  singleDateOnly = false,
  onCreateBooking,
}: {
  clubSlug: string;
  date: string;
  courtId: string;
  startTime: string;
  initialPlayers: PlayerRef[];
  categories: string[];
  requirePrePayment: boolean;
  defaultPrice: number;
  singleDateOnly?: boolean;
  onCreateBooking: (draft: CreateDraft) => void;
}) {
  const [players, setPlayers] = useState<PlayerRef[]>(initialPlayers);
  const [responsibleId, setResponsibleId] = useState("");
  const [slots, setSlots] = useState<string[]>(["", "", "", ""]);
  const [type, setType] = useState<BookingType>("NO_FIJO");
  const [payment, setPayment] = useState<PaymentStatus>(
    requirePrePayment ? "PAID" : "UNPAID",
  );

  const [newPlayerOpen, setNewPlayerOpen] = useState(false);
  const [newPlayerTarget, setNewPlayerTarget] = useState<
    number | "resp" | null
  >(null);

  function setSlot(index: number, id: string) {
    setSlots((prev) => prev.map((s, i) => (i === index ? id : s)));
  }

  function openNewPlayer(target: number | "resp") {
    setNewPlayerTarget(target);
    setNewPlayerOpen(true);
  }

  function onPlayerCreated(player: PlayerRef) {
    setPlayers((prev) => [...prev, player]);
    if (newPlayerTarget === "resp") setResponsibleId(player.id);
    else if (typeof newPlayerTarget === "number")
      setSlot(newPlayerTarget, player.id);
    setNewPlayerTarget(null);
  }

  function submit() {
    if (!responsibleId) {
      toast.error("Elegí un responsable");
      return;
    }
    const responsible = players.find((player) => player.id === responsibleId);
    if (!responsible) {
      toast.error("Elegí un responsable");
      return;
    }
    onCreateBooking({
      courtId,
      date,
      startTime,
      type,
      responsible,
      players: slots
        .filter(Boolean)
        .map((id) => players.find((player) => player.id === id))
        .filter((player): player is PlayerRef => player !== undefined),
      paymentStatus: payment,
      price: defaultPrice,
    });
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-col gap-1.5">
        <Label>Responsable</Label>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <PlayerCombobox
              players={players}
              value={responsibleId}
              onChange={setResponsibleId}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openNewPlayer("resp")}
          >
            <UserPlus className="size-4" />
            Nuevo
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Jugadores en cancha (4)</Label>
        <div className="flex flex-col gap-2">
          {slots.map((slotId, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="flex-1">
                <PlayerCombobox
                  players={players}
                  value={slotId}
                  onChange={(id) => setSlot(i, id)}
                  placeholder={`Jugador ${i + 1}...`}
                  exclude={slots.filter((s, j) => j !== i && s !== "")}
                />
              </div>
              {slotId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSlot(i, "")}
                  aria-label="Quitar jugador"
                >
                  <X className="size-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => openNewPlayer(i)}
                aria-label="Nuevo jugador"
              >
                <UserPlus className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          El responsable puede no jugar. Estos 4 campos son los participantes en
          cancha.
        </p>
      </div>

      <NewPlayerDialog
        clubSlug={clubSlug}
        categories={categories}
        open={newPlayerOpen}
        onOpenChange={setNewPlayerOpen}
        onCreated={onPlayerCreated}
      />

      {singleDateOnly && (
        <p className="text-xs text-muted-foreground">
          La reserva es solo para este día. El turno fijo sigue las demás
          semanas.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Tipo</Label>
          <BookingTypeSelect
            value={type}
            onChange={setType}
            options={
              singleDateOnly
                ? BOOKING_TYPE_OPTIONS.filter((option) => !isFixedType(option))
                : BOOKING_TYPE_OPTIONS
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Pago</Label>
          <select
            className={SELECT_CLASS}
            value={payment}
            onChange={(e) => setPayment(e.target.value as PaymentStatus)}
          >
            <option value="UNPAID">Sin pagar</option>
            <option value="PARTIAL">Seña</option>
            <option value="PAID">Pagado</option>
          </select>
        </div>
      </div>

      {requirePrePayment && (
        <p className="text-xs text-muted-foreground">
          Este club requiere pago previo para confirmar reservas.
        </p>
      )}

      <Button onClick={submit}>Crear reserva</Button>
    </div>
  );
}

function BookingDetail({
  clubSlug,
  booking,
  players,
  categories,
  currency,
  onDone,
  onCancelBooking,
  onCancelFixedSeries,
  onReleaseFixedDay,
}: {
  clubSlug: string;
  booking: Booking;
  players: PlayerRef[];
  categories: string[];
  currency: string;
  onDone: () => void;
  onCancelBooking: (booking: Booking) => void;
  onCancelFixedSeries: (booking: Booking) => void;
  onReleaseFixedDay: (booking: Booking) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  const [localPlayers, setLocalPlayers] = useState<PlayerRef[]>(players);
  const [responsibleId, setResponsibleId] = useState(booking.responsible.id);
  const [slots, setSlots] = useState<string[]>(() => {
    const ids = booking.players.map((p) => p.id);
    return [0, 1, 2, 3].map((i) => ids[i] ?? "");
  });
  const [type, setType] = useState<BookingType>(booking.type);
  const [status, setStatus] = useState<"PRE_RESERVA" | "RESERVADO">(
    booking.status,
  );
  const [payment, setPayment] = useState<PaymentStatus>(booking.paymentStatus);

  const [newPlayerOpen, setNewPlayerOpen] = useState(false);
  const [newPlayerTarget, setNewPlayerTarget] = useState<
    number | "resp" | null
  >(null);
  const [accountPlayer, setAccountPlayer] = useState<PlayerRef | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);

  if (isPendingBookingId(booking.id)) {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <div>
          <p className="text-muted-foreground">Responsable</p>
          <p className="font-medium">{booking.responsible.name}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          El turno ya figura en la grilla. Se está confirmando con el servidor.
        </p>
        <Button variant="destructive" onClick={() => onCancelBooking(booking)}>
          Cancelar turno
        </Button>
      </div>
    );
  }

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    okMsg: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(okMsg);
        onDone();
      } else {
        toast.error("Error", { description: result.error });
      }
    });
  }

  function saveFixed() {
    if (!responsibleId) {
      toast.error("Elegí un responsable");
      return;
    }
    startTransition(async () => {
      const result = await updateFixedBookingAction(
        clubSlug,
        templateIdFromOccurrence(booking.id),
        booking.date,
        {
          type,
          responsibleId,
          playerIds: slots.filter(Boolean),
        },
      );
      if (result.ok) {
        toast.success(
          isFixedType(type) ? "Turno fijo actualizado" : "Turno actualizado",
        );
        onDone();
      } else {
        toast.error("No se pudo guardar", { description: result.error });
      }
    });
  }

  if (isFixedOccurrenceId(booking.id)) {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex items-center gap-2">
          <Badge>{SLOT_STATUS_STYLES.RESERVADO.label}</Badge>
          <Badge variant="outline">{BOOKING_TYPE_LABELS[booking.type]}</Badge>
        </div>
        <label className="flex w-fit items-center gap-2 text-sm">
          <Checkbox
            checked={editing}
            onCheckedChange={(v) => setEditing(v === true)}
          />
          Editar información
        </label>
        {editing ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label>Responsable</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <PlayerCombobox
                    players={localPlayers}
                    value={responsibleId}
                    onChange={setResponsibleId}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openNewPlayer("resp")}
                >
                  <UserPlus className="size-4" />
                  Nuevo
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Jugadores en cancha (4)</Label>
              <div className="flex flex-col gap-2">
                {slots.map((slotId, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="flex-1">
                      <PlayerCombobox
                        players={localPlayers}
                        value={slotId}
                        onChange={(id) => setSlot(i, id)}
                        placeholder={`Jugador ${i + 1}...`}
                        exclude={slots.filter((s, j) => j !== i && s !== "")}
                      />
                    </div>
                    {slotId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setSlot(i, "")}
                        aria-label="Quitar jugador"
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => openNewPlayer(i)}
                      aria-label="Nuevo jugador"
                    >
                      <UserPlus className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                El responsable puede no jugar. Estos cambios valen para todas
                las semanas de este turno fijo.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Tipo de turno</Label>
              <BookingTypeSelect value={type} onChange={setType} />
              {!isFixedType(type) && (
                <p className="text-xs text-muted-foreground">
                  Al guardar, el turno deja de repetirse. Queda solo la
                  reserva del {formatLongDate(booking.date)}.
                </p>
              )}
            </div>
            <Button disabled={isPending} onClick={saveFixed}>
              {isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </>
        ) : (
          <>
            <div>
              <p className="text-muted-foreground">Responsable</p>
              <NameRow
                name={booking.responsible.name}
                bold
                onAccount={() => setAccountPlayer(booking.responsible)}
              />
            </div>
            <div>
              <p className="text-muted-foreground">
                Jugadores ({booking.players.length}/{MAX_PLAYERS_PER_BOOKING})
              </p>
              {booking.players.length === 0 ? (
                <p className="text-muted-foreground/60">Sin jugadores cargados</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {booking.players.map((p) => (
                    <NameRow
                      key={p.id}
                      name={p.name}
                      onAccount={() => setAccountPlayer(p)}
                    />
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Se repite todas las semanas en este día y horario. Duración{" "}
              {booking.durationMin} min. Si el dueño no puede usarlo esta vez,
              se libera solo esa fecha y el turno sigue fijo.
            </p>
          </>
        )}
        {!editing &&
          (confirmRelease ? (
            <div className="flex flex-col gap-2 rounded-lg border p-3">
              <p>
                {formatLongDate(booking.date)} queda libre. El turno fijo de{" "}
                {booking.responsible.name} sigue las demás semanas.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={isPending}
                  onClick={() => setConfirmRelease(false)}
                >
                  Volver
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => onReleaseFixedDay(booking)}
                >
                  Liberar este día
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => setConfirmRelease(true)}
              >
                <Unlock className="size-4" />
                Liberar momentáneamente
              </Button>
              <Button
                variant="destructive"
                onClick={() => onCancelFixedSeries(booking)}
              >
                Cancelar turno fijo (toda la serie)
              </Button>
            </>
          ))}
        <NewPlayerDialog
          clubSlug={clubSlug}
          categories={categories}
          open={newPlayerOpen}
          onOpenChange={setNewPlayerOpen}
          onCreated={onPlayerCreated}
        />
        <AccountDialog
          clubSlug={clubSlug}
          player={accountPlayer}
          currency={currency}
          open={accountPlayer !== null}
          onOpenChange={(o) => !o && setAccountPlayer(null)}
        />
      </div>
    );
  }

  function setSlot(index: number, id: string) {
    setSlots((prev) => prev.map((s, i) => (i === index ? id : s)));
  }

  function openNewPlayer(target: number | "resp") {
    setNewPlayerTarget(target);
    setNewPlayerOpen(true);
  }

  function onPlayerCreated(player: PlayerRef) {
    setLocalPlayers((prev) => [...prev, player]);
    if (newPlayerTarget === "resp") setResponsibleId(player.id);
    else if (typeof newPlayerTarget === "number")
      setSlot(newPlayerTarget, player.id);
    setNewPlayerTarget(null);
  }

  function save() {
    startTransition(async () => {
      const result = await updateBookingAction(clubSlug, booking.id, booking.date, {
        type,
        responsibleId,
        playerIds: slots.filter(Boolean),
        status,
        paymentStatus: payment,
        price: booking.price,
      });
      if (result.ok) {
        toast.success("Cambios guardados");
        onDone();
      } else {
        toast.error("No se pudo guardar", { description: result.error });
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center gap-2">
        <Badge variant={booking.status === "RESERVADO" ? "default" : "secondary"}>
          {SLOT_STATUS_STYLES[booking.status].label}
        </Badge>
        <Badge variant="outline">{BOOKING_TYPE_LABELS[booking.type]}</Badge>
      </div>

      <label className="flex w-fit items-center gap-2 text-sm">
        <Checkbox
          checked={editing}
          onCheckedChange={(v) => setEditing(v === true)}
        />
        Editar información
      </label>

      {editing ? (
        <>
          <div className="flex flex-col gap-1.5">
            <Label>Responsable</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <PlayerCombobox
                  players={localPlayers}
                  value={responsibleId}
                  onChange={setResponsibleId}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openNewPlayer("resp")}
              >
                <UserPlus className="size-4" />
                Nuevo
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Jugadores en cancha (4)</Label>
            <div className="flex flex-col gap-2">
              {slots.map((slotId, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="flex-1">
                    <PlayerCombobox
                      players={localPlayers}
                      value={slotId}
                      onChange={(id) => setSlot(i, id)}
                      placeholder={`Jugador ${i + 1}...`}
                      exclude={slots.filter((s, j) => j !== i && s !== "")}
                    />
                  </div>
                  {slotId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setSlot(i, "")}
                      aria-label="Quitar jugador"
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => openNewPlayer(i)}
                    aria-label="Nuevo jugador"
                  >
                    <UserPlus className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              El responsable puede no jugar. Estos 4 campos son los
              participantes en cancha.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Tipo de turno</Label>
              <BookingTypeSelect
                value={type}
                onChange={(next) => {
                  setType(next);
                  if (isFixedType(next)) setStatus("RESERVADO");
                }}
              />
            </div>
            {isFixedType(type) ? (
              <p className="flex items-end text-xs text-muted-foreground">
                {isFixedType(booking.type)
                  ? "El turno fijo queda reservado. No usa pre-reserva."
                  : `Al guardar, se repite todas las semanas desde el ${formatLongDate(booking.date)}.`}
              </p>
            ) : (
            <div className="flex flex-col gap-1.5">
              <Label>Estado</Label>
              <select
                className={SELECT_CLASS}
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "PRE_RESERVA" | "RESERVADO")
                }
              >
                <option value="PRE_RESERVA">Pre-reserva</option>
                <option value="RESERVADO">Reservado</option>
              </select>
            </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label>Pago</Label>
              <select
                className={SELECT_CLASS}
                value={payment}
                onChange={(e) => setPayment(e.target.value as PaymentStatus)}
              >
                <option value="UNPAID">Sin pagar</option>
                <option value="PARTIAL">Seña</option>
                <option value="PAID">Pagado</option>
              </select>
            </div>
          </div>
        </>
      ) : (
        <>
          <div>
            <p className="text-muted-foreground">Responsable</p>
            <NameRow
              name={booking.responsible.name}
              bold
              onAccount={() => setAccountPlayer(booking.responsible)}
            />
          </div>
          <div>
            <p className="text-muted-foreground">
              Jugadores ({booking.players.length}/{MAX_PLAYERS_PER_BOOKING})
            </p>
            {booking.players.length === 0 ? (
              <p className="text-muted-foreground/60">Sin jugadores cargados</p>
            ) : (
              <div className="flex flex-col gap-1">
                {booking.players.map((p) => (
                  <NameRow
                    key={p.id}
                    name={p.name}
                    onAccount={() => setAccountPlayer(p)}
                  />
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Usá el botón junto a cada nombre para cargar un pago o una compra
              en su cuenta.
            </p>
          </div>
          <p className="text-sm">
            Pago:{" "}
            <span className={PAYMENT_STATUS_META[booking.paymentStatus].className}>
              {PAYMENT_STATUS_META[booking.paymentStatus].label}
            </span>
          </p>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Duración {booking.durationMin} min · Moneda {currency}
      </p>

      <div className="flex gap-2">
        {editing ? (
          <Button className="flex-1" disabled={isPending} onClick={save}>
            {isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
        ) : (
          booking.status === "PRE_RESERVA" && (
            <Button
              className="flex-1"
              disabled={isPending}
              onClick={() =>
                run(
                  () => confirmBookingAction(clubSlug, booking.id),
                  "Reserva confirmada",
                )
              }
            >
              Confirmar reserva
            </Button>
          )
        )}
        <Button
          variant="destructive"
          className="flex-1"
          onClick={() => onCancelBooking(booking)}
        >
          Cancelar turno
        </Button>
      </div>

      <NewPlayerDialog
        clubSlug={clubSlug}
        categories={categories}
        open={newPlayerOpen}
        onOpenChange={setNewPlayerOpen}
        onCreated={onPlayerCreated}
      />

      <AccountDialog
        clubSlug={clubSlug}
        player={accountPlayer}
        currency={currency}
        open={accountPlayer !== null}
        onOpenChange={(o) => !o && setAccountPlayer(null)}
      />
    </div>
  );
}

function ReleasedFixedDetail({
  released,
  onBookSomeone,
  onRestore,
}: {
  released: ReleasedFixedSlot;
  onBookSomeone: () => void;
  onRestore: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center gap-2">
        <Badge variant="outline">Disponible</Badge>
        <Badge variant="outline">Turno fijo liberado</Badge>
      </div>
      <div>
        <p className="text-muted-foreground">Dueño del turno fijo</p>
        <p className="font-medium">{released.responsible.name}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Sigue siendo su turno fijo. {formatLongDate(released.date)} está libre
        porque no lo puede usar. Las demás semanas no cambian.
      </p>
      <Button onClick={onBookSomeone}>Reservar para otra persona</Button>
      <Button variant="outline" onClick={onRestore}>
        Devolver al dueño
      </Button>
    </div>
  );
}

function BookingTypeSelect({
  value,
  onChange,
  options = BOOKING_TYPE_OPTIONS,
}: {
  value: BookingType;
  onChange: (type: BookingType) => void;
  options?: BookingType[];
}) {
  return (
    <select
      className={SELECT_CLASS}
      value={value}
      onChange={(e) => onChange(e.target.value as BookingType)}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {BOOKING_TYPE_LABELS[option]}
        </option>
      ))}
    </select>
  );
}

/// Fila de nombre con botón para abrir/cargar su cuenta (pago o compra).
function NameRow({
  name,
  bold,
  onAccount,
}: {
  name: string;
  bold?: boolean;
  onAccount: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={bold ? "font-medium" : undefined}>{name}</span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={onAccount}
        aria-label={`Cuenta de ${name}`}
        title="Cargar pago o compra"
      >
        <Wallet className="size-4" />
      </Button>
    </div>
  );
}
