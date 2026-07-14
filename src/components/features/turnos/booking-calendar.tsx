"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Users,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { addDaysISO, formatLongDate, todayISO } from "@/lib/date";
import type { Booking, DaySchedule } from "@/modules/bookings/domain/types";
import { findBookingAt } from "@/modules/bookings/domain/rules";
import { PAYMENT_STATUS_META, SLOT_STATUS_STYLES } from "./booking-status";
import { ViewSwitch } from "./view-switch";
import { BookingDialog, type BookingSelection } from "./booking-dialog";

interface Props {
  schedule: DaySchedule;
}

export function BookingCalendar({ schedule }: Props) {
  const router = useRouter();
  const clubSlug = schedule.club.slug;

  const [courtFilter, setCourtFilter] = useState<string>("all");
  const [onlyFixed, setOnlyFixed] = useState(false);
  const [selected, setSelected] = useState<BookingSelection>(null);

  const visibleCourts = useMemo(
    () =>
      courtFilter === "all"
        ? schedule.courts
        : schedule.courts.filter((c) => c.id === courtFilter),
    [schedule.courts, courtFilter],
  );

  function goToDate(dateISO: string) {
    router.push(`?date=${dateISO}&view=dia`);
  }

  const gridTemplate = {
    gridTemplateColumns: `5rem repeat(${visibleCourts.length}, minmax(9rem, 1fr))`,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de herramientas */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => goToDate(addDaysISO(schedule.date, -1))}
            aria-label="Día anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" onClick={() => goToDate(todayISO())}>
            Hoy
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => goToDate(addDaysISO(schedule.date, 1))}
            aria-label="Día siguiente"
          >
            <ChevronRight className="size-4" />
          </Button>
          <div className="ml-2 flex items-center gap-2 text-sm font-medium capitalize">
            <CalendarDays className="size-4 text-muted-foreground" />
            {formatLongDate(schedule.date)}
          </div>
        </div>

        <ViewSwitch current="dia" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            active={courtFilter === "all"}
            onClick={() => setCourtFilter("all")}
          >
            Todas
          </FilterChip>
          {schedule.courts.map((court) => (
            <FilterChip
              key={court.id}
              active={courtFilter === court.id}
              onClick={() => setCourtFilter(court.id)}
            >
              {court.name}
            </FilterChip>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={onlyFixed}
            onCheckedChange={(v) => setOnlyFixed(v === true)}
          />
          Solo fijos
        </label>
      </div>

      <Legend />

      {/* Grilla del calendario */}
      <div className="overflow-x-auto rounded-lg border">
        <div className="min-w-fit">
          <div
            className="sticky top-0 z-10 grid border-b bg-muted/50 backdrop-blur"
            style={gridTemplate}
          >
            <div className="px-2 py-3 text-xs font-medium text-muted-foreground">
              Hora
            </div>
            {visibleCourts.map((court) => (
              <div
                key={court.id}
                className="border-l px-3 py-3 text-center text-sm font-semibold"
              >
                {court.name}
              </div>
            ))}
          </div>

          {schedule.slots.map((slot) => (
            <div
              key={slot}
              className="grid border-b last:border-b-0"
              style={gridTemplate}
            >
              <div className="flex items-start justify-end px-2 py-2 text-xs font-medium tabular-nums text-muted-foreground">
                {slot}
              </div>
              {visibleCourts.map((court) => {
                let booking = findBookingAt(schedule.bookings, court.id, slot);
                if (booking && onlyFixed && booking.type !== "FIJO") {
                  booking = undefined;
                }
                return (
                  <div key={court.id} className="border-l p-1">
                    <CalendarCell
                      booking={booking}
                      onClick={() =>
                        setSelected({
                          booking: booking ?? null,
                          courtName: court.name,
                          courtId: court.id,
                          slot,
                          date: schedule.date,
                        })
                      }
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <BookingDialog
        clubSlug={clubSlug}
        players={schedule.players}
        categories={schedule.categories}
        requirePrePayment={schedule.settings.requirePrePayment}
        defaultPrice={schedule.settings.bookingPrice}
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

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        buttonVariants({ variant: active ? "default" : "outline", size: "sm" }),
      )}
    >
      {children}
    </button>
  );
}

function CalendarCell({
  booking,
  onClick,
}: {
  booking: Booking | undefined;
  onClick: () => void;
}) {
  const status = booking ? booking.status : "DISPONIBLE";
  const style = SLOT_STATUS_STYLES[status];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-16 w-full flex-col justify-between rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
        style.cell,
      )}
    >
      {booking ? (
        <>
          <div className="flex items-center justify-between gap-1">
            <span className="truncate font-medium">
              {booking.responsible.name}
            </span>
            {booking.type === "FIJO" && (
              <Repeat className="size-3 shrink-0 text-muted-foreground" />
            )}
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Users className="size-3" />
              {booking.players.length}
            </span>
            <span
              className={cn(
                "font-medium",
                PAYMENT_STATUS_META[booking.paymentStatus].className,
              )}
            >
              {PAYMENT_STATUS_META[booking.paymentStatus].label}
            </span>
          </div>
        </>
      ) : (
        <span className="m-auto text-muted-foreground/60">Disponible</span>
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
