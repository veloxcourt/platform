import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Settings } from "lucide-react";

import { getClubAccess } from "@/lib/auth/access";
import { getBookingRepository } from "@/modules/bookings/infrastructure/repository";
import { getDaySchedule } from "@/modules/bookings/application/get-day-schedule";
import { getWeekSchedule } from "@/modules/bookings/application/get-week-schedule";
import { getAvailableCopySource } from "@/modules/bookings/application/get-available-copy-source";
import { buildAvailableCopyOptions } from "@/components/features/turnos/available-copy";
import { normalizeDateISO } from "@/lib/date";
import { BookingCalendar } from "@/components/features/turnos/booking-calendar";
import { WeeklySchedule } from "@/components/features/turnos/weekly-schedule";
import {
  TURNOS_ABBREV_NAMES_COOKIE,
  resolveAbbreviateNames,
} from "@/components/features/turnos/responsible-name";
import {
  TURNOS_VIEW_COOKIE,
  resolveTurnosView,
} from "@/components/features/turnos/turnos-view";
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
  const cookieStore = await cookies();
  const savedView = cookieStore.get(TURNOS_VIEW_COOKIE)?.value;
  const abbreviateNames = resolveAbbreviateNames(
    cookieStore.get(TURNOS_ABBREV_NAMES_COOKIE)?.value,
  );
  const turnosView = resolveTurnosView(view, savedView);

  const access = await getClubAccess(clubSlug);
  if (!access?.allowedModules.includes("turnos")) {
    if (access?.allowedModules.includes("turnos-config")) {
      redirect(`/${clubSlug}/turnos/configuracion`);
    }
    notFound();
  }
  const canConfigure = access.allowedModules.includes("turnos-config");

  const repo = getBookingRepository();
  const dateISO = normalizeDateISO(date);
  const isWeek = turnosView === "semana";

  const [schedule, weekSchedule, copySource] = await Promise.all([
    isWeek ? Promise.resolve(null) : getDaySchedule(repo, clubSlug, dateISO),
    isWeek ? getWeekSchedule(repo, clubSlug, dateISO) : Promise.resolve(null),
    getAvailableCopySource(repo, clubSlug),
  ]);
  const copyOptions = copySource
    ? buildAvailableCopyOptions(copySource, copySource.today)
    : [];

  if (isWeek ? !weekSchedule : !schedule) notFound();

  const clubName = schedule?.club.name ?? weekSchedule?.club.name ?? "";

  return (
    <div
      data-turnos-board
      className="mx-auto flex min-h-0 w-full min-w-0 max-w-7xl flex-1 flex-col gap-4 phone-landscape:max-w-none phone-landscape:gap-0"
    >
      <div className="flex shrink-0 items-start justify-between gap-4 phone-landscape:hidden">
        <div>
          <h1 className="text-xl font-semibold">Gestión de Turnos</h1>
          <p className="text-sm text-muted-foreground">
            {clubName} ·{" "}
            {isWeek ? "Ocupación semanal" : "Calendario diario de reservas"}
          </p>
        </div>
        {canConfigure ? (
          <Link
            href={`/${clubSlug}/turnos/configuracion`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Settings className="size-4" />
            Configuración
          </Link>
        ) : null}
      </div>

      {isWeek && weekSchedule ? (
        <WeeklySchedule
          schedule={weekSchedule}
          copyOptions={copyOptions}
          abbreviateNames={abbreviateNames}
        />
      ) : schedule ? (
        <BookingCalendar
          schedule={schedule}
          copyOptions={copyOptions}
          abbreviateNames={abbreviateNames}
        />
      ) : null}
    </div>
  );
}
