"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, ChevronLeft, ChevronRight, Repeat } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { addDaysISO, formatShortDate, todayISO } from "@/lib/date";
import type { WeekSchedule } from "@/modules/bookings/domain/types";
import { findBookingAt } from "@/modules/bookings/domain/rules";
import { SLOT_STATUS_STYLES } from "./booking-status";
import { ViewSwitch } from "./view-switch";
import { BookingDialog, type BookingSelection } from "./booking-dialog";

interface Props {
  schedule: WeekSchedule;
}

export function WeeklySchedule({ schedule }: Props) {
  const router = useRouter();
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

  function toggleCourt(id: string) {
    setSelectedCourts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function goToWeek(dateISO: string) {
    router.push(`?date=${dateISO}&view=semana`);
  }

  const nCols = visibleDays.length * visibleCourts.length;
  const gridTemplate = {
    gridTemplateColumns: `4.5rem repeat(${nCols}, minmax(6rem, 1fr))`,
  };

  const rangeLabel = `${formatShortDate(schedule.days[0].date)} – ${formatShortDate(
    schedule.days[6].date,
  )}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de herramientas */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
      <div className="flex flex-col gap-2">
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

      <Legend />

      {visibleCourts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Seleccioná al menos una cancha para ver la agenda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <div className="min-w-fit">
            <div className="sticky top-0 z-10 bg-muted/50 backdrop-blur">
              {/* Fila 1: días (cada uno abarca sus canchas) */}
              <div className="grid" style={gridTemplate}>
                <div />
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
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
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
                <div className="flex items-center justify-end px-2 py-1 text-xs font-medium tabular-nums text-muted-foreground">
                  {slot}
                </div>
                {visibleDays.map((day) => {
                  const dayBookings = schedule.bookings.filter(
                    (b) => b.date === day.date,
                  );
                  return visibleCourts.map((court, idx) => {
                    let booking = findBookingAt(dayBookings, court.id, slot);
                    if (booking && onlyFixed && booking.type !== "FIJO") {
                      booking = undefined;
                    }
                  return (
                    <div
                      key={`${day.date}-${court.id}`}
                      className={cn("p-0.5", idx === 0 && "border-l")}
                    >
                      <WeekCell
                        booking={booking}
                        onClick={() =>
                          setSelected({
                            booking: booking ?? null,
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
  onClick,
}: {
  booking: ReturnType<typeof findBookingAt>;
  onClick: () => void;
}) {
  const status = booking ? booking.status : "DISPONIBLE";
  const style = SLOT_STATUS_STYLES[status];
  return (
    <button
      type="button"
      onClick={onClick}
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
      ) : (
        <span className="m-auto text-muted-foreground/40">—</span>
      )}
    </button>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      {(["DISPONIBLE", "PRE_RESERVA", "RESERVADO"] as const).map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <span
            className={cn("size-2.5 rounded-full", SLOT_STATUS_STYLES[s].dot)}
          />
          {SLOT_STATUS_STYLES[s].label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <Repeat className="size-3" /> Turno fijo
      </span>
    </div>
  );
}
