import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type {
  CalendarCategoryValues,
  CalendarSearchLinkValues,
  CalendarSettingsValues,
  CalendarVenueValues,
  PlannedTournamentValues,
} from "../domain/calendario-schema";
import type {
  CalendarClub,
  CalendarPlannerSettings,
  CalendarPlannerState,
  CalendarSearchLink,
  CatalogCategory,
  PlannedTournament,
} from "../domain/calendario-torneos";
import {
  DEFAULT_LIBRE_BORDER,
  DEFAULT_LIBRE_FILL,
} from "../domain/calendario-torneos";
import type { EcoItem } from "../domain/eco-torneo";
import { ecoItemsSchema } from "../domain/eco-torneo-schema";
import type {
  EcoTorneoSimulationDetail,
  EcoTorneoSimulationListItem,
} from "../domain/types";
import type {
  HerramientasClubInfo,
  HerramientasRepository,
} from "../application/herramientas-repository";

function toDbDate(dateISO: string): Date {
  return new Date(`${dateISO}T00:00:00.000Z`);
}

function fromDbDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toVenue(row: { id: string; name: string; color: string }): CalendarClub {
  return { id: row.id, name: row.name, color: row.color };
}

function toCategory(row: {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
}): CatalogCategory {
  return {
    id: row.id,
    name: row.name,
    abbreviation: row.abbreviation,
    color: row.color,
  };
}

function toSearchLink(row: {
  id: string;
  name: string;
  url: string;
  description: string;
}): CalendarSearchLink {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    description: row.description,
  };
}

/** SQL directo: el client de Prisma cacheado en webpack puede no tener el delegate. */
function listSearchLinks(clubId: string) {
  return prisma.$queryRaw<
    Array<{ id: string; name: string; url: string; description: string }>
  >`
    SELECT id, name, url, description
    FROM calendar_search_links
    WHERE "clubId" = ${clubId}
    ORDER BY "sortOrder" ASC, "createdAt" ASC
  `;
}

function toPlanned(row: {
  id: string;
  name: string;
  venueId: string;
  startDate: Date;
  endDate: Date;
  categories: { categoryId: string }[];
}): PlannedTournament {
  return {
    id: row.id,
    name: row.name,
    clubId: row.venueId,
    startDate: fromDbDate(row.startDate),
    endDate: fromDbDate(row.endDate),
    categoryIds: row.categories.map((c) => c.categoryId),
  };
}

function parseItems(raw: unknown): EcoItem[] {
  const parsed = ecoItemsSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

function toListItem(row: {
  id: string;
  name: string;
  sortOrder: number;
  updatedAt: Date;
}): EcoTorneoSimulationListItem {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt,
  };
}

function toDetail(row: {
  id: string;
  name: string;
  sortOrder: number;
  updatedAt: Date;
  items: unknown;
}): EcoTorneoSimulationDetail {
  return {
    ...toListItem(row),
    items: parseItems(row.items),
  };
}

