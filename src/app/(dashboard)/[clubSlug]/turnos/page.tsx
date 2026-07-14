import Link from "next/link";
import { notFound } from "next/navigation";
import { Settings } from "lucide-react";

import { getBookingRepository } from "@/modules/bookings/infrastructure/repository";
import { getDaySchedule } from "@/modules/bookings/application/get-day-schedule";
import { getWeekSchedule } from "@/modules/bookings/application/get-week-schedule";
import { normalizeDateISO } from "@/lib/date";
import { BookingCalendar } from "@/components/features/turnos/booking-calendar";
import { WeeklySchedule } from "@/components/features/turnos/weekly-schedule";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Turnos · VeloxCourt",
};

export default async function TurnosPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubSlug: string }>;
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const { clubSlug } = await params;
  const { date, view } = await searchParams;

  const repo = getBookingRepository();
  const dateISO = normalizeDateISO(date);
  const isWeek = view === "semana";

  const [schedule, weekSchedule] = await Promise.all([
    isWeek ? Promise.resolve(null) : getDaySchedule(repo, clubSlug, dateISO),
    isWeek ? getWeekSchedule(repo, clubSlug, dateISO) : Promise.resolve(null),
  ]);

  if (isWeek ? !weekSchedule : !schedule) notFound();

  const clubName = schedule?.club.name ?? weekSchedule?.club.name ?? "";

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Gestión de Turnos</h1>
          <p className="text-sm text-muted-foreground">
            {clubName} ·{" "}
            {isWeek ? "Ocupación semanal" : "Calendario diario de reservas"}
          </p>
        </div>
        <Link
          href={`/${clubSlug}/turnos/configuracion`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Settings className="size-4" />
          Configuración
        </Link>
      </div>

      {isWeek && weekSchedule ? (
        <WeeklySchedule schedule={weekSchedule} />
      ) : schedule ? (
        <BookingCalendar schedule={schedule} />
      ) : null}
    </div>
  );
}
