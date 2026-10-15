"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Unlock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { addDaysISO, formatShortDate, todayISO } from "@/lib/date";
import type {
  Booking,
  ReleasedFixedSlot,
  WeekSchedule,
} from "@/modules/bookings/domain/types";
import { calendarCellAt } from "@/modules/bookings/domain/rules";
import {
  FIXED_SLOT_STYLE,
  SLOT_STATUS_STYLES,
  slotPaint,
} from "./booking-status";
import type { AvailableCopyOption } from "./available-copy";
import { CopyAvailableMenu } from "./copy-available-menu";
import { ViewSwitch } from "./view-switch";
import { BookingDialog, type BookingSelection } from "./booking-dialog";

interface Props {
  schedule: WeekSchedule;
  copyOptions: AvailableCopyOption[];
}

export function WeeklySchedule({ schedule, copyOptions }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [includeWeekend, setIncludeWeekend] = useState(false);
  const [onlyFixed, setOnlyFixed] = useState(false);
  const [selectedCourts, setSelectedCourts] = useState<Set<string>>(
    () => new Set(schedule.courts.map((c) => c.id)),
  );
  const [selected, setSelected] = useState<BookingSelection>(null);

  const visibleDays = useMemo(
    () =>
      includeWeekend
        ? schedule.days
        : schedule.days.filter((d) => !d.isWeekend),
    [schedule.days, includeWeekend],
  );

  const visibleCourts = useMemo(
    () => schedule.courts.filter((c) => selectedCourts.has(c.id)),
    [schedule.courts, selectedCourts],
  );

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const booking of schedule.bookings) {
      const list = map.get(booking.date);
      if (list) list.push(booking);
      else map.set(booking.date, [booking]);
    }
    return map;
  }, [schedule.bookings]);

  function toggleCourt(id: string) {
    setSelectedCourts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function goToWeek(dateISO: string) {
    router.push(`${pathname}?date=${dateISO}&view=semana`);
  }

  useEffect(() => {
    const prev = addDaysISO(schedule.weekStart, -7);
    const next = addDaysISO(schedule.weekStart, 7);
    router.prefetch(`${pathname}?date=${prev}&view=semana`);
    router.prefetch(`${pathname}?date=${next}&view=semana`);
    router.prefetch(`${pathname}?date=${todayISO()}&view=semana`);
  }, [pathname, router, schedule.weekStart]);

  const nCols = visibleDays.length * visibleCourts.length;
  const timeCol = "4.5rem";
  const courtCol = "6.5rem";
  const gridTemplate = {
    gridTemplateColumns: `${timeCol} repeat(${nCols}, minmax(${courtCol}, 1fr))`,
  };
  const tableMinWidth = `calc(${timeCol} + ${nCols} * ${courtCol})`;

  const rangeLabel = `${formatShortDate(schedule.days[0].date)} – ${formatShortDate(
    schedule.days[6].date,
  )}`;

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4 phone-landscape:gap-0">
      {/* Barra de herramientas */}
      <div className="flex flex-wrap items-center justify-between gap-3 phone-landscape:hidden">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => goToWeek(addDaysISO(schedule.weekStart, -7))}
            aria-label="Semana anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" onClick={() => goToWeek(todayISO())}>
            Esta semana
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => goToWeek(addDaysISO(schedule.weekStart, 7))}
            aria-label="Semana siguiente"
          >
            <ChevronRight className="size-4" />
          </Button>
          <div className="ml-2 flex items-center gap-2 text-sm font-medium capitalize">
            <CalendarRange className="size-4 text-muted-foreground" />
            {rangeLabel}
          </div>
        </div>

        <ViewSwitch current="semana" />
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-2 phone-landscape:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={includeWeekend}
                onCheckedChange={(v) => setIncludeWeekend(v === true)}
              />
              Incluir sábados y domingos
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={onlyFixed}
                onCheckedChange={(v) => setOnlyFixed(v === true)}
              />
              Solo fijos
            </label>
          </div>
          <CopyAvailableMenu options={copyOptions} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Canchas:</span>
          {schedule.courts.map((court) => (
            <label key={court.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selectedCourts.has(court.id)}
                onCheckedChange={() => toggleCourt(court.id)}
              />
              {court.name}
            </label>
          ))}
        </div>
      </div>

      <div className="phone-landscape:hidden">
        <Legend />
      </div>

      {visibleCourts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Seleccioná al menos una cancha para ver la agenda.
        </div>
      ) : (
        <div className="min-h-0 w-full min-w-0 flex-1 overflow-auto overscroll-contain rounded-lg border phone-landscape:rounded-none phone-landscape:border-0 phone-landscape:pl-[env(safe-area-inset-left)] phone-landscape:pr-[env(safe-area-inset-right)]">
          <div className="w-full" style={{ minWidth: tableMinWidth }}>
            <div className="sticky top-0 z-30 bg-muted shadow-[0_1px_0_0_var(--border)]">
              {/* Fila 1: días (cada uno abarca sus canchas) */}
              <div className="grid" style={gridTemplate}>
                <div className="sticky left-0 z-40 bg-muted" />
                {visibleDays.map((day) => (
                  <div
                    key={day.date}
                    style={{ gridColumn: `span ${visibleCourts.length}` }}
                    className="border-l px-2 py-1.5 text-center text-xs font-semibold capitalize"
                  >
                    {day.label}
                  </div>
                ))}
              </div>
              {/* Fila 2: nombres de cancha */}
              <div className="grid border-b" style={gridTemplate}>
                <div className="sticky left-0 z-40 border-r bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                  Hora
                </div>
                {visibleDays.map((day) =>
                  visibleCourts.map((court, idx) => (
                    <div
                      key={`${day.date}-${court.id}`}
                      className={cn(
                        "px-1 py-1 text-center text-[11px] text-muted-foreground",
                        idx === 0 && "border-l",
                      )}
                    >
                      {court.name}
                    </div>
                  )),
                )}
              </div>
            </div>

            {/* Filas por horario */}
            {schedule.slots.map((slot) => (
              <div
                key={slot}
                className="grid border-b last:border-b-0"
                style={gridTemplate}
              >
                <div className="sticky left-0 z-20 flex items-center justify-center border-r bg-background px-2 py-1 text-xs font-medium tabular-nums text-muted-foreground">
                  {slot}
                </div>
                {visibleDays.map((day) => {
                  const dayBookings = bookingsByDate.get(day.date) ?? [];
                  return visibleCourts.map((court, idx) => {
                    const cell = calendarCellAt(
                      dayBookings,
                      schedule.releasedSlots,
                      court.id,
                      slot,
                      { date: day.date, onlyFixed },
                    );
                  return (
                    <div
                      key={`${day.date}-${court.id}`}
                      className={cn("p-0.5", idx === 0 && "border-l")}
                    >
                      <WeekCell
                        booking={cell.booking}
                        released={cell.released}
                        onClick={() =>
                          setSelected({
                            booking: cell.booking,
                            released: cell.released,
                            courtName: court.name,
                            courtId: court.id,
                            slot,
                            date: day.date,
                          })
                        }
                      />
                    </div>
                  );
                  });
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <BookingDialog
        clubSlug={schedule.club.slug}
        players={schedule.players}
        categories={schedule.categories}
        requirePrePayment={schedule.requirePrePayment}
        defaultPrice={schedule.bookingPrice}
        currency={schedule.club.currency}
        selected={selected}
        onClose={() => setSelected(null)}
        onDone={() => {
          setSelected(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function WeekCell({
  booking,
  released,
  onClick,
}: {
  booking: ReturnType<typeof calendarCellAt>["booking"];
  released: ReleasedFixedSlot | null;
  onClick: () => void;
}) {
  const style = booking ? slotPaint(booking) : SLOT_STATUS_STYLES.DISPONIBLE;
  return (
    <button
      type="button"
      onClick={onClick}
      title={
        released
          ? `Turno fijo de ${released.responsible.name}, liberado este día`
          : undefined
      }
      className={cn(
        "flex h-9 w-full items-center gap-1 rounded border px-1 text-left text-[11px] transition-colors",
        style.cell,
      )}
    >
      {booking ? (
        <>
          <span className="truncate">{booking.responsible.name}</span>
          {booking.type === "FIJO" && (
            <Repeat className="ml-auto size-3 shrink-0 text-muted-foreground" />
          )}
        </>
      ) : released ? (
        <>
          <span className="truncate text-muted-foreground">Libre</span>
          <Unlock className="ml-auto size-3 shrink-0 text-muted-foreground" />
        </>
      ) : (
        <span className="m-auto text-muted-foreground/40">—</span>
      )}
    </button>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            "size-2.5 rounded-full",
            SLOT_STATUS_STYLES.DISPONIBLE.dot,
          )}
        />
        Disponible
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            "size-2.5 rounded-full",
            SLOT_STATUS_STYLES.PRE_RESERVA.dot,
          )}
        />
        Pre-reserva
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            "size-2.5 rounded-full",
            SLOT_STATUS_STYLES.RESERVADO.dot,
          )}
        />
        Reserva
      </span>
      <span className="flex items-center gap-1.5">
        <span className={cn("size-2.5 rounded-full", FIXED_SLOT_STYLE.dot)} />
        Turno fijo
      </span>
      <span className="flex items-center gap-1.5">
        <Unlock className="size-3" /> Fijo liberado
      </span>
    </div>
  );
}
