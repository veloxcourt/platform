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
import type { EcoGroup, EcoItem } from "../domain/eco-torneo";
import { defaultEcoItems, nextSimulationName } from "../domain/eco-torneo";
import type {
  EcoTorneoSimulationDetail,
  EcoTorneoSimulationListItem,
} from "../domain/types";
import type {
  HerramientasClubInfo,
  HerramientasRepository,
} from "../application/herramientas-repository";

type SimRecord = EcoTorneoSimulationDetail;

interface ClubRecord {
  club: HerramientasClubInfo;
  simulations: SimRecord[];
  venues: CalendarClub[];
  categories: CatalogCategory[];
  tournaments: PlannedTournament[];
  settings: CalendarPlannerSettings;
  searchLinks: CalendarSearchLink[];
}

const store = new Map<string, ClubRecord>();

function ensureClub(slug: string): ClubRecord {
  let record = store.get(slug);
  if (!record) {
    const clubId = `club-${slug}`;
    const firstName = nextSimulationName([]);
    record = {
      club: {
        id: clubId,
        name: slug === "club-demo" ? "Club Demo Pádel" : slug,
        slug,
        currency: "ARS",
      },
      simulations:
        slug === "club-demo"
          ? [
              {
                id: "eco-demo-1",
                name: firstName,
                sortOrder: 0,
                updatedAt: new Date(),
                items: defaultEcoItems(),
                groups: [],
              },
            ]
          : [],
      venues: [],
      categories: [],
      tournaments: [],
      settings: {
        libreFill: DEFAULT_LIBRE_FILL,
        libreBorder: DEFAULT_LIBRE_BORDER,
      },
      searchLinks: [],
    };
    store.set(slug, record);
  }
  return record;
}

function byClubId(clubId: string): ClubRecord | null {
  for (const record of store.values()) {
    if (record.club.id === clubId) return record;
  }
  return null;
}

export class MockHerramientasRepository implements HerramientasRepository {
  async getClubBySlug(slug: string): Promise<HerramientasClubInfo | null> {
    return ensureClub(slug).club;
  }

