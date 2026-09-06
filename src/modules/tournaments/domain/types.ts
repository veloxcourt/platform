import type { TournamentType } from "./tournament-types";
import type {
  FinalPhaseConfigValues,
  PhaseConfigValues,
  PlayDayValues,
  RoundConfigMapValues,
} from "./config-schema";
import type { IntermediateFixturePersisted } from "./intermediate-fixture-schema";
import type { FixtureEditModes } from "./fixture-edit-mode";
import type { ZoneQualificationPersisted } from "./zone-qualification";
import type { ZonesFixturePersisted } from "./zones-fixture-schema";
import type { CatalogCategory } from "@/modules/herramientas/domain/calendario-torneos";

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
  catalogCategoryId: string | null;
  abbreviation: string | null;
  color: string | null;
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
  /// AUTO/MANUAL por categoría. Vale en Zonas, Intermedia y Final de esa categoría.
  fixtureEditModes: FixtureEditModes;
  categories: TournamentCategoryItem[];
  pairs: PairListItem[];
  slotReservations: SlotReservationItem[];
}

export interface TournamentsListData {
  club: { id: string; name: string; slug: string; currency: string };
  tournaments: TournamentListItem[];
}

export interface ZonasTournamentDetailData {
  club: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    logoUrl?: string | null;
    locality?: string | null;
    address?: string | null;
  };
  tournament: ZonasTournamentDetail;
  catalogCategories: CatalogCategory[];
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
  catalogCategories: CatalogCategory[];
}

export interface CategoryPhaseConfig {
  categoryId: string;
  categoryName: string;
  phases: {
    zones: PhaseConfigValues;
    knockout: PhaseConfigValues;
    final: FinalPhaseConfigValues;
  };
  /// Formato / duración / días por instancia de llave.
  rounds: RoundConfigMapValues;
  intervalMin: number;
  pairsPerZone: number;
  /// En zona de 4: 3 = FAP, 2 = APA.
  zone4Advancers: 2 | 3;
  /// Fixture armado de zonas (si ya se generó).
  zonesFixture: ZonesFixturePersisted | null;
  /// Fixture armado de fase intermedia (si ya se generó).
  intermediateFixture: IntermediateFixturePersisted | null;
  /// Fixture armado de fase final (si ya se generó).
  finalFixture: IntermediateFixturePersisted | null;
  /// Puestos de zona calculados (quién pasa / queda afuera).
  zoneQualification: ZoneQualificationPersisted | null;
}

export interface TournamentConfig {
  tournamentId: string;
  tournamentName: string;
  startDate: string;
  endDate: string | null;
  courtCount: number;
  playDays: PlayDayValues[];
  /// AUTO/MANUAL por categoría. La misma variable vale en todas las fases.
  fixtureEditModes: FixtureEditModes;
  categories: CategoryPhaseConfig[];
}

export interface TournamentConfigData {
  club: { id: string; name: string; slug: string };
  config: TournamentConfig;
}