export class PrismaHerramientasRepository implements HerramientasRepository {
  async getClubBySlug(slug: string): Promise<HerramientasClubInfo | null> {
    const club = await prisma.club.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, currency: true },
    });
    return club;
  }

  async listEcoTorneoSimulations(
    clubId: string,
  ): Promise<EcoTorneoSimulationListItem[]> {
    const rows = await prisma.ecoTorneoSimulation.findMany({
      where: { clubId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, sortOrder: true, updatedAt: true },
    });
    return rows.map(toListItem);
  }

  async getEcoTorneoSimulation(
    clubId: string,
    id: string,
  ): Promise<EcoTorneoSimulationDetail | null> {
    const row = await prisma.ecoTorneoSimulation.findFirst({
      where: { id, clubId },
    });
    return row ? toDetail(row) : null;
  }

  async createEcoTorneoSimulation(
    clubId: string,
    input: { name: string; items: EcoItem[] },
  ): Promise<EcoTorneoSimulationDetail> {
    const agg = await prisma.ecoTorneoSimulation.aggregate({
      where: { clubId },
      _max: { sortOrder: true },
    });
    const sortOrder = (agg._max.sortOrder ?? -1) + 1;
    const row = await prisma.ecoTorneoSimulation.create({
      data: {
        clubId,
        name: input.name,
        items: input.items as unknown as Prisma.InputJsonValue,
        sortOrder,
      },
    });
    return toDetail(row);
  }

  async updateEcoTorneoSimulationName(
    clubId: string,
    id: string,
    name: string,
  ): Promise<EcoTorneoSimulationDetail | null> {
    const existing = await prisma.ecoTorneoSimulation.findFirst({
      where: { id, clubId },
      select: { id: true },
    });
    if (!existing) return null;
    const row = await prisma.ecoTorneoSimulation.update({
      where: { id },
      data: { name },
    });
    return toDetail(row);
  }

  async updateEcoTorneoSimulationItems(
    clubId: string,
    id: string,
    items: EcoItem[],
  ): Promise<EcoTorneoSimulationDetail | null> {
    const existing = await prisma.ecoTorneoSimulation.findFirst({
      where: { id, clubId },
      select: { id: true },
    });
    if (!existing) return null;
    const row = await prisma.ecoTorneoSimulation.update({
      where: { id },
      data: { items: items as unknown as Prisma.InputJsonValue },
    });
    return toDetail(row);
  }

  async deleteEcoTorneoSimulation(
    clubId: string,
    id: string,
  ): Promise<boolean> {
    const existing = await prisma.ecoTorneoSimulation.findFirst({
      where: { id, clubId },
      select: { id: true },
    });
    if (!existing) return false;
    await prisma.ecoTorneoSimulation.delete({ where: { id } });
    return true;
  }

  async getCalendarPlannerState(
    clubId: string,
  ): Promise<CalendarPlannerState> {
    const [venues, categories, tournaments, settings, searchLinks] =
      await Promise.all([
        prisma.calendarPlannerVenue.findMany({
          where: { clubId },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        }),
        prisma.calendarPlannerCategory.findMany({
          where: { clubId },
          orderBy: { name: "asc" },
        }),
        prisma.calendarPlannedTournament.findMany({
          where: { clubId },
          orderBy: { startDate: "asc" },
          include: { categories: { select: { categoryId: true } } },
        }),
        prisma.calendarPlannerSettings.findUnique({
          where: { clubId },
        }),
        listSearchLinks(clubId),
      ]);

    return {
      clubs: venues.map(toVenue),
      categories: categories.map(toCategory),
      tournaments: tournaments.map(toPlanned),
      settings: {
        libreFill: settings?.libreFill ?? DEFAULT_LIBRE_FILL,
        libreBorder: settings?.libreBorder ?? DEFAULT_LIBRE_BORDER,
      },
      searchLinks: searchLinks.map(toSearchLink),
    };
  }

  async createCalendarVenue(
    clubId: string,
    input: CalendarVenueValues,
  ): Promise<CalendarClub> {
    const agg = await prisma.calendarPlannerVenue.aggregate({
      where: { clubId },
      _max: { sortOrder: true },
    });
    const row = await prisma.calendarPlannerVenue.create({
      data: {
        clubId,
        name: input.name,
        color: input.color,
        sortOrder: (agg._max.sortOrder ?? -1) + 1,
      },
    });
    return toVenue(row);
  }

  async updateCalendarVenue(
    clubId: string,
    id: string,
    input: CalendarVenueValues,
  ): Promise<CalendarClub | null> {
    const existing = await prisma.calendarPlannerVenue.findFirst({
      where: { id, clubId },
      select: { id: true },
    });
    if (!existing) return null;
    const row = await prisma.calendarPlannerVenue.update({
      where: { id },
      data: { name: input.name, color: input.color },
    });
    return toVenue(row);
  }

  async reorderCalendarVenues(
    clubId: string,
    ids: string[],
  ): Promise<boolean> {
    const venues = await prisma.calendarPlannerVenue.findMany({
      where: { clubId },
      select: { id: true },
    });
    if (venues.length !== ids.length) return false;
    const owned = new Set(venues.map((v) => v.id));
    if (ids.some((id) => !owned.has(id))) return false;

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.calendarPlannerVenue.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return true;
  }

  async deleteCalendarVenue(clubId: string, id: string): Promise<boolean> {
    const existing = await prisma.calendarPlannerVenue.findFirst({
      where: { id, clubId },
      select: { id: true },
    });
    if (!existing) return false;
    await prisma.calendarPlannerVenue.delete({ where: { id } });
    return true;
  }

  async createCalendarCategory(
    clubId: string,
    input: CalendarCategoryValues,
  ): Promise<CatalogCategory | { error: string }> {
    const clash = await prisma.calendarPlannerCategory.findFirst({
      where: {
        clubId,
        abbreviation: { equals: input.abbreviation, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (clash) return { error: "Ya existe una categoría con esa abreviación" };

    const agg = await prisma.calendarPlannerCategory.aggregate({
      where: { clubId },
      _max: { sortOrder: true },
    });
    const row = await prisma.calendarPlannerCategory.create({
      data: {
        clubId,
        name: input.name,
        abbreviation: input.abbreviation,
        color: input.color,
        sortOrder: (agg._max.sortOrder ?? -1) + 1,
      },
    });
    return toCategory(row);
  }

  async updateCalendarCategory(
    clubId: string,
    id: string,
    input: CalendarCategoryValues,
  ): Promise<CatalogCategory | { error: string } | null> {
    const existing = await prisma.calendarPlannerCategory.findFirst({
      where: { id, clubId },
      select: { id: true },
    });
    if (!existing) return null;

    const clash = await prisma.calendarPlannerCategory.findFirst({
      where: {
        clubId,
        id: { not: id },
        abbreviation: { equals: input.abbreviation, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (clash) return { error: "Ya existe una categoría con esa abreviación" };

    const row = await prisma.calendarPlannerCategory.update({
      where: { id },
      data: {
        name: input.name,
        abbreviation: input.abbreviation,
        color: input.color,
      },
    });
    return toCategory(row);
  }

  async deleteCalendarCategory(clubId: string, id: string): Promise<boolean> {
    const existing = await prisma.calendarPlannerCategory.findFirst({
      where: { id, clubId },
      select: { id: true },
    });
    if (!existing) return false;
    await prisma.calendarPlannerCategory.delete({ where: { id } });
    return true;
  }

  async createPlannedTournament(
    clubId: string,
    input: PlannedTournamentValues,
  ): Promise<PlannedTournament | { error: string }> {
    const venue = await prisma.calendarPlannerVenue.findFirst({
      where: { id: input.clubId, clubId },
      select: { id: true },
    });
    if (!venue) return { error: "Club no encontrado" };

    const categories = await prisma.calendarPlannerCategory.findMany({
      where: { clubId, id: { in: input.categoryIds } },
      select: { id: true },
    });
    if (categories.length !== input.categoryIds.length) {
      return { error: "Hay categorías inválidas" };
    }

    const row = await prisma.calendarPlannedTournament.create({
      data: {
        clubId,
        venueId: input.clubId,
        name: input.name,
        startDate: toDbDate(input.startDate),
        endDate: toDbDate(input.endDate),
        categories: {
          create: input.categoryIds.map((categoryId) => ({ categoryId })),
        },
      },
      include: { categories: { select: { categoryId: true } } },
    });
    return toPlanned(row);
  }

  async updatePlannedTournament(
    clubId: string,
    id: string,
    input: PlannedTournamentValues,
  ): Promise<PlannedTournament | { error: string } | null> {
    const existing = await prisma.calendarPlannedTournament.findFirst({
      where: { id, clubId },
      select: { id: true },
    });
    if (!existing) return null;

    const venue = await prisma.calendarPlannerVenue.findFirst({
      where: { id: input.clubId, clubId },
      select: { id: true },
    });
    if (!venue) return { error: "Club no encontrado" };

    const categories = await prisma.calendarPlannerCategory.findMany({
      where: { clubId, id: { in: input.categoryIds } },
      select: { id: true },
    });
    if (categories.length !== input.categoryIds.length) {
      return { error: "Hay categorías inválidas" };
    }

    await prisma.$transaction([
      prisma.calendarPlannedTournamentCategory.deleteMany({
        where: { tournamentId: id },
      }),
      prisma.calendarPlannedTournament.update({
        where: { id },
        data: {
          venueId: input.clubId,
          name: input.name,
          startDate: toDbDate(input.startDate),
          endDate: toDbDate(input.endDate),
          categories: {
            create: input.categoryIds.map((categoryId) => ({ categoryId })),
          },
        },
      }),
    ]);

    const row = await prisma.calendarPlannedTournament.findFirst({
      where: { id, clubId },
      include: { categories: { select: { categoryId: true } } },
    });
    return row ? toPlanned(row) : null;
  }

  async deletePlannedTournament(
    clubId: string,
    id: string,
  ): Promise<boolean> {
    const existing = await prisma.calendarPlannedTournament.findFirst({
      where: { id, clubId },
      select: { id: true },
    });
    if (!existing) return false;
    await prisma.calendarPlannedTournament.delete({ where: { id } });
    return true;
  }

  async createCalendarSearchLink(
    clubId: string,
    input: CalendarSearchLinkValues,
  ): Promise<CalendarSearchLink> {
    const maxRows = await prisma.$queryRaw<Array<{ max: number | null }>>`
      SELECT MAX("sortOrder")::int AS max
      FROM calendar_search_links
      WHERE "clubId" = ${clubId}
    `;
    const sortOrder = (maxRows[0]?.max ?? -1) + 1;
    const id = crypto.randomUUID();
    const rows = await prisma.$queryRaw<
      Array<{ id: string; name: string; url: string; description: string }>
    >`
      INSERT INTO calendar_search_links
        (id, "clubId", name, url, description, "sortOrder", "createdAt", "updatedAt")
      VALUES
        (${id}, ${clubId}, ${input.name}, ${input.url}, ${input.description}, ${sortOrder}, NOW(), NOW())
      RETURNING id, name, url, description
    `;
    return toSearchLink(rows[0]!);
  }

  async updateCalendarSearchLink(
    clubId: string,
    id: string,
    input: CalendarSearchLinkValues,
  ): Promise<CalendarSearchLink | null> {
    const rows = await prisma.$queryRaw<
      Array<{ id: string; name: string; url: string; description: string }>
    >`
      UPDATE calendar_search_links
      SET
        name = ${input.name},
        url = ${input.url},
        description = ${input.description},
        "updatedAt" = NOW()
      WHERE id = ${id} AND "clubId" = ${clubId}
      RETURNING id, name, url, description
    `;
    return rows[0] ? toSearchLink(rows[0]) : null;
  }

  async deleteCalendarSearchLink(
    clubId: string,
    id: string,
  ): Promise<boolean> {
    const deleted = await prisma.$executeRaw`
      DELETE FROM calendar_search_links
      WHERE id = ${id} AND "clubId" = ${clubId}
    `;
    return deleted > 0;
  }

  async updateCalendarPlannerSettings(
    clubId: string,
    input: CalendarSettingsValues,
  ): Promise<CalendarPlannerSettings> {
    const row = await prisma.calendarPlannerSettings.upsert({
      where: { clubId },
      create: {
        clubId,
        libreFill: input.libreFill,
        libreBorder: input.libreBorder,
      },
      update: {
        libreFill: input.libreFill,
        libreBorder: input.libreBorder,
      },
    });
    return { libreFill: row.libreFill, libreBorder: row.libreBorder };
  }
}
