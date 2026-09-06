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
import type { EcoGroup, EcoItem } from "../domain/eco-torneo";
import type {
  EcoTorneoSimulationDetail,
  EcoTorneoSimulationListItem,
} from "../domain/types";

export type HerramientasClubInfo = {
  id: string;
  name: string;
  slug: string;
  currency: string;
};

export interface HerramientasRepository {
  getClubBySlug(slug: string): Promise<HerramientasClubInfo | null>;

  listEcoTorneoSimulations(
    clubId: string,
  ): Promise<EcoTorneoSimulationListItem[]>;

  getEcoTorneoSimulation(
    clubId: string,
    id: string,
  ): Promise<EcoTorneoSimulationDetail | null>;

  createEcoTorneoSimulation(
    clubId: string,
    input: { name: string; items: EcoItem[]; groups?: EcoGroup[] },
  ): Promise<EcoTorneoSimulationDetail>;

  updateEcoTorneoSimulationName(
    clubId: string,
    id: string,
    name: string,
  ): Promise<EcoTorneoSimulationDetail | null>;

  updateEcoTorneoSimulationItems(
    clubId: string,
    id: string,
    items: EcoItem[],
    groups?: EcoGroup[],
  ): Promise<EcoTorneoSimulationDetail | null>;

  deleteEcoTorneoSimulation(clubId: string, id: string): Promise<boolean>;

  getCalendarPlannerState(clubId: string): Promise<CalendarPlannerState>;

  createCalendarVenue(
    clubId: string,
    input: CalendarVenueValues,
  ): Promise<CalendarClub>;
  updateCalendarVenue(
    clubId: string,
    id: string,
    input: CalendarVenueValues,
  ): Promise<CalendarClub | null>;
  deleteCalendarVenue(clubId: string, id: string): Promise<boolean>;
  reorderCalendarVenues(
    clubId: string,
    ids: string[],
  ): Promise<boolean>;

  createCalendarCategory(
    clubId: string,
    input: CalendarCategoryValues,
  ): Promise<CatalogCategory | { error: string }>;
  updateCalendarCategory(
    clubId: string,
    id: string,
    input: CalendarCategoryValues,
  ): Promise<CatalogCategory | { error: string } | null>;
  deleteCalendarCategory(clubId: string, id: string): Promise<boolean>;

  createPlannedTournament(
    clubId: string,
    input: PlannedTournamentValues,
  ): Promise<PlannedTournament | { error: string }>;
  updatePlannedTournament(
    clubId: string,
    id: string,
    input: PlannedTournamentValues,
  ): Promise<PlannedTournament | { error: string } | null>;
  deletePlannedTournament(clubId: string, id: string): Promise<boolean>;

  createCalendarSearchLink(
    clubId: string,
    input: CalendarSearchLinkValues,
  ): Promise<CalendarSearchLink>;
  updateCalendarSearchLink(
    clubId: string,
    id: string,
    input: CalendarSearchLinkValues,
  ): Promise<CalendarSearchLink | null>;
  deleteCalendarSearchLink(clubId: string, id: string): Promise<boolean>;

  updateCalendarPlannerSettings(
    clubId: string,
    input: CalendarSettingsValues,
  ): Promise<CalendarPlannerSettings>;
}
