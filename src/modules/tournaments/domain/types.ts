import type { TournamentType } from "./tournament-types";
import type {
  FinalPhaseConfigValues,
  PhaseConfigValues,
  PlayDayValues,
} from "./config-schema";
import type { ZonesFixturePersisted } from "./zones-fixture-schema";

export type TournamentStatus = "DRAFT" | "OPEN" | "CLOSED" | "FINISHED";
export type RegistrationStatus = "PENDING" | "CONFIRMED" | "CANCELLED";
export type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

export interface TournamentListItem {
  id: string;
  type: TournamentType;
  name: string;
  description: string | null;
  status: TournamentStatus;
  startDate: string;
  endDate: string | null;
  fee: number;
  publicSlug: string;
  registrationCount: number;
  confirmedCount: number;
}

export interface TournamentCategoryItem {
  id: string;
  name: string;
  pairCount: number;
  confirmedCount: number;
  withoutPartnerCount: number;
  withoutZoneCount: number;
  simulationEnabled: boolean;
  simulationConfirmedCount: number | null;
}

export interface PairPlayerRef {
  id: string;
  name: string;
}

export interface PairListItem {
  id: string;
  player1: PairPlayerRef;
  player2: PairPlayerRef | null;
  categoryId: string;
  categoryName: string;
  zoneLabel: string | null;
  /// SAME_DAY | DIFFERENT_DAYS | ANY
  zonesDayPreference: "SAME_DAY" | "DIFFERENT_DAYS" | "ANY";
  status: RegistrationStatus;
  player1Confirmed: boolean;
  player2Confirmed: boolean;
  player1PaymentStatus: PaymentStatus;
  player2PaymentStatus: PaymentStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
}

export interface SlotReservationItem {
  id: string;
  tournamentId: string;
  categoryId: string;
  pairId: string;
  pairLabel: string;
  playDate: string;
  courtIndex: number;
  slotIndex: number;
  startTime: string;
  endTime: string;
  phase: "zones";
}

export interface ZonasTournamentDetail {
  id: string;
  type: "ZONAS";
  name: string;
  description: string | null;
  status: TournamentStatus;
  startDate: string;
  endDate: string | null;
  fee: number;
  publicSlug: string;
  categories: TournamentCategoryItem[];
  pairs: PairListItem[];
  slotReservations: SlotReservationItem[];
}

export interface TournamentsListData {
  club: { id: string; name: string; slug: string; currency: string };
  tournaments: TournamentListItem[];
}

export interface ZonasTournamentDetailData {
  club: { id: string; name: string; slug: string; currency: string };
  tournament: ZonasTournamentDetail;
  levels: string[];
}

export interface TournamentCategoriesData {
  club: { id: string; name: string; slug: string };
  tournament: {
    id: string;
    name: string;
    startDate: string;
    endDate: string | null;
  };
  categories: TournamentCategoryItem[];
  levels: string[];
}

export interface CategoryPhaseConfig {
  categoryId: string;
  categoryName: string;
  phases: {
    zones: PhaseConfigValues;
    knockout: PhaseConfigValues;
    final: FinalPhaseConfigValues;
  };
  intervalMin: number;
  pairsPerZone: number;
  /// Fixture armado de zonas (si ya se generó).
  zonesFixture: ZonesFixturePersisted | null;
}

export interface TournamentConfig {
  tournamentId: string;
  tournamentName: string;
  startDate: string;
  endDate: string | null;
  courtCount: number;
  playDays: PlayDayValues[];
  categories: CategoryPhaseConfig[];
}

export interface TournamentConfigData {
  club: { id: string; name: string; slug: string };
  config: TournamentConfig;
}
