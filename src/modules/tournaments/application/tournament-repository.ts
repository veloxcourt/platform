import type { AddPairValues, UpdatePairValues } from "../domain/pair-schema";
import type { CreateCategoryValues } from "../domain/category-schema";
import type { UpdateCategorySimulationValues } from "../domain/category-simulation-schema";
import type { TournamentConfigValues } from "../domain/config-schema";
import type { TogglePairSlotValues } from "../domain/slot-reservation-schema";
import type { ReplacePairSlotPreferencesValues } from "../domain/slot-reservation-schema";
import type { CreateTournamentValues } from "../domain/tournament-schema";
import type { UpdateTournamentValues } from "../domain/tournament-schema";
import type {
  PaymentStatus,
  RegistrationStatus,
  SlotReservationItem,
  TournamentCategoryItem,
  TournamentConfig,
  TournamentListItem,
  ZonasTournamentDetail,
} from "../domain/types";
import type { ZonesFixturePersisted } from "../domain/zones-fixture-schema";

export type MutationResult = { ok: boolean; error?: string };

export interface TournamentRepository {
  getClubBySlug(
    slug: string,
  ): Promise<{ id: string; name: string; slug: string; currency: string } | null>;
  getClubLevels(clubId: string): Promise<string[]>;
  listTournaments(clubId: string): Promise<TournamentListItem[]>;
  getZonasTournamentDetail(
    clubId: string,
    tournamentId: string,
  ): Promise<ZonasTournamentDetail | null>;
  listTournamentCategories(
    clubId: string,
    tournamentId: string,
  ): Promise<TournamentCategoryItem[] | null>;
  createTournamentCategory(
    clubId: string,
    tournamentId: string,
    input: CreateCategoryValues,
  ): Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  updateCategorySimulation(
    clubId: string,
    tournamentId: string,
    categoryId: string,
    input: UpdateCategorySimulationValues,
  ): Promise<MutationResult>;
  createTournament(
    clubId: string,
    input: CreateTournamentValues,
  ): Promise<{ id: string }>;
  updateTournament(
    clubId: string,
    tournamentId: string,
    input: UpdateTournamentValues,
  ): Promise<MutationResult>;
  addPair(
    clubId: string,
    tournamentId: string,
    input: AddPairValues,
  ): Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  updatePair(
    clubId: string,
    tournamentId: string,
    pairId: string,
    input: UpdatePairValues,
  ): Promise<MutationResult>;
  updatePairStatus(
    clubId: string,
    pairId: string,
    status: RegistrationStatus,
  ): Promise<MutationResult>;
  updatePairPlayerPayment(
    clubId: string,
    pairId: string,
    slot: 1 | 2,
    paymentStatus: PaymentStatus,
  ): Promise<MutationResult>;
  updatePairPlayerConfirmation(
    clubId: string,
    pairId: string,
    slot: 1 | 2,
    confirmed: boolean,
  ): Promise<MutationResult>;
  updatePairZonesDayPreference(
    clubId: string,
    tournamentId: string,
    pairId: string,
    zonesDayPreference: "SAME_DAY" | "DIFFERENT_DAYS" | "ANY",
  ): Promise<MutationResult>;
  listSlotReservations(
    clubId: string,
    tournamentId: string,
  ): Promise<SlotReservationItem[]>;
  togglePairSlotReservation(
    clubId: string,
    tournamentId: string,
    pairId: string,
    input: TogglePairSlotValues,
  ): Promise<MutationResult>;
  replacePairSlotPreferences(
    clubId: string,
    tournamentId: string,
    pairId: string,
    input: ReplacePairSlotPreferencesValues,
  ): Promise<MutationResult>;
  buildAndSaveZonesFixture(
    clubId: string,
    tournamentId: string,
    categoryId: string,
  ): Promise<
    | { ok: true; fixture: ZonesFixturePersisted }
    | { ok: false; error: string }
  >;
  getTournamentConfig(
    clubId: string,
    tournamentId: string,
  ): Promise<TournamentConfig | null>;
  saveTournamentConfig(
    clubId: string,
    tournamentId: string,
    input: TournamentConfigValues,
  ): Promise<MutationResult>;
}
