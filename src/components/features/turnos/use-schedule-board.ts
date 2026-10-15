"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  cancelBookingAction,
  cancelFixedBookingAction,
  createBookingAction,
  releaseFixedOccurrenceAction,
  restoreFixedOccurrenceAction,
} from "@/app/(dashboard)/[clubSlug]/turnos/actions";
import {
  fixedOccurrenceId,
  isFixedOccurrenceId,
  isFixedType,
  templateIdFromOccurrence,
  timeToMinutes,
} from "@/modules/bookings/domain/rules";
import type {
  Booking,
  BookingType,
  PaymentStatus,
  PlayerRef,
  ReleasedFixedSlot,
} from "@/modules/bookings/domain/types";
import { BOOKING_TYPE_LABELS } from "./booking-status";

const PENDING_PREFIX = "pending:";

export function isPendingBookingId(id: string): boolean {
  return id.startsWith(PENDING_PREFIX);
}

/// Minutos que separan dos horarios seguidos. Alcanza para pintar la celda
/// tocada hasta que el servidor devuelve la duración real.
export function slotSpanMin(slots: string[]): number {
  if (slots.length < 2) return 90;
  const span = timeToMinutes(slots[1]) - timeToMinutes(slots[0]);
  return span > 0 ? span : 90;
}

export type CreateDraft = {
  courtId: string;
  date: string;
  startTime: string;
  type: BookingType;
  responsible: PlayerRef;
  players: PlayerRef[];
  paymentStatus: PaymentStatus;
  price: number;
};

type Overlay = {
  hiddenIds: Set<string>;
  hiddenTemplates: Set<string>;
  added: Booking[];
  extraReleased: ReleasedFixedSlot[];
  suppressedReleases: Set<string>;
};

type PendingCreate = {
  localId: string;
  dropped: boolean;
  serverId?: string;
  fixed: boolean;
};

const EMPTY_OVERLAY: Overlay = {
  hiddenIds: new Set(),
  hiddenTemplates: new Set(),
  added: [],
  extraReleased: [],
  suppressedReleases: new Set(),
};

function releaseKey(fixedBookingId: string, date: string): string {
  return `${fixedBookingId}|${date}`;
}

function sameSlot(a: Booking, b: Pick<Booking, "courtId" | "date" | "startTime">) {
  return a.courtId === b.courtId && a.date === b.date && a.startTime === b.startTime;
}

function projectSchedule(
  bookings: Booking[],
  released: ReleasedFixedSlot[],
  overlay: Overlay,
): { bookings: Booking[]; releasedSlots: ReleasedFixedSlot[] } {
  const visible = bookings.filter((booking) => {
    if (overlay.hiddenIds.has(booking.id)) return false;
    if (
      isFixedOccurrenceId(booking.id) &&
      overlay.hiddenTemplates.has(templateIdFromOccurrence(booking.id))
    ) {
      return false;
    }
    return true;
  });

  const pending = overlay.added.filter(
    (booking) =>
      !overlay.hiddenIds.has(booking.id) &&
      !bookings.some((other) => sameSlot(other, booking)),
  );

  const releasedSlots = [
    ...released.filter((slot) => {
      if (overlay.hiddenTemplates.has(slot.fixedBookingId)) return false;
      return !overlay.suppressedReleases.has(
        releaseKey(slot.fixedBookingId, slot.date),
      );
    }),
    ...overlay.extraReleased.filter(
      (slot) =>
        !overlay.suppressedReleases.has(releaseKey(slot.fixedBookingId, slot.date)) &&
        !released.some(
          (server) =>
            server.fixedBookingId === slot.fixedBookingId &&
            server.date === slot.date,
        ),
    ),
  ];

  return { bookings: [...visible, ...pending], releasedSlots };
}

