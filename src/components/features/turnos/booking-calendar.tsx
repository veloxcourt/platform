"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Repeat,
  Unlock,
  Users,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { addDaysISO, formatLongDate, todayISO } from "@/lib/date";
import type {
  Booking,
  DaySchedule,
  ReleasedFixedSlot,
} from "@/modules/bookings/domain/types";
import {
  calendarCellAt,
  isClassType,
  isFixedType,
} from "@/modules/bookings/domain/rules";
import type { AvailableCopyOption } from "./available-copy";
import { CopyAvailableMenu } from "./copy-available-menu";
import {
  CLASS_SLOT_STYLE,
  FIXED_CLASS_SLOT_STYLE,
  FIXED_SLOT_STYLE,
  PAYMENT_STATUS_META,
  SLOT_STATUS_STYLES,
  slotPaint,
} from "./booking-status";
import {
  AbbreviateNamesToggle,
  useAbbreviateNames,
} from "./abbreviate-names-toggle";
import { formatResponsibleName } from "./responsible-name";
import { ViewSwitch } from "./view-switch";
import { BookingDialog, type BookingSelection } from "./booking-dialog";
import { useScheduleBoard } from "./use-schedule-board";

interface Props {
  schedule: DaySchedule;
  copyOptions: AvailableCopyOption[];
  abbreviateNames: boolean;
}

export function BookingCalendar({
  schedule,
  copyOptions,
  abbreviateNames: abbreviateNamesInitial,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const clubSlug = schedule.club.slug;

  const [courtFilter, setCourtFilter] = useState<string>("all");
  const [onlyFixed, setOnlyFixed] = useState(false);
  const { abbreviateNames, setAbbreviate } = useAbbreviateNames(
    abbreviateNamesInitial,
  );
  const [selected, setSelected] = useState<BookingSelection>(null);
  const board = useScheduleBoard({
    clubSlug,
    bookings: schedule.bookings,
    releasedSlots: schedule.releasedSlots,
    durationMin: schedule.settings.slotDurationMin,
    onClose: () => setSelected(null),
  });

  const visibleCourts = useMemo(
    () =>
      courtFilter === "all"
        ? schedule.courts
        : schedule.courts.filter((c) => c.id === courtFilter),
    [schedule.courts, courtFilter],
  );

  function goToDate(dateISO: string) {
    router.push(`${pathname}?date=${dateISO}&view=dia`);
  }

  useEffect(() => {
    router.prefetch(
      `${pathname}?date=${addDaysISO(schedule.date, -1)}&view=dia`,
    );
    router.prefetch(
      `${pathname}?date=${addDaysISO(schedule.date, 1)}&view=dia`,
    );
    router.prefetch(`${pathname}?date=${todayISO()}&view=dia`);
  }, [pathname, router, schedule.date]);

  const gridTemplate = {
    gridTemplateColumns: `5rem repeat(${visibleCourts.length}, minmax(9rem, 1fr))`,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 phone-landscape:gap-0">
      {/* Barra de herramientas */}
      <div className="flex flex-wrap items-center justify-between gap-3 phone-landscape:hidden">
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

      <div className="flex flex-wrap items-center justify-between gap-3 phone-landscape:hidden">
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
        <div className="flex flex-wrap items-center gap-3">
          <CopyAvailableMenu options={copyOptions} />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={onlyFixed}
              onCheckedChange={(v) => setOnlyFixed(v === true)}
            />
            Solo fijos
          </label>
          <AbbreviateNamesToggle
            checked={abbreviateNames}
            onCheckedChange={setAbbreviate}
          />
        </div>
      </div>

      <div className="phone-landscape:hidden">
        <Legend />
      </div>

      {/* Grilla del calendario */}
      <div className="min-h-0 w-full min-w-0 flex-1 overflow-auto overscroll-contain rounded-lg border phone-landscape:rounded-none phone-landscape:border-0 phone-landscape:pl-[env(safe-area-inset-left)] phone-landscape:pr-[env(safe-area-inset-right)]">
        <div className="min-w-fit">
          <div
            className="sticky top-0 z-30 grid border-b bg-muted"
            style={gridTemplate}
          >
            <div className="sticky left-0 z-40 border-r bg-muted px-2 py-3 text-xs font-medium text-muted-foreground">
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
              <div className="sticky left-0 z-20 flex items-center justify-center border-r bg-background px-2 py-2 text-xs font-medium tabular-nums text-muted-foreground">
                {slot}
              </div>
              {visibleCourts.map((court) => {
                const cell = calendarCellAt(
                  board.bookings,
                  board.releasedSlots,
                  court.id,
                  slot,
                  { date: schedule.date, onlyFixed },
                );
                return (
                  <div key={court.id} className="border-l p-1">
                    <CalendarCell
                      booking={cell.booking ?? undefined}
                      released={cell.released}
                      abbreviateNames={abbreviateNames}
                      onClick={() =>
                        setSelected({
                          booking: cell.booking,
                          released: cell.released,
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
        onCancelBooking={board.cancelBooking}
        onCancelFixedSeries={board.cancelFixedSeries}
        onReleaseFixedDay={board.releaseFixedDay}
        onRestoreFixedDay={board.restoreFixedDay}
        onCreateBooking={board.createBooking}
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
  released,
  abbreviateNames,
  onClick,
}: {
  booking: Booking | undefined;
  released: ReleasedFixedSlot | null;
  abbreviateNames: boolean;
  onClick: () => void;
}) {
  const style = booking ? slotPaint(booking) : SLOT_STATUS_STYLES.DISPONIBLE;

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
            <span
              className="truncate font-medium"
              title={booking.responsible.name}
            >
              {formatResponsibleName(booking.responsible.name, abbreviateNames)}
            </span>
            <span className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
              {isClassType(booking.type) && <GraduationCap className="size-3" />}
              {isFixedType(booking.type) && <Repeat className="size-3" />}
            </span>
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
      ) : released ? (
        <>
          <div className="flex items-center justify-between gap-1">
            <span className="font-medium">Disponible</span>
            <Unlock className="size-3 shrink-0 text-muted-foreground" />
          </div>
          <span
            className="truncate text-muted-foreground"
            title={released.responsible.name}
          >
            Fijo ·{" "}
            {formatResponsibleName(released.responsible.name, abbreviateNames)}
          </span>
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
        <span
          className={cn("size-2.5 rounded-full", FIXED_SLOT_STYLE.dot)}
        />
        {FIXED_SLOT_STYLE.label}
      </span>
      <span className="flex items-center gap-1.5">
        <span className={cn("size-2.5 rounded-full", CLASS_SLOT_STYLE.dot)} />
        {CLASS_SLOT_STYLE.label}
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className={cn("size-2.5 rounded-full", FIXED_CLASS_SLOT_STYLE.dot)}
        />
        {FIXED_CLASS_SLOT_STYLE.label}
      </span>
      <span className="flex items-center gap-1.5">
        <Unlock className="size-3" /> Fijo liberado
      </span>
    </div>
  );
}