  async listEcoTorneoSimulations(
    clubId: string,
  ): Promise<EcoTorneoSimulationListItem[]> {
    const record = byClubId(clubId);
    if (!record) return [];
    return record.simulations
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ id, name, sortOrder, updatedAt }) => ({
        id,
        name,
        sortOrder,
        updatedAt,
      }));
  }

  async getEcoTorneoSimulation(
    clubId: string,
    id: string,
  ): Promise<EcoTorneoSimulationDetail | null> {
    const record = byClubId(clubId);
    if (!record) return null;
    const sim = record.simulations.find((s) => s.id === id);
    return sim
      ? {
          ...sim,
          items: sim.items.map((i) => ({ ...i })),
          groups: sim.groups.map((g) => ({ ...g, itemIds: [...g.itemIds] })),
        }
      : null;
  }

  async createEcoTorneoSimulation(
    clubId: string,
    input: { name: string; items: EcoItem[]; groups?: EcoGroup[] },
  ): Promise<EcoTorneoSimulationDetail> {
    const record = byClubId(clubId);
    if (!record) throw new Error("Club no encontrado");
    const sortOrder =
      record.simulations.reduce((max, s) => Math.max(max, s.sortOrder), -1) +
      1;
    const created: SimRecord = {
      id: crypto.randomUUID(),
      name: input.name,
      sortOrder,
      updatedAt: new Date(),
      items: input.items.map((i) => ({ ...i })),
      groups: (input.groups ?? []).map((g) => ({
        ...g,
        itemIds: [...g.itemIds],
      })),
    };
    record.simulations.push(created);
    return {
      ...created,
      items: created.items.map((i) => ({ ...i })),
      groups: created.groups.map((g) => ({ ...g, itemIds: [...g.itemIds] })),
    };
  }

  async updateEcoTorneoSimulationName(
    clubId: string,
    id: string,
    name: string,
  ): Promise<EcoTorneoSimulationDetail | null> {
    const record = byClubId(clubId);
    if (!record) return null;
    const sim = record.simulations.find((s) => s.id === id);
    if (!sim) return null;
    sim.name = name;
    sim.updatedAt = new Date();
    return {
      ...sim,
      items: sim.items.map((i) => ({ ...i })),
      groups: sim.groups.map((g) => ({ ...g, itemIds: [...g.itemIds] })),
    };
  }

  async updateEcoTorneoSimulationItems(
    clubId: string,
    id: string,
    items: EcoItem[],
    groups: EcoGroup[] = [],
  ): Promise<EcoTorneoSimulationDetail | null> {
    const record = byClubId(clubId);
    if (!record) return null;
    const sim = record.simulations.find((s) => s.id === id);
    if (!sim) return null;
    sim.items = items.map((i) => ({ ...i }));
    sim.groups = groups.map((g) => ({ ...g, itemIds: [...g.itemIds] }));
    sim.updatedAt = new Date();
    return {
      ...sim,
      items: sim.items.map((i) => ({ ...i })),
      groups: sim.groups.map((g) => ({ ...g, itemIds: [...g.itemIds] })),
    };
  }

  async deleteEcoTorneoSimulation(
    clubId: string,
    id: string,
  ): Promise<boolean> {
    const record = byClubId(clubId);
    if (!record) return false;
    const before = record.simulations.length;
    record.simulations = record.simulations.filter((s) => s.id !== id);
    return record.simulations.length < before;
  }

  async getCalendarPlannerState(
    clubId: string,
  ): Promise<CalendarPlannerState> {
    const record = byClubId(clubId);
    if (!record) {
      return {
        clubs: [],
        categories: [],
        tournaments: [],
        settings: {
          libreFill: DEFAULT_LIBRE_FILL,
          libreBorder: DEFAULT_LIBRE_BORDER,
        },
        searchLinks: [],
      };
    }
    return {
      clubs: record.venues.map((v) => ({ ...v })),
      categories: record.categories.map((c) => ({ ...c })),
      tournaments: record.tournaments.map((t) => ({
        ...t,
        categoryIds: [...t.categoryIds],
      })),
      settings: { ...record.settings },
      searchLinks: record.searchLinks.map((l) => ({ ...l })),
    };
  }

  async createCalendarVenue(
    clubId: string,
    input: CalendarVenueValues,
  ): Promise<CalendarClub> {
    const record = byClubId(clubId);
    if (!record) throw new Error("Club no encontrado");
    const created: CalendarClub = {
      id: crypto.randomUUID(),
      name: input.name,
      color: input.color,
    };
    record.venues.push(created);
    return { ...created };
  }

  async updateCalendarVenue(
    clubId: string,
    id: string,
    input: CalendarVenueValues,
  ): Promise<CalendarClub | null> {
    const record = byClubId(clubId);
    if (!record) return null;
    const venue = record.venues.find((v) => v.id === id);
    if (!venue) return null;
    venue.name = input.name;
    venue.color = input.color;
    return { ...venue };
  }

  async reorderCalendarVenues(
    clubId: string,
    ids: string[],
  ): Promise<boolean> {
    const record = byClubId(clubId);
    if (!record) return false;
    if (record.venues.length !== ids.length) return false;
    const byId = new Map(record.venues.map((v) => [v.id, v]));
    if (ids.some((id) => !byId.has(id))) return false;
    record.venues = ids.map((id) => byId.get(id)!);
    return true;
  }

  async deleteCalendarVenue(clubId: string, id: string): Promise<boolean> {
    const record = byClubId(clubId);
    if (!record) return false;
    const before = record.venues.length;
    record.venues = record.venues.filter((v) => v.id !== id);
    record.tournaments = record.tournaments.filter((t) => t.clubId !== id);
    return record.venues.length < before;
  }

  async createCalendarCategory(
    clubId: string,
    input: CalendarCategoryValues,
  ): Promise<CatalogCategory | { error: string }> {
    const record = byClubId(clubId);
    if (!record) throw new Error("Club no encontrado");
    if (
      record.categories.some(
        (c) => c.abbreviation.toLowerCase() === input.abbreviation.toLowerCase(),
      )
    ) {
      return { error: "Ya existe una categoría con esa abreviación" };
    }
    const created: CatalogCategory = {
      id: crypto.randomUUID(),
      name: input.name,
      abbreviation: input.abbreviation,
      color: input.color,
    };
    record.categories.push(created);
    return { ...created };
  }

  async updateCalendarCategory(
    clubId: string,
    id: string,
    input: CalendarCategoryValues,
  ): Promise<CatalogCategory | { error: string } | null> {
    const record = byClubId(clubId);
    if (!record) return null;
    const category = record.categories.find((c) => c.id === id);
    if (!category) return null;
    if (
      record.categories.some(
        (c) =>
          c.id !== id &&
          c.abbreviation.toLowerCase() === input.abbreviation.toLowerCase(),
      )
    ) {
      return { error: "Ya existe una categoría con esa abreviación" };
    }
    category.name = input.name;
    category.abbreviation = input.abbreviation;
    category.color = input.color;
    return { ...category };
  }

  async deleteCalendarCategory(clubId: string, id: string): Promise<boolean> {
    const record = byClubId(clubId);
    if (!record) return false;
    const before = record.categories.length;
    record.categories = record.categories.filter((c) => c.id !== id);
    for (const tournament of record.tournaments) {
      tournament.categoryIds = tournament.categoryIds.filter((c) => c !== id);
    }
    return record.categories.length < before;
  }

  async createPlannedTournament(
    clubId: string,
    input: PlannedTournamentValues,
  ): Promise<PlannedTournament | { error: string }> {
    const record = byClubId(clubId);
    if (!record) throw new Error("Club no encontrado");
    if (!record.venues.some((v) => v.id === input.clubId)) {
      return { error: "Club no encontrado" };
    }
    if (
      input.categoryIds.some(
        (id) => !record.categories.some((c) => c.id === id),
      )
    ) {
      return { error: "Hay categorías inválidas" };
    }
    const created: PlannedTournament = {
      id: crypto.randomUUID(),
      name: input.name,
      clubId: input.clubId,
      startDate: input.startDate,
      endDate: input.endDate,
      categoryIds: [...input.categoryIds],
    };
    record.tournaments.push(created);
    return { ...created, categoryIds: [...created.categoryIds] };
  }

  async updatePlannedTournament(
    clubId: string,
    id: string,
    input: PlannedTournamentValues,
  ): Promise<PlannedTournament | { error: string } | null> {
    const record = byClubId(clubId);
    if (!record) return null;
    const tournament = record.tournaments.find((t) => t.id === id);
    if (!tournament) return null;
    if (!record.venues.some((v) => v.id === input.clubId)) {
      return { error: "Club no encontrado" };
    }
    if (
      input.categoryIds.some(
        (catId) => !record.categories.some((c) => c.id === catId),
      )
    ) {
      return { error: "Hay categorías inválidas" };
    }
    tournament.name = input.name;
    tournament.clubId = input.clubId;
    tournament.startDate = input.startDate;
    tournament.endDate = input.endDate;
    tournament.categoryIds = [...input.categoryIds];
    return { ...tournament, categoryIds: [...tournament.categoryIds] };
  }

  async deletePlannedTournament(
    clubId: string,
    id: string,
  ): Promise<boolean> {
    const record = byClubId(clubId);
    if (!record) return false;
    const before = record.tournaments.length;
    record.tournaments = record.tournaments.filter((t) => t.id !== id);
    return record.tournaments.length < before;
  }

  async createCalendarSearchLink(
    clubId: string,
    input: CalendarSearchLinkValues,
  ): Promise<CalendarSearchLink> {
    const record = byClubId(clubId);
    if (!record) throw new Error("Club no encontrado");
    const created: CalendarSearchLink = {
      id: crypto.randomUUID(),
      name: input.name,
      url: input.url,
      description: input.description,
    };
    record.searchLinks.push(created);
    return { ...created };
  }

  async updateCalendarSearchLink(
    clubId: string,
    id: string,
    input: CalendarSearchLinkValues,
  ): Promise<CalendarSearchLink | null> {
    const record = byClubId(clubId);
    if (!record) return null;
    const link = record.searchLinks.find((l) => l.id === id);
    if (!link) return null;
    link.name = input.name;
    link.url = input.url;
    link.description = input.description;
    return { ...link };
  }

  async deleteCalendarSearchLink(
    clubId: string,
    id: string,
  ): Promise<boolean> {
    const record = byClubId(clubId);
    if (!record) return false;
    const before = record.searchLinks.length;
    record.searchLinks = record.searchLinks.filter((l) => l.id !== id);
    return record.searchLinks.length < before;
  }

  async updateCalendarPlannerSettings(
    clubId: string,
    input: CalendarSettingsValues,
  ): Promise<CalendarPlannerSettings> {
    const record = byClubId(clubId);
    if (!record) throw new Error("Club no encontrado");
    record.settings = { ...input };
    return { ...record.settings };
  }
}