function pruneOverlay(
  prev: Overlay,
  bookings: Booking[],
  releasedSlots: ReleasedFixedSlot[],
): Overlay {
  if (
    prev.hiddenIds.size === 0 &&
    prev.hiddenTemplates.size === 0 &&
    prev.added.length === 0 &&
    prev.extraReleased.length === 0 &&
    prev.suppressedReleases.size === 0
  ) {
    return prev;
  }

  let changed = false;
  const hiddenIds = new Set<string>();
  for (const id of prev.hiddenIds) {
    if (bookings.some((booking) => booking.id === id)) hiddenIds.add(id);
    else changed = true;
  }

  const hiddenTemplates = new Set<string>();
  for (const templateId of prev.hiddenTemplates) {
    const stillThere =
      bookings.some(
        (booking) =>
          isFixedOccurrenceId(booking.id) &&
          templateIdFromOccurrence(booking.id) === templateId,
      ) || releasedSlots.some((slot) => slot.fixedBookingId === templateId);
    if (stillThere) hiddenTemplates.add(templateId);
    else changed = true;
  }

  const added = prev.added.filter((booking) => {
    const echoed = bookings.some((server) => sameSlot(server, booking));
    if (echoed) changed = true;
    return !echoed;
  });

  const extraReleased = prev.extraReleased.filter((slot) => {
    const echoed = releasedSlots.some(
      (server) =>
        server.fixedBookingId === slot.fixedBookingId && server.date === slot.date,
    );
    if (echoed) changed = true;
    return !echoed;
  });

  const suppressedReleases = new Set<string>();
  for (const key of prev.suppressedReleases) {
    const stillReleased = releasedSlots.some(
      (slot) => releaseKey(slot.fixedBookingId, slot.date) === key,
    );
    if (stillReleased) suppressedReleases.add(key);
    else changed = true;
  }

  if (!changed) return prev;
  return { hiddenIds, hiddenTemplates, added, extraReleased, suppressedReleases };
}

function bookingFromRelease(released: ReleasedFixedSlot): Booking {
  return {
    id: fixedOccurrenceId(released.fixedBookingId, released.date),
    courtId: released.courtId,
    date: released.date,
    startTime: released.startTime,
    durationMin: released.durationMin,
    type: released.type,
    status: "RESERVADO",
    paymentStatus: "UNPAID",
    price: 0,
    impacted: false,
    responsible: released.responsible,
    players: [released.responsible],
  };
}

function draftBooking(draft: CreateDraft, durationMin: number, localId: string): Booking {
  return {
    id: localId,
    courtId: draft.courtId,
    date: draft.date,
    startTime: draft.startTime,
    durationMin,
    type: draft.type,
    status: isFixedType(draft.type) ? "RESERVADO" : "PRE_RESERVA",
    paymentStatus: draft.paymentStatus,
    price: draft.price,
    impacted: false,
    responsible: draft.responsible,
    players: draft.players,
  };
}

/// La grilla pinta el alta o la baja al instante. El servidor confirma después
/// y, si falla, la celda vuelve al estado anterior.
export function useScheduleBoard({
  clubSlug,
  bookings,
  releasedSlots,
  durationMin,
  onClose,
}: {
  clubSlug: string;
  bookings: Booking[];
  releasedSlots: ReleasedFixedSlot[];
  durationMin: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [overlay, setOverlay] = useState<Overlay>(EMPTY_OVERLAY);
  const pendingRef = useRef(new Map<string, PendingCreate>());
  const busyRef = useRef(new Set<string>());
  const [seenBookings, setSeenBookings] = useState(bookings);
  const [seenReleased, setSeenReleased] = useState(releasedSlots);
  if (bookings !== seenBookings || releasedSlots !== seenReleased) {
    setSeenBookings(bookings);
    setSeenReleased(releasedSlots);
    setOverlay((prev) => pruneOverlay(prev, bookings, releasedSlots));
  }

  const view = useMemo(
    () => projectSchedule(bookings, releasedSlots, overlay),
    [bookings, releasedSlots, overlay],
  );

  function refresh() {
    router.refresh();
  }

  function cancelBooking(booking: Booking) {
    if (isPendingBookingId(booking.id)) {
      const pending = pendingRef.current.get(booking.id);
      if (!pending || pending.dropped) return;
      pending.dropped = true;
      onClose();
      setOverlay((prev) => ({
        ...prev,
        added: prev.added.filter((item) => item.id !== booking.id),
      }));
      toast.success("Turno cancelado");
      if (pending.serverId) {
        void cancelServerCreate(pending);
      }
      return;
    }

    if (busyRef.current.has(booking.id)) return;
    busyRef.current.add(booking.id);
    onClose();
    setOverlay((prev) => {
      const hiddenIds = new Set(prev.hiddenIds);
      hiddenIds.add(booking.id);
      return { ...prev, hiddenIds };
    });

    void cancelBookingAction(clubSlug, booking.id).then((result) => {
      busyRef.current.delete(booking.id);
      if (result.ok) {
        toast.success("Turno cancelado");
        refresh();
        return;
      }
      setOverlay((prev) => {
        const hiddenIds = new Set(prev.hiddenIds);
        hiddenIds.delete(booking.id);
        return { ...prev, hiddenIds };
      });
      toast.error("No se pudo cancelar", { description: result.error });
    });
  }

  function cancelFixedSeries(booking: Booking) {
    const templateId = templateIdFromOccurrence(booking.id);
    if (!templateId || busyRef.current.has(templateId)) return;
    busyRef.current.add(templateId);
    onClose();
    setOverlay((prev) => {
      const hiddenTemplates = new Set(prev.hiddenTemplates);
      hiddenTemplates.add(templateId);
      return { ...prev, hiddenTemplates };
    });

    void cancelFixedBookingAction(clubSlug, templateId).then((result) => {
      busyRef.current.delete(templateId);
      if (result.ok) {
        toast.success("Turno fijo cancelado");
        refresh();
        return;
      }
      setOverlay((prev) => {
        const hiddenTemplates = new Set(prev.hiddenTemplates);
        hiddenTemplates.delete(templateId);
        return { ...prev, hiddenTemplates };
      });
      toast.error("No se pudo cancelar", { description: result.error });
    });
  }

  function releaseFixedDay(booking: Booking) {
    const templateId = templateIdFromOccurrence(booking.id);
    const key = `${booking.id}:release`;
    if (!templateId || busyRef.current.has(key)) return;
    busyRef.current.add(key);
    onClose();
    const released: ReleasedFixedSlot = {
      fixedBookingId: templateId,
      courtId: booking.courtId,
      date: booking.date,
      startTime: booking.startTime,
      durationMin: booking.durationMin,
      type: isFixedType(booking.type) ? booking.type : "FIJO",
      responsible: booking.responsible,
    };
    const slotKey = releaseKey(templateId, booking.date);
    setOverlay((prev) => {
      const hiddenIds = new Set(prev.hiddenIds);
      hiddenIds.add(booking.id);
      const suppressedReleases = new Set(prev.suppressedReleases);
      suppressedReleases.delete(slotKey);
      return {
        ...prev,
        hiddenIds,
        suppressedReleases,
        extraReleased: [
          ...prev.extraReleased.filter(
            (slot) => releaseKey(slot.fixedBookingId, slot.date) !== slotKey,
          ),
          released,
        ],
      };
    });

    void releaseFixedOccurrenceAction(clubSlug, templateId, booking.date).then(
      (result) => {
        busyRef.current.delete(key);
        if (result.ok) {
          toast.success("Día liberado");
          refresh();
          return;
        }
        setOverlay((prev) => {
          const hiddenIds = new Set(prev.hiddenIds);
          hiddenIds.delete(booking.id);
          return {
            ...prev,
            hiddenIds,
            extraReleased: prev.extraReleased.filter(
              (slot) => releaseKey(slot.fixedBookingId, slot.date) !== slotKey,
            ),
          };
        });
        toast.error("No se pudo liberar", { description: result.error });
      },
    );
  }

  function restoreFixedDay(released: ReleasedFixedSlot) {
    const key = releaseKey(released.fixedBookingId, released.date);
    if (busyRef.current.has(key)) return;
    busyRef.current.add(key);
    onClose();
    const bookingId = fixedOccurrenceId(released.fixedBookingId, released.date);
    const synthetic = bookingFromRelease(released);
    setOverlay((prev) => {
      const hiddenIds = new Set(prev.hiddenIds);
      hiddenIds.delete(bookingId);
      const suppressedReleases = new Set(prev.suppressedReleases);
      suppressedReleases.add(key);
      const added = prev.added.some((item) => sameSlot(item, synthetic))
        ? prev.added
        : [...prev.added, synthetic];
      return {
        ...prev,
        hiddenIds,
        suppressedReleases,
        added,
        extraReleased: prev.extraReleased.filter(
          (slot) => releaseKey(slot.fixedBookingId, slot.date) !== key,
        ),
      };
    });

    void restoreFixedOccurrenceAction(
      clubSlug,
      released.fixedBookingId,
      released.date,
    ).then((result) => {
      busyRef.current.delete(key);
      if (result.ok) {
        toast.success("Turno devuelto al dueño");
        refresh();
        return;
      }
      setOverlay((prev) => {
        const suppressedReleases = new Set(prev.suppressedReleases);
        suppressedReleases.delete(key);
        const hiddenIds = new Set(prev.hiddenIds);
        hiddenIds.add(bookingId);
        return {
          ...prev,
          hiddenIds,
          suppressedReleases,
          added: prev.added.filter((item) => item.id !== synthetic.id),
          extraReleased: [
            ...prev.extraReleased.filter(
              (slot) => releaseKey(slot.fixedBookingId, slot.date) !== key,
            ),
            released,
          ],
        };
      });
      toast.error("No se pudo devolver", { description: result.error });
    });
  }

  function createBooking(draft: CreateDraft) {
    const slotKey = `${draft.courtId}|${draft.date}|${draft.startTime}`;
    if (busyRef.current.has(slotKey)) return;
    busyRef.current.add(slotKey);
    const localId = `${PENDING_PREFIX}${crypto.randomUUID()}`;
    const pending: PendingCreate = {
      localId,
      dropped: false,
      fixed: isFixedType(draft.type),
    };
    pendingRef.current.set(localId, pending);
    onClose();
    setOverlay((prev) => ({
      ...prev,
      added: [...prev.added, draftBooking(draft, durationMin, localId)],
    }));

    void createBookingAction(clubSlug, {
      courtId: draft.courtId,
      date: draft.date,
      startTime: draft.startTime,
      type: draft.type,
      responsibleId: draft.responsible.id,
      playerIds: draft.players.map((player) => player.id),
      paymentStatus: draft.paymentStatus,
      price: draft.price,
    }).then(async (result) => {
      busyRef.current.delete(slotKey);
      if (!result.ok) {
        pendingRef.current.delete(localId);
        if (!pending.dropped) {
          setOverlay((prev) => ({
            ...prev,
            added: prev.added.filter((item) => item.id !== localId),
          }));
          toast.error("No se pudo crear", { description: result.error });
        }
        return;
      }

      pending.serverId = result.id;
      if (pending.dropped) {
        await cancelServerCreate(pending);
        pendingRef.current.delete(localId);
        return;
      }

      toast.success(`Turno creado: ${BOOKING_TYPE_LABELS[draft.type]}`, {
        description:
          pending.fixed
            ? "Se repetirá cada semana en este día y horario."
            : "Queda como pre-reserva hasta su confirmación.",
      });
      refresh();
    });
  }

  async function cancelServerCreate(pending: PendingCreate) {
    if (!pending.serverId) return;
    const result =
      pending.fixed
        ? await cancelFixedBookingAction(clubSlug, pending.serverId)
        : await cancelBookingAction(clubSlug, pending.serverId);
    if (!result.ok) {
      toast.error("No se pudo cancelar", { description: result.error });
    }
    refresh();
  }

  return {
    bookings: view.bookings,
    releasedSlots: view.releasedSlots,
    cancelBooking,
    cancelFixedSeries,
    releaseFixedDay,
    restoreFixedDay,
    createBooking,
  };
}
