import { ensureRuntimeSchema, prisma } from "@/lib/prisma";
import type {
  TournamentRepository,
  MutationResult,
} from "../application/tournament-repository";
import type { AddPairValues, UpdatePairValues } from "../domain/pair-schema";
import { derivePairPaymentStatus } from "../domain/pair-payment";
import { derivePairRegistrationStatus } from "../domain/pair-confirmation";
import {
  isPlayerEligibleForCategory,
  parseCategoryGenderFromName,
} from "../domain/category-player-filter";
import type {
  CreateCategoryValues,
  RenameCategoryValues,
} from "../domain/category-schema";
import type { UpdateCategorySimulationValues } from "../domain/category-simulation-schema";
import type { TournamentConfigValues, PlayDayValues } from "../domain/config-schema";
import type {
  TogglePairSlotValues,
  ReplacePairSlotPreferencesValues,
} from "../domain/slot-reservation-schema";
import { defaultPhaseConfigs, syncPlayDaysToRange } from "../domain/config-defaults";
import {
  playDayPersistFields,
  toPlayDayValues,
} from "../domain/play-day-slots";
import {
  type CreateTournamentValues,
  type UpdateTournamentValues,
} from "../domain/tournament-schema";
import { buildTournamentPublicSlug } from "../domain/slug";
import type {
  CategoryPhaseConfig,
  PairListItem,
  PaymentStatus,
  RegistrationStatus,
  SlotReservationItem,
  TournamentCategoryItem,
  TournamentConfig,
  TournamentListItem,
  TournamentStatus,
  ZonasTournamentDetail,
} from "../domain/types";
import type { CatalogCategory } from "@/modules/herramientas/domain/calendario-torneos";
import type { CalendarCategoryValues } from "@/modules/herramientas/domain/calendario-schema";
import type { FinalPhaseStartRound, MatchFormat } from "../domain/config-schema";
import type { TournamentType } from "../domain/tournament-types";
import { normalizeCategoryLabel } from "../domain/category-level";
import {
  parseZonesDayPreference,
  type ZonesDayPreference,
} from "../domain/zones-day-preference";
import {
  parseFixtureEditMode,
  type FixtureEditMode,
} from "../domain/fixture-edit-mode";
import {
  buildZonesFixture,
  reservedSlotsFromOtherFixtures,
  type FixturePairInput,
} from "../domain/build-zones-fixture";
import {
  carryZoneScores,
  mergeZoneDraftScores,
  parseZonesFixture,
  toPersistedZonesFixture,
  zonesDraftToPersisted,
  type ZonesFixtureDraftInput,
  type ZonesFixturePersisted,
} from "../domain/zones-fixture-schema";
import {
  buildFinalFixture,
  buildIntermediateFixture,
} from "../domain/build-intermediate-fixture";
import {
  buildZoneQualification,
  parseZoneQualification,
} from "../domain/zone-qualification";
import {
  carryKnockoutScores,
  knockoutFixtureStamps,
  mergeKnockoutDraftScores,
  parseFinalFixture,
  parseIntermediateFixture,
  toPersistedFinalFixture,
  type IntermediateFixturePersisted,
  type KnockoutFixturePhase,
  toPersistedIntermediateFixture,
} from "../domain/intermediate-fixture-schema";
import {
  categoryHasFinalPhase,
  categoryHasIntermediatePhase,
  eligiblePairCount,
  finalPhaseSettings,
  intermediatePhaseSettings,
} from "../domain/intermediate-phase";
import {
  buildCategoryZonesGrid,
  estimateIntermediateMatches,
  findPreferenceSlotInRules,
} from "../domain/zones-slot-registration";
import type { SlotReservationRef } from "../domain/court-day-slots";
import { listSelectablePreferenceSlots } from "../domain/court-day-slots";

function toDbDate(dateISO: string): Date {
  return new Date(`${dateISO}T00:00:00.000Z`);
}

function fromDbDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

let intermediateFixtureColumnReady = false;
let finalFixtureColumnReady = false;
let fixtureEditModeColumnReady = false;

async function ensureFixtureEditModeColumn() {
  if (fixtureEditModeColumnReady) return;
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "fixtureEditMode" TEXT NOT NULL DEFAULT 'AUTO'`,
  );
  fixtureEditModeColumnReady = true;
}

async function readFixtureEditMode(tournamentId: string): Promise<FixtureEditMode> {
  await ensureFixtureEditModeColumn();
  const rows = await prisma.$queryRawUnsafe<Array<{ fixtureEditMode: string }>>(
    `SELECT "fixtureEditMode" FROM "tournaments" WHERE "id" = $1`,
    tournamentId,
  );
  return parseFixtureEditMode(rows[0]?.fixtureEditMode);
}

async function ensureIntermediateFixtureColumn() {
  if (intermediateFixtureColumnReady) return;
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "intermediateFixture" JSONB`,
  );
  intermediateFixtureColumnReady = true;
}

async function ensureFinalFixtureColumn() {
  if (finalFixtureColumnReady) return;
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "finalFixture" JSONB`,
  );
  finalFixtureColumnReady = true;
}

async function ensureZoneQualificationColumn() {
  await ensureRuntimeSchema();
}

function mapStoredPlayDay(day: {
  date: Date;
  startTime: string;
  endTime: string;
  overnightExtraSlots?: number | null;
  enabledSlotIndexes?: number[] | null;
  hasSlotSelection?: boolean | null;
}): PlayDayValues {
  return toPlayDayValues({
    date: fromDbDate(day.date),
    startTime: day.startTime,
    endTime: day.endTime,
    overnightExtraSlots: day.overnightExtraSlots,
    enabledSlotIndexes: day.enabledSlotIndexes,
    hasSlotSelection: day.hasSlotSelection,
  });
}

function mapPair(row: {
  id: string;
  categoryId: string;
  zoneLabel: string | null;
  zonesDayPreference?: string | null;
  status: string;
  player1Confirmed: boolean;
  player2Confirmed: boolean;
  player1PaymentStatus: string;
  player2PaymentStatus: string;
  paymentStatus: string;
  createdAt: Date;
  category: { name: string };
  player1: { id: string; fullName: string };
  player2: { id: string; fullName: string } | null;
}): PairListItem {
  const hasPlayer2 = row.player2 !== null;
  return {
    id: row.id,
    player1: { id: row.player1.id, name: row.player1.fullName },
    player2: row.player2
      ? { id: row.player2.id, name: row.player2.fullName }
      : null,
    categoryId: row.categoryId,
    categoryName: normalizeCategoryLabel(row.category.name),
    zoneLabel: row.zoneLabel,
    zonesDayPreference: parseZonesDayPreference(row.zonesDayPreference),
    status: row.status as RegistrationStatus,
    player1Confirmed: row.player1Confirmed,
    player2Confirmed: row.player2Confirmed,
    player1PaymentStatus: row.player1PaymentStatus as PaymentStatus,
    player2PaymentStatus: row.player2PaymentStatus as PaymentStatus,
    paymentStatus: derivePairPaymentStatus(
      row.player1PaymentStatus as PaymentStatus,
      row.player2PaymentStatus as PaymentStatus,
      hasPlayer2,
    ),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapCategory(
  row: {
    id: string;
    name: string;
    catalogCategoryId?: string | null;
    simulationEnabled?: boolean;
    simulationConfirmedCount?: number | null;
    catalogCategory?: {
      id: string;
      name: string;
      abbreviation: string;
      color: string;
    } | null;
    pairs: {
      status: string;
      player2Id?: string | null;
      zoneLabel?: string | null;
    }[];
  },
): TournamentCategoryItem {
  const activePairs = row.pairs.filter((p) => p.status !== "CANCELLED");
  const catalog = row.catalogCategory ?? null;
  return {
    id: row.id,
    name: catalog?.name ?? normalizeCategoryLabel(row.name),
    catalogCategoryId: catalog?.id ?? row.catalogCategoryId ?? null,
    abbreviation: catalog?.abbreviation ?? null,
    color: catalog?.color ?? null,
    pairCount: activePairs.length,
    confirmedCount: activePairs.filter((p) => p.status === "CONFIRMED").length,
    withoutPartnerCount: activePairs.filter((p) => !p.player2Id).length,
    withoutZoneCount: activePairs.filter((p) => !p.zoneLabel).length,
    simulationEnabled: row.simulationEnabled ?? false,
    simulationConfirmedCount: row.simulationConfirmedCount ?? null,
  };
}

const CATEGORY_INCLUDE = {
  catalogCategory: {
    select: { id: true, name: true, abbreviation: true, color: true },
  },
  pairs: {
    where: { status: { not: "CANCELLED" as const } },
    select: { status: true, player2Id: true, zoneLabel: true },
  },
} as const;

/** Sin zoneQualification: Prisma no debe SELECT-ear columnas que aún no existen. */
const SETTINGS_SELECT = {
  categoryId: true,
  zonesMatchFormat: true,
  zonesMatchDurationMin: true,
  knockoutMatchFormat: true,
  knockoutMatchDurationMin: true,
  finalMatchFormat: true,
  finalMatchDurationMin: true,
  finalStartsAtRound: true,
  intervalMin: true,
  pairsPerZone: true,
  zone4Advancers: true,
  zonesPlayDates: true,
  knockoutPlayDates: true,
  finalPlayDates: true,
  zonesFixture: true,
  intermediateFixture: true,
  finalFixture: true,
} as const;

const SETTINGS_INCLUDE = { select: SETTINGS_SELECT } as const;

function mapTournament(row: {
  id: string;
  type: string;
  name: string;
  description: string | null;
  status: string;
  startDate: Date;
  endDate: Date | null;
  fee: number;
  publicSlug: string;
  pairs: { status: string }[];
}): TournamentListItem {
  const activePairs = row.pairs;
  return {
    id: row.id,
    type: row.type as TournamentType,
    name: row.name,
    description: row.description,
    status: row.status as TournamentStatus,
    startDate: fromDbDate(row.startDate),
    endDate: row.endDate ? fromDbDate(row.endDate) : null,
    fee: row.fee,
    publicSlug: row.publicSlug,
    registrationCount: activePairs.length,
    confirmedCount: activePairs.filter((p) => p.status === "CONFIRMED").length,
  };
}

function mapCategoryPhaseConfig(
  category: { id: string; name: string },
  settings: {
    zonesMatchFormat: string;
    zonesMatchDurationMin: number;
    knockoutMatchFormat: string;
    knockoutMatchDurationMin: number;
    finalMatchFormat: string;
    finalMatchDurationMin: number;
    finalStartsAtRound: string;
    intervalMin: number;
    pairsPerZone?: number;
    zone4Advancers?: number;
    zonesPlayDates?: string[];
    knockoutPlayDates?: string[];
    finalPlayDates?: string[];
    zonesFixture?: unknown;
    intermediateFixture?: unknown;
    finalFixture?: unknown;
    zoneQualification?: unknown;
  } | null,
): CategoryPhaseConfig {
  const phases = defaultPhaseConfigs();

  if (settings) {
    phases.zones = {
      matchFormat: settings.zonesMatchFormat as MatchFormat,
      matchDurationMin: settings.zonesMatchDurationMin,
      playDates: settings.zonesPlayDates ?? [],
    };
    phases.knockout = {
      matchFormat: settings.knockoutMatchFormat as MatchFormat,
      matchDurationMin: settings.knockoutMatchDurationMin,
      playDates: settings.knockoutPlayDates ?? [],
    };
    phases.final = {
      matchFormat: settings.finalMatchFormat as MatchFormat,
      matchDurationMin: settings.finalMatchDurationMin,
      startsAtRound: settings.finalStartsAtRound as FinalPhaseStartRound,
      playDates: settings.finalPlayDates ?? [],
    };
  }

  return {
    categoryId: category.id,
    categoryName: normalizeCategoryLabel(category.name),
    phases,
    intervalMin: settings?.intervalMin ?? 0,
    pairsPerZone: settings?.pairsPerZone ?? 3,
    zone4Advancers: settings?.zone4Advancers === 2 ? 2 : 3,
    zonesFixture: parseZonesFixture(settings?.zonesFixture ?? null),
    intermediateFixture: parseIntermediateFixture(
      settings?.intermediateFixture ?? null,
    ),
    finalFixture: parseFinalFixture(settings?.finalFixture ?? null),
    zoneQualification: parseZoneQualification(settings?.zoneQualification ?? null),
  };
}

async function playerInActivePair(
  tournamentId: string,
  userId: string,
  excludePairId?: string,
): Promise<boolean> {
  const existing = await prisma.tournamentPair.findFirst({
    where: {
      tournamentId,
      status: { not: "CANCELLED" },
      ...(excludePairId ? { id: { not: excludePairId } } : {}),
      OR: [{ player1Id: userId }, { player2Id: userId }],
    },
  });
  return existing !== null;
}

async function validatePairPlayers(
  clubId: string,
  tournamentId: string,
  player1Id: string,
  player2Id: string | null | undefined,
  excludePairId?: string,
): Promise<MutationResult | null> {
  const p1Member = await prisma.membership.findFirst({
    where: { clubId, userId: player1Id },
  });
  if (!p1Member) {
    return { ok: false, error: "El jugador no pertenece al club" };
  }
  if (await playerInActivePair(tournamentId, player1Id, excludePairId)) {
    return {
      ok: false,
      error: "El jugador ya está inscripto en otra pareja",
    };
  }

  if (player2Id) {
    const p2Member = await prisma.membership.findFirst({
      where: { clubId, userId: player2Id },
    });
    if (!p2Member) {
      return { ok: false, error: "El compañero no pertenece al club" };
    }
    if (await playerInActivePair(tournamentId, player2Id, excludePairId)) {
      return {
        ok: false,
        error: "El compañero ya está inscripto en otra pareja",
      };
    }
  }

  return null;
}

async function validatePlayersMatchCategory(
  clubId: string,
  categoryName: string,
  player1Id: string,
  player2Id: string | null | undefined,
): Promise<MutationResult | null> {
  const categoryGender = parseCategoryGenderFromName(categoryName);
  if (!categoryGender) return null;

  const ids = [player1Id, player2Id].filter(Boolean) as string[];
  const users = await prisma.user.findMany({
    where: {
      id: { in: ids },
      memberships: { some: { clubId } },
    },
    select: { id: true, fullName: true, gender: true },
  });

  for (const user of users) {
    if (
      !isPlayerEligibleForCategory(
        { id: user.id, name: user.fullName, gender: user.gender },
        categoryGender,
      )
    ) {
      return {
        ok: false,
        error: "El jugador no corresponde al género de la categoría",
      };
    }
  }
  return null;
}

export class PrismaTournamentRepository implements TournamentRepository {
  async getClubBySlug(slug: string) {
    const club = await prisma.club.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, currency: true },
    });
    if (!club) return null;
    const { getClubProfile } = await import(
      "@/modules/clubs/infrastructure/club-profile"
    );
    const profile = await getClubProfile(club.id);
    return {
      ...club,
      logoUrl: profile?.logoUrl ?? null,
      locality: profile?.locality ?? null,
      address: profile?.address ?? null,
    };
  }

  async getClubLevels(clubId: string) {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { categories: true },
    });
    return club?.categories ?? [];
  }

  async listTournaments(clubId: string): Promise<TournamentListItem[]> {
    const rows = await prisma.tournament.findMany({
      where: { clubId },
      orderBy: { startDate: "desc" },
    });
    if (rows.length === 0) return [];

    const pairs = await prisma.tournamentPair.findMany({
      where: {
        tournamentId: { in: rows.map((r) => r.id) },
        status: { not: "CANCELLED" },
      },
      select: { tournamentId: true, status: true },
    });

    const pairsByTournament = new Map<string, { status: string }[]>();
    for (const pair of pairs) {
      const list = pairsByTournament.get(pair.tournamentId) ?? [];
      list.push({ status: pair.status });
      pairsByTournament.set(pair.tournamentId, list);
    }

    return rows.map((row) =>
      mapTournament({ ...row, pairs: pairsByTournament.get(row.id) ?? [] }),
    );
  }

  async getZonasTournamentDetail(
    clubId: string,
    tournamentId: string,
  ): Promise<ZonasTournamentDetail | null> {
    const row = await prisma.tournament.findFirst({
      where: { id: tournamentId, clubId, type: "ZONAS" },
      include: {
        categories: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: CATEGORY_INCLUDE,
        },
        pairs: {
          where: { status: { not: "CANCELLED" } },
          orderBy: { createdAt: "asc" },
          include: {
            category: { select: { name: true } },
            player1: { select: { id: true, fullName: true } },
            player2: { select: { id: true, fullName: true } },
          },
        },
      },
    });
    if (!row) return null;

    return {
      id: row.id,
      type: "ZONAS",
      name: row.name,
      description: row.description,
      status: row.status as TournamentStatus,
      startDate: fromDbDate(row.startDate),
      endDate: row.endDate ? fromDbDate(row.endDate) : null,
      fee: row.fee,
      publicSlug: row.publicSlug,
      fixtureEditMode: await readFixtureEditMode(row.id),
      categories: row.categories.map(mapCategory),
      pairs: row.pairs.map(mapPair),
      slotReservations: await this.listSlotReservations(clubId, tournamentId),
    };
  }

  async listTournamentCategories(
    clubId: string,
    tournamentId: string,
  ): Promise<TournamentCategoryItem[] | null> {
    const tournament = await prisma.tournament.findFirst({
      where: { id: tournamentId, clubId, type: "ZONAS" },
      select: { id: true },
    });
    if (!tournament) return null;

    const rows = await prisma.tournamentCategory.findMany({
      where: { tournamentId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: CATEGORY_INCLUDE,
    });

    return rows.map(mapCategory);
  }

  async listCatalogCategories(clubId: string): Promise<CatalogCategory[]> {
    const rows = await prisma.calendarPlannerCategory.findMany({
      where: { clubId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      abbreviation: row.abbreviation,
      color: row.color,
    }));
  }

  async createCatalogCategory(
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

    const nameClash = await prisma.calendarPlannerCategory.findFirst({
      where: {
        clubId,
        name: { equals: input.name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (nameClash) return { error: "Ya existe una categoría con ese nombre" };

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
    return {
      id: row.id,
      name: row.name,
      abbreviation: row.abbreviation,
      color: row.color,
    };
  }

  async createTournamentCategory(
    clubId: string,
    tournamentId: string,
    input: CreateCategoryValues,
  ): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
    const tournament = await prisma.tournament.findFirst({
      where: { id: tournamentId, clubId, type: "ZONAS" },
      select: { id: true },
    });
    if (!tournament) return { ok: false, error: "Torneo no encontrado" };

    const catalog = await prisma.calendarPlannerCategory.findFirst({
      where: { id: input.catalogCategoryId, clubId },
    });
    if (!catalog) return { ok: false, error: "Categoría no encontrada" };

    const alreadyLinked = await prisma.tournamentCategory.findFirst({
      where: { tournamentId, catalogCategoryId: catalog.id },
      select: { id: true },
    });
    if (alreadyLinked) {
      return { ok: false, error: "Esa categoría ya está en el torneo" };
    }

    const existingByName = await prisma.tournamentCategory.findUnique({
      where: { tournamentId_name: { tournamentId, name: catalog.name } },
    });
    if (existingByName) {
      if (!existingByName.catalogCategoryId) {
        await prisma.tournamentCategory.update({
          where: { id: existingByName.id },
          data: { catalogCategoryId: catalog.id, name: catalog.name },
        });
        return { ok: true, id: existingByName.id };
      }
      return { ok: false, error: "Ya existe una categoría con ese nombre" };
    }

    const count = await prisma.tournamentCategory.count({
      where: { tournamentId },
    });

    const defaults = defaultPhaseConfigs();

    const category = await prisma.tournamentCategory.create({
      data: {
        tournamentId,
        name: catalog.name,
        catalogCategoryId: catalog.id,
        sortOrder: count,
        settings: {
          create: {
            zonesMatchFormat: defaults.zones.matchFormat,
            zonesMatchDurationMin: defaults.zones.matchDurationMin,
            knockoutMatchFormat: defaults.knockout.matchFormat,
            knockoutMatchDurationMin: defaults.knockout.matchDurationMin,
            finalMatchFormat: defaults.final.matchFormat,
            finalMatchDurationMin: defaults.final.matchDurationMin,
            finalStartsAtRound: defaults.final.startsAtRound,
            intervalMin: 0,
            pairsPerZone: 3,
            zone4Advancers: 3,
            zonesPlayDates: [],
            knockoutPlayDates: [],
            finalPlayDates: [],
          },
        },
      },
      select: { id: true },
    });

    return { ok: true, id: category.id };
  }

  async renameTournamentCategory(
    clubId: string,
    tournamentId: string,
    categoryId: string,
    input: RenameCategoryValues,
  ): Promise<MutationResult> {
    const name = normalizeCategoryLabel(input.name.trim());
    if (!name) return { ok: false, error: "Escribí el nombre" };

    const category = await prisma.tournamentCategory.findFirst({
      where: {
        id: categoryId,
        tournamentId,
        tournament: { clubId, type: "ZONAS" },
      },
      select: { id: true, name: true },
    });
    if (!category) return { ok: false, error: "Categoría no encontrada" };
    if (category.name === name) return { ok: true };

    const duplicate = await prisma.tournamentCategory.findFirst({
      where: {
        tournamentId,
        name,
        id: { not: categoryId },
      },
      select: { id: true },
    });
    if (duplicate) {
      return { ok: false, error: "Ya existe una categoría con ese nombre" };
    }

    try {
      await prisma.tournamentCategory.update({
        where: { id: categoryId },
        data: { name },
      });
      return { ok: true };
    } catch {
      return { ok: false, error: "No se pudo renombrar la categoría" };
    }
  }

  async deleteTournamentCategory(
    clubId: string,
    tournamentId: string,
    categoryId: string,
  ): Promise<MutationResult> {
    const category = await prisma.tournamentCategory.findFirst({
      where: {
        id: categoryId,
        tournamentId,
        tournament: { clubId, type: "ZONAS" },
      },
      select: { id: true },
    });
    if (!category) return { ok: false, error: "Categoría no encontrada" };

    // Cascade: settings, pairs e inscripciones asociadas.
    await prisma.tournamentCategory.delete({ where: { id: categoryId } });
    return { ok: true };
  }

  async updateCategorySimulation(
    clubId: string,
    tournamentId: string,
    categoryId: string,
    input: UpdateCategorySimulationValues,
  ): Promise<MutationResult> {
    const updated = await prisma.tournamentCategory.updateMany({
      where: {
        id: categoryId,
        tournamentId,
        tournament: { clubId, type: "ZONAS" },
      },
      data: {
        simulationEnabled: input.simulationEnabled,
        simulationConfirmedCount: input.simulationConfirmedCount,
      },
    });
    return updated.count
      ? { ok: true }
      : { ok: false, error: "Categoría no encontrada" };
  }

  async createTournament(
    clubId: string,
    input: CreateTournamentValues,
  ): Promise<{ id: string }> {
    const publicSlug = buildTournamentPublicSlug(input.name);
    const tournament = await prisma.tournament.create({
      data: {
        clubId,
        type: input.type,
        name: input.name,
        description: input.description || null,
        status: input.status,
        startDate: toDbDate(input.startDate),
        endDate: input.endDate ? toDbDate(input.endDate) : null,
        fee: input.fee,
        publicSlug,
      },
      select: { id: true },
    });
    return { id: tournament.id };
  }

  async cloneTournament(
    clubId: string,
    tournamentId: string,
    input: { includePairs: boolean; name: string },
  ): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
    await ensureRuntimeSchema();
    const source = await prisma.tournament.findFirst({
      where: { id: tournamentId, clubId },
      include: {
        playDays: { orderBy: { date: "asc" } },
        categories: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: { settings: SETTINGS_INCLUDE },
        },
        pairs: true,
        slotReservations: true,
        registrations: true,
      },
    });
    if (!source) return { ok: false, error: "Torneo no encontrado" };

    const cloneName = input.name.trim();
    if (!cloneName) return { ok: false, error: "Ingresá el nombre del torneo" };

    try {
      const cloneId = await prisma.$transaction(async (tx) => {
        const clone = await tx.tournament.create({
          data: {
            clubId,
            type: source.type,
            name: cloneName,
            description: source.description,
            status: "DRAFT",
            startDate: source.startDate,
            endDate: source.endDate,
            fee: source.fee,
            courtCount: source.courtCount,
            publicSlug: buildTournamentPublicSlug(cloneName),
          },
          select: { id: true },
        });

        if (source.playDays.length > 0) {
          await tx.tournamentPlayDay.createMany({
            data: source.playDays.map((day) => ({
              tournamentId: clone.id,
              date: day.date,
              ...playDayPersistFields(mapStoredPlayDay(day)),
            })),
          });
        }

        const categoryIdMap = new Map<string, string>();
        for (const category of source.categories) {
          const created = await tx.tournamentCategory.create({
            data: {
              tournamentId: clone.id,
              name: category.name,
              catalogCategoryId: category.catalogCategoryId,
              sortOrder: category.sortOrder,
              simulationEnabled: category.simulationEnabled,
              simulationConfirmedCount: category.simulationConfirmedCount,
              settings: category.settings
                ? {
                    create: {
                      zonesMatchFormat: category.settings.zonesMatchFormat,
                      zonesMatchDurationMin:
                        category.settings.zonesMatchDurationMin,
                      knockoutMatchFormat:
                        category.settings.knockoutMatchFormat,
                      knockoutMatchDurationMin:
                        category.settings.knockoutMatchDurationMin,
                      finalMatchFormat: category.settings.finalMatchFormat,
                      finalMatchDurationMin:
                        category.settings.finalMatchDurationMin,
                      finalStartsAtRound: category.settings.finalStartsAtRound,
                      intervalMin: category.settings.intervalMin,
                      pairsPerZone: category.settings.pairsPerZone,
                      zone4Advancers: category.settings.zone4Advancers,
                      zonesPlayDates: category.settings.zonesPlayDates,
                      knockoutPlayDates: category.settings.knockoutPlayDates,
                      finalPlayDates: category.settings.finalPlayDates,
                    },
                  }
                : undefined,
            },
            select: { id: true },
          });
          categoryIdMap.set(category.id, created.id);
        }

        if (!input.includePairs) return clone.id;

        const pairIdMap = new Map<string, string>();
        for (const pair of source.pairs) {
          if (pair.status === "CANCELLED") continue;
          const categoryId = categoryIdMap.get(pair.categoryId);
          if (!categoryId) continue;
          const created = await tx.tournamentPair.create({
            data: {
              tournamentId: clone.id,
              categoryId,
              player1Id: pair.player1Id,
              player2Id: pair.player2Id,
              zoneLabel: pair.zoneLabel,
              zonesDayPreference: pair.zonesDayPreference,
              status: pair.status,
              player1Confirmed: pair.player1Confirmed,
              player2Confirmed: pair.player2Confirmed,
              player1PaymentStatus: pair.player1PaymentStatus,
              player2PaymentStatus: pair.player2PaymentStatus,
              paymentStatus: pair.paymentStatus,
              notes: pair.notes,
            },
            select: { id: true },
          });
          pairIdMap.set(pair.id, created.id);
        }

        const slotRows = source.slotReservations
          .map((slot) => {
            const categoryId = categoryIdMap.get(slot.categoryId);
            const pairId = pairIdMap.get(slot.pairId);
            if (!categoryId || !pairId) return null;
            return {
              tournamentId: clone.id,
              categoryId,
              pairId,
              playDate: slot.playDate,
              courtIndex: slot.courtIndex,
              slotIndex: slot.slotIndex,
              startTime: slot.startTime,
              endTime: slot.endTime,
              phase: slot.phase,
            };
          })
          .filter((row): row is NonNullable<typeof row> => row !== null);

        if (slotRows.length > 0) {
          await tx.tournamentSlotReservation.createMany({ data: slotRows });
        }

        if (source.registrations.length > 0) {
          await tx.tournamentRegistration.createMany({
            data: source.registrations.map((row) => ({
              tournamentId: clone.id,
              userId: row.userId,
              status: row.status,
              paymentStatus: row.paymentStatus,
              category: row.category,
              availability: row.availability ?? undefined,
              notes: row.notes,
            })),
            skipDuplicates: true,
          });
        }

        return clone.id;
      });

      return { ok: true, id: cloneId };
    } catch {
      return { ok: false, error: "No se pudo clonar el torneo" };
    }
  }

  async deleteTournament(
    clubId: string,
    tournamentId: string,
  ): Promise<MutationResult> {
    const existing = await prisma.tournament.findFirst({
      where: { id: tournamentId, clubId },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "Torneo no encontrado" };

    await prisma.tournament.delete({ where: { id: tournamentId } });
    return { ok: true };
  }

  async updateTournament(
    clubId: string,
    tournamentId: string,
    input: UpdateTournamentValues,
  ): Promise<MutationResult> {
    const existing = await prisma.tournament.findFirst({
      where: { id: tournamentId, clubId },
      select: {
        id: true,
        type: true,
        playDays: {
          orderBy: { date: "asc" },
          select: {
            date: true,
            startTime: true,
            endTime: true,
            overnightExtraSlots: true,
            enabledSlotIndexes: true,
            hasSlotSelection: true,
          },
        },
      },
    });
    if (!existing) return { ok: false, error: "Torneo no encontrado" };

    const playDays =
      existing.type === "ZONAS"
        ? syncPlayDaysToRange(
            existing.playDays.map((day) => mapStoredPlayDay(day)),
            input.startDate,
            input.endDate ?? null,
          )
        : null;

    await prisma.$transaction(async (tx) => {
      await tx.tournament.update({
        where: { id: tournamentId },
        data: {
          name: input.name,
          description: input.description || null,
          status: input.status,
          startDate: toDbDate(input.startDate),
          endDate: input.endDate ? toDbDate(input.endDate) : null,
          fee: input.fee,
        },
      });

      if (!playDays) return;

      await tx.tournamentPlayDay.deleteMany({ where: { tournamentId } });
      if (playDays.length > 0) {
        await tx.tournamentPlayDay.createMany({
          data: playDays.map((day) => ({
            tournamentId,
            date: toDbDate(day.date),
            ...playDayPersistFields(day),
          })),
        });
      }
    });

    return { ok: true };
  }

  async addPair(
    clubId: string,
    tournamentId: string,
    input: AddPairValues,
  ): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
    const tournament = await prisma.tournament.findFirst({
      where: { id: tournamentId, clubId, type: "ZONAS" },
      select: { id: true },
    });
    if (!tournament) return { ok: false, error: "Torneo no encontrado" };

    const category = await prisma.tournamentCategory.findFirst({
      where: { id: input.categoryId, tournamentId },
      select: { id: true, name: true },
    });
    if (!category) {
      return { ok: false, error: "Categoría del torneo no encontrada" };
    }

    const player2Id = input.player2Id ?? null;
    const genderError = await validatePlayersMatchCategory(
      clubId,
      category.name,
      input.player1Id,
      player2Id,
    );
    if (genderError) {
      return { ok: false, error: genderError.error ?? "Jugadores no válidos" };
    }

    const playerError = await validatePairPlayers(
      clubId,
      tournamentId,
      input.player1Id,
      player2Id,
    );
    if (playerError) {
      return { ok: false, error: playerError.error ?? "Jugadores no válidos" };
    }

    const created = await prisma.tournamentPair.create({
      data: {
        tournamentId,
        categoryId: input.categoryId,
        player1Id: input.player1Id,
        player2Id,
      },
      select: { id: true },
    });
    return { ok: true, id: created.id };
  }

  async updatePair(
    clubId: string,
    tournamentId: string,
    pairId: string,
    input: UpdatePairValues,
  ): Promise<MutationResult> {
    const existing = await prisma.tournamentPair.findFirst({
      where: {
        id: pairId,
        tournamentId,
        tournament: { clubId, type: "ZONAS" },
      },
      select: {
        id: true,
        status: true,
        player2Id: true,
        player1Confirmed: true,
        player2Confirmed: true,
        player1PaymentStatus: true,
        player2PaymentStatus: true,
      },
    });
    if (!existing) return { ok: false, error: "Pareja no encontrada" };

    const category = await prisma.tournamentCategory.findFirst({
      where: { id: input.categoryId, tournamentId },
      select: { id: true, name: true },
    });
    if (!category) {
      return { ok: false, error: "Categoría del torneo no encontrada" };
    }

    const player2Id = input.player2Id ?? null;
    const genderError = await validatePlayersMatchCategory(
      clubId,
      category.name,
      input.player1Id,
      player2Id,
    );
    if (genderError) return genderError;

    const playerError = await validatePairPlayers(
      clubId,
      tournamentId,
      input.player1Id,
      player2Id,
      pairId,
    );
    if (playerError) return playerError;

    const player2Changed = existing.player2Id !== player2Id;
    const player2Confirmed = player2Changed
      ? false
      : player2Id
        ? existing.player2Confirmed
        : false;
    const player2PaymentStatus =
      player2Changed || !player2Id
        ? "UNPAID"
        : (existing.player2PaymentStatus as PaymentStatus);

    await prisma.tournamentPair.update({
      where: { id: pairId },
      data: {
        categoryId: input.categoryId,
        player1Id: input.player1Id,
        player2Id,
        player2Confirmed,
        player2PaymentStatus,
        status: derivePairRegistrationStatus(
          existing.status as RegistrationStatus,
          player2Id,
          existing.player1Confirmed,
          player2Confirmed,
        ),
        paymentStatus: derivePairPaymentStatus(
          existing.player1PaymentStatus as PaymentStatus,
          player2PaymentStatus,
          player2Id !== null,
        ),
      },
    });
    return { ok: true };
  }

  async updatePairStatus(
    clubId: string,
    pairId: string,
    status: RegistrationStatus,
  ): Promise<MutationResult> {
    const pair = await prisma.tournamentPair.findFirst({
      where: {
        id: pairId,
        tournament: { clubId },
      },
      select: { id: true, tournamentId: true },
    });
    if (!pair) return { ok: false, error: "Pareja no encontrada" };

    await prisma.tournamentPair.update({
      where: { id: pairId },
      data: { status },
    });

    // Al eliminar/cancelar, liberar horarios reservados en la grilla.
    if (status === "CANCELLED") {
      await prisma.tournamentSlotReservation.deleteMany({
        where: { pairId },
      });
    }

    return { ok: true };
  }

  async updatePairPlayerPayment(
    clubId: string,
    pairId: string,
    slot: 1 | 2,
    paymentStatus: PaymentStatus,
  ): Promise<MutationResult> {
    const pair = await prisma.tournamentPair.findFirst({
      where: {
        id: pairId,
        tournament: { clubId },
      },
      select: {
        player2Id: true,
        player1PaymentStatus: true,
        player2PaymentStatus: true,
      },
    });
    if (!pair) return { ok: false, error: "Pareja no encontrada" };
    if (slot === 2 && !pair.player2Id) {
      return { ok: false, error: "La inscripción no tiene compañero" };
    }

    const player1PaymentStatus =
      slot === 1 ? paymentStatus : (pair.player1PaymentStatus as PaymentStatus);
    const player2PaymentStatus =
      slot === 2 ? paymentStatus : (pair.player2PaymentStatus as PaymentStatus);

    const updated = await prisma.tournamentPair.updateMany({
      where: {
        id: pairId,
        tournament: { clubId },
      },
      data: {
        ...(slot === 1 ? { player1PaymentStatus: paymentStatus } : {}),
        ...(slot === 2 ? { player2PaymentStatus: paymentStatus } : {}),
        paymentStatus: derivePairPaymentStatus(
          player1PaymentStatus,
          player2PaymentStatus,
          pair.player2Id !== null,
        ),
      },
    });
    return updated.count
      ? { ok: true }
      : { ok: false, error: "Pareja no encontrada" };
  }

  async updatePairPlayerConfirmation(
    clubId: string,
    pairId: string,
    slot: 1 | 2,
    confirmed: boolean,
  ): Promise<MutationResult> {
    const pair = await prisma.tournamentPair.findFirst({
      where: {
        id: pairId,
        tournament: { clubId },
      },
      select: {
        status: true,
        player2Id: true,
        player1Confirmed: true,
        player2Confirmed: true,
      },
    });
    if (!pair) return { ok: false, error: "Pareja no encontrada" };
    if (slot === 2 && !pair.player2Id) {
      return { ok: false, error: "La inscripción no tiene compañero" };
    }

    const player1Confirmed = slot === 1 ? confirmed : pair.player1Confirmed;
    const player2Confirmed = slot === 2 ? confirmed : pair.player2Confirmed;

    const updated = await prisma.tournamentPair.updateMany({
      where: {
        id: pairId,
        tournament: { clubId },
      },
      data: {
        ...(slot === 1 ? { player1Confirmed: confirmed } : {}),
        ...(slot === 2 ? { player2Confirmed: confirmed } : {}),
        status: derivePairRegistrationStatus(
          pair.status as RegistrationStatus,
          pair.player2Id,
          player1Confirmed,
          player2Confirmed,
        ),
      },
    });
    return updated.count
      ? { ok: true }
      : { ok: false, error: "Pareja no encontrada" };
  }

  async updatePairZonesDayPreference(
    clubId: string,
    tournamentId: string,
    pairId: string,
    zonesDayPreference: ZonesDayPreference,
  ): Promise<MutationResult> {
    const updated = await prisma.tournamentPair.updateMany({
      where: {
        id: pairId,
        tournamentId,
        tournament: { clubId, type: "ZONAS" },
        status: { not: "CANCELLED" },
      },
      data: { zonesDayPreference },
    });
    return updated.count
      ? { ok: true }
      : { ok: false, error: "Pareja no encontrada" };
  }

  async listSlotReservations(
    clubId: string,
    tournamentId: string,
  ): Promise<SlotReservationItem[]> {
    const rows = await prisma.tournamentSlotReservation.findMany({
      where: {
        tournamentId,
        tournament: { clubId, type: "ZONAS" },
        pair: { status: { not: "CANCELLED" } },
      },
      include: {
        pair: {
          include: {
            player1: { select: { fullName: true } },
            player2: { select: { fullName: true } },
          },
        },
      },
      orderBy: [{ playDate: "asc" }, { courtIndex: "asc" }, { slotIndex: "asc" }],
    });

    return rows.map((row) => ({
      id: row.id,
      tournamentId: row.tournamentId,
      categoryId: row.categoryId,
      pairId: row.pairId,
      pairLabel: row.pair.player2
        ? `${row.pair.player1.fullName} / ${row.pair.player2.fullName}`
        : row.pair.player1.fullName,
      playDate: fromDbDate(row.playDate),
      courtIndex: row.courtIndex,
      slotIndex: row.slotIndex,
      startTime: row.startTime,
      endTime: row.endTime,
      phase: "zones" as const,
    }));
  }

  async togglePairSlotReservation(
    clubId: string,
    tournamentId: string,
    pairId: string,
    input: TogglePairSlotValues,
  ): Promise<MutationResult> {
    const pair = await prisma.tournamentPair.findFirst({
      where: {
        id: pairId,
        tournamentId,
        tournament: { clubId, type: "ZONAS" },
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        categoryId: true,
        player1: { select: { fullName: true } },
        player2: { select: { fullName: true } },
      },
    });
    if (!pair) return { ok: false, error: "Pareja no encontrada" };

    const config = await this.getTournamentConfig(clubId, tournamentId);
    if (!config) {
      return { ok: false, error: "Configurá el torneo antes de elegir horarios" };
    }
    const categoryConfig = config.categories.find(
      (c) => c.categoryId === pair.categoryId,
    );
    if (!categoryConfig) {
      return { ok: false, error: "Categoría sin configuración" };
    }

    const existing = await this.listSlotReservations(clubId, tournamentId);
    const mineOnSlot = existing.find(
      (r) =>
        r.pairId === pairId &&
        r.playDate === input.playDate &&
        r.slotIndex === input.slotIndex,
    );

    if (mineOnSlot) {
      await prisma.tournamentSlotReservation.deleteMany({
        where: {
          tournamentId,
          pairId,
          playDate: toDbDate(input.playDate),
          slotIndex: input.slotIndex,
        },
      });
      return { ok: true };
    }

    const categoryRows = await prisma.tournamentCategory.findMany({
      where: { tournamentId },
      select: {
        id: true,
        simulationConfirmedCount: true,
        pairs: {
          where: { status: "CONFIRMED" },
          select: { id: true },
        },
      },
    });
    const confirmedByCategory = new Map(
      categoryRows.map((c) => [
        c.id,
        c.simulationConfirmedCount ?? c.pairs.length,
      ]),
    );
    const confirmedPairsForEstimate =
      confirmedByCategory.get(pair.categoryId) || 8;

    const mineReservations: SlotReservationRef[] = existing
      .filter((r) => r.pairId === pairId)
      .map((r) => ({
        pairId: r.pairId,
        pairLabel: r.pairLabel,
        playDate: r.playDate,
        courtIndex: r.courtIndex,
        slotIndex: r.slotIndex,
      }));

    let intermediateMatches = 0;
    for (const catCfg of config.categories) {
      const n =
        catCfg.categoryId === pair.categoryId
          ? confirmedPairsForEstimate
          : confirmedByCategory.get(catCfg.categoryId) || 0;
      if (n <= 0) continue;
      intermediateMatches += estimateIntermediateMatches(
        n,
        catCfg,
        config.playDays,
        config.courtCount || 1,
      );
    }

    const rules = buildCategoryZonesGrid({
      categoryConfig,
      playDays: config.playDays,
      courtCount: config.courtCount || 1,
      confirmedPairsForEstimate,
      reservations: mineReservations,
      currentPairId: pairId,
      intermediateMatchesOverride: intermediateMatches,
      preferenceMode: true,
    });
    const slot = findPreferenceSlotInRules(
      rules,
      input.playDate,
      input.slotIndex,
    );
    if (!slot) {
      return { ok: false, error: "Horario fuera de la fase de zonas" };
    }
    if (slot.status === "blocked") {
      return {
        ok: false,
        error: "Ese horario está reservado para la fase intermedia",
      };
    }

    try {
      await prisma.tournamentSlotReservation.create({
        data: {
          tournamentId,
          categoryId: pair.categoryId,
          pairId,
          playDate: toDbDate(input.playDate),
          courtIndex: 0,
          slotIndex: input.slotIndex,
          startTime: input.startTime,
          endTime: input.endTime,
          phase: "zones",
        },
      });
      return { ok: true };
    } catch {
      return {
        ok: false,
        error: "No se pudo guardar la preferencia (posible duplicado)",
      };
    }
  }

  async replacePairSlotPreferences(
    clubId: string,
    tournamentId: string,
    pairId: string,
    input: ReplacePairSlotPreferencesValues,
  ): Promise<MutationResult> {
    const pair = await prisma.tournamentPair.findFirst({
      where: {
        id: pairId,
        tournamentId,
        tournament: { clubId, type: "ZONAS" },
        status: { not: "CANCELLED" },
      },
      select: { id: true, categoryId: true },
    });
    if (!pair) return { ok: false, error: "Pareja no encontrada" };

    const config = await this.getTournamentConfig(clubId, tournamentId);
    if (!config) {
      return { ok: false, error: "Configurá el torneo antes de elegir horarios" };
    }
    const categoryConfig = config.categories.find(
      (c) => c.categoryId === pair.categoryId,
    );
    if (!categoryConfig) {
      return { ok: false, error: "Categoría sin configuración" };
    }

    const categoryRows = await prisma.tournamentCategory.findMany({
      where: { tournamentId },
      select: {
        id: true,
        simulationConfirmedCount: true,
        pairs: {
          where: { status: "CONFIRMED" },
          select: { id: true },
        },
      },
    });
    const confirmedByCategory = new Map(
      categoryRows.map((c) => [
        c.id,
        c.simulationConfirmedCount ?? c.pairs.length,
      ]),
    );
    const confirmedPairsForEstimate =
      confirmedByCategory.get(pair.categoryId) || 8;

    let intermediateMatches = 0;
    for (const catCfg of config.categories) {
      const n =
        catCfg.categoryId === pair.categoryId
          ? confirmedPairsForEstimate
          : confirmedByCategory.get(catCfg.categoryId) || 0;
      if (n <= 0) continue;
      intermediateMatches += estimateIntermediateMatches(
        n,
        catCfg,
        config.playDays,
        config.courtCount || 1,
      );
    }

    const rules = buildCategoryZonesGrid({
      categoryConfig,
      playDays: config.playDays,
      courtCount: config.courtCount || 1,
      confirmedPairsForEstimate,
      reservations: [],
      currentPairId: pairId,
      intermediateMatchesOverride: intermediateMatches,
      preferenceMode: true,
    });

    const selectable = new Map(
      listSelectablePreferenceSlots(rules).map((slot) => [
        `${slot.playDate}:${slot.slotIndex}`,
        slot,
      ]),
    );

    const uniqueSlots = new Map<
      string,
      ReplacePairSlotPreferencesValues["slots"][number]
    >();
    for (const slot of input.slots) {
      uniqueSlots.set(`${slot.playDate}:${slot.slotIndex}`, slot);
    }

    for (const slot of uniqueSlots.values()) {
      const eligible = selectable.get(`${slot.playDate}:${slot.slotIndex}`);
      if (!eligible) {
        return { ok: false, error: "Uno o más horarios no están disponibles" };
      }
    }

    await prisma.tournamentSlotReservation.deleteMany({
      where: { tournamentId, pairId },
    });

    if (uniqueSlots.size === 0) return { ok: true };

    try {
      await prisma.tournamentSlotReservation.createMany({
        data: [...uniqueSlots.values()].map((slot) => ({
          tournamentId,
          categoryId: pair.categoryId,
          pairId,
          playDate: toDbDate(slot.playDate),
          courtIndex: 0,
          slotIndex: slot.slotIndex,
          startTime: slot.startTime,
          endTime: slot.endTime,
          phase: "zones" as const,
        })),
      });
      return { ok: true };
    } catch {
      return {
        ok: false,
        error: "No se pudieron guardar las preferencias",
      };
    }
  }

  async buildAndSaveZonesFixture(
    clubId: string,
    tournamentId: string,
    categoryId: string,
  ): Promise<
    | { ok: true; fixture: ZonesFixturePersisted }
    | { ok: false; error: string }
  > {
    const tournament = await prisma.tournament.findFirst({
      where: { id: tournamentId, clubId, type: "ZONAS" },
      select: { id: true, courtCount: true },
    });
    if (!tournament) return { ok: false, error: "Torneo no encontrado" };

    await ensureRuntimeSchema();
    const category = await prisma.tournamentCategory.findFirst({
      where: { id: categoryId, tournamentId },
      include: { settings: SETTINGS_INCLUDE },
    });
    if (!category) return { ok: false, error: "Categoría no encontrada" };

    const config = await this.getTournamentConfig(clubId, tournamentId);
    if (!config) return { ok: false, error: "Configuración no encontrada" };

    const categoryConfig = config.categories.find(
      (c) => c.categoryId === categoryId,
    );
    if (!categoryConfig) {
      return { ok: false, error: "Configuración de categoría no encontrada" };
    }
    if (categoryConfig.phases.zones.playDates.length === 0) {
      return {
        ok: false,
        error: "Asigná días a la fase de zonas en Configuración",
      };
    }

    const pairs = await prisma.tournamentPair.findMany({
      where: {
        tournamentId,
        categoryId,
        status: { not: "CANCELLED" },
        player2Id: { not: null },
      },
      select: {
        id: true,
        zonesDayPreference: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (pairs.length === 0) {
      return {
        ok: false,
        error: "No hay parejas con compañero para armar zonas",
      };
    }

    const reservations = await prisma.tournamentSlotReservation.findMany({
      where: {
        tournamentId,
        categoryId,
        pairId: { in: pairs.map((p) => p.id) },
      },
      select: {
        pairId: true,
        playDate: true,
        slotIndex: true,
        startTime: true,
        endTime: true,
      },
    });

    const prefsByPair = new Map<string, FixturePairInput["preferences"]>();
    for (const pair of pairs) prefsByPair.set(pair.id, []);
    for (const reservation of reservations) {
      const list = prefsByPair.get(reservation.pairId);
      if (!list) continue;
      list.push({
        playDate: fromDbDate(reservation.playDate),
        slotIndex: reservation.slotIndex,
        startTime: reservation.startTime,
        endTime: reservation.endTime,
      });
    }

    const fixturePairs: FixturePairInput[] = pairs.map((pair) => ({
      id: pair.id,
      zonesDayPreference: parseZonesDayPreference(pair.zonesDayPreference),
      preferences: prefsByPair.get(pair.id) ?? [],
    }));

    const slotMinutes =
      categoryConfig.phases.zones.matchDurationMin +
      categoryConfig.intervalMin;

    if ((await readFixtureEditMode(tournamentId)) === "MANUAL") {
      return {
        ok: false,
        error: "Pasá a Modo Automático para actualizar el armado",
      };
    }

    const result = buildZonesFixture({
      pairs: fixturePairs,
      pairsPerZone: categoryConfig.pairsPerZone || 3,
      playDays: config.playDays,
      zonesPlayDates: categoryConfig.phases.zones.playDates,
      courtCount: Math.max(1, config.courtCount || tournament.courtCount || 1),
      slotMinutes: Math.max(1, slotMinutes),
      reservedSlots: reservedSlotsFromOtherFixtures(
        config.categories,
        categoryId,
      ),
    });

    const persisted = carryZoneScores(
      categoryConfig.zonesFixture,
      toPersistedZonesFixture(result),
    );

    await prisma.$transaction(async (tx) => {
      await tx.tournamentPair.updateMany({
        where: { tournamentId, categoryId },
        data: { zoneLabel: null },
      });

      for (const zone of persisted.zones) {
        if (zone.pairIds.length === 0) continue;
        await tx.tournamentPair.updateMany({
          where: {
            tournamentId,
            categoryId,
            id: { in: zone.pairIds },
          },
          data: { zoneLabel: zone.label },
        });
      }

      // Raw SQL: evita PrismaClientValidationError si Turbopack cachea un client
      // sin el campo zonesFixture en el DMMF.
      await ensureZoneQualificationColumn();
      const updated = await tx.$executeRawUnsafe(
        `UPDATE "tournament_settings" SET "zonesFixture" = $1::jsonb, "zoneQualification" = NULL WHERE "categoryId" = $2`,
        JSON.stringify(persisted),
        categoryId,
      );
      if (updated === 0) {
        await tx.tournamentSettings.create({
          data: { categoryId },
        });
        await tx.$executeRawUnsafe(
          `UPDATE "tournament_settings" SET "zonesFixture" = $1::jsonb, "zoneQualification" = NULL WHERE "categoryId" = $2`,
          JSON.stringify(persisted),
          categoryId,
        );
      }
    });

    return { ok: true, fixture: persisted };
  }

  async buildAndSaveIntermediateFixture(
    clubId: string,
    tournamentId: string,
    categoryId?: string,
  ): Promise<
    | {
        ok: true;
        warnings: string[];
        categoryCount: number;
        matchCount: number;
      }
    | { ok: false; error: string }
  > {
    const tournament = await prisma.tournament.findFirst({
      where: { id: tournamentId, clubId, type: "ZONAS" },
      select: { id: true, courtCount: true },
    });
    if (!tournament) return { ok: false, error: "Torneo no encontrado" };
    if ((await readFixtureEditMode(tournamentId)) === "MANUAL") {
      return {
        ok: false,
        error: "Pasá a Modo Automático para actualizar el armado",
      };
    }

    const config = await this.getTournamentConfig(clubId, tournamentId);
    if (!config) return { ok: false, error: "Configuración no encontrada" };

    const pairs = await prisma.tournamentPair.findMany({
      where: { tournamentId, status: { not: "CANCELLED" } },
      select: {
        id: true,
        categoryId: true,
        player2Id: true,
        status: true,
      },
    });

    const pairItems = pairs.map((pair) => ({
      id: pair.id,
      categoryId: pair.categoryId,
      status: pair.status as PairListItem["status"],
      player2: pair.player2Id ? { id: pair.player2Id, name: "" } : null,
      player1: { id: "", name: "" },
      categoryName: "",
      zoneLabel: null,
      zonesDayPreference: "ANY" as const,
      player1Confirmed: false,
      player2Confirmed: false,
      player1PaymentStatus: "UNPAID" as const,
      player2PaymentStatus: "UNPAID" as const,
      paymentStatus: "UNPAID" as const,
      createdAt: "",
    }));

    const allBuilderCategories = config.categories
      .map((category) => {
        const settings = intermediatePhaseSettings(config, category.categoryId);
        const pairCount = eligiblePairCount(
          pairItems,
          category.categoryId,
        );
        return {
          categoryId: category.categoryId,
          pairCount,
          zone4Advancers: settings.zone4Advancers,
          startsAtRound: settings.startsAtRound,
          zonesFixtureMatches:
            category.zonesFixture?.zones.flatMap((zone) => zone.matches) ?? [],
        };
      })
      .filter((category) =>
        categoryHasIntermediatePhase({
          pairCount: category.pairCount,
          zone4Advancers: category.zone4Advancers,
          startsAtRound: category.startsAtRound,
        }),
      );

    const builderCategories = categoryId
      ? allBuilderCategories.filter((item) => item.categoryId === categoryId)
      : allBuilderCategories;

    if (builderCategories.length === 0) {
      return {
        ok: false,
        error: categoryId
          ? "Esta categoría no tiene fase intermedia para armar"
          : "Ninguna categoría tiene fase intermedia para armar",
      };
    }

    const reservedMatches = categoryId
      ? config.categories
          .filter((item) => item.categoryId !== categoryId)
          .flatMap((item) => [
            ...(item.zonesFixture?.zones.flatMap((zone) => zone.matches) ?? []),
            ...knockoutFixtureStamps(item.intermediateFixture),
          ])
      : [];

    const slotMinutes = Math.max(
      60,
      ...builderCategories.map((category) => {
        const categoryConfig = config.categories.find(
          (item) => item.categoryId === category.categoryId,
        );
        return (
          (categoryConfig?.phases.knockout.matchDurationMin ?? 90) +
          (categoryConfig?.intervalMin ?? 0)
        );
      }),
    );

    const result = buildIntermediateFixture({
      playDays: config.playDays,
      courtCount: Math.max(1, config.courtCount || tournament.courtCount || 1),
      slotMinutes,
      categories: builderCategories,
      reservedMatches,
    });

    if (
      result.warnings.some((warning) => warning.includes("penúltimo día")) &&
      result.categories.every((category) => category.rounds.length === 0)
    ) {
      return { ok: false, error: result.warnings[0] ?? "No se pudo armar" };
    }

    await ensureIntermediateFixtureColumn();
    await prisma.$transaction(async (tx) => {
      for (const category of result.categories) {
        const previous = config.categories.find(
          (item) => item.categoryId === category.categoryId,
        )?.intermediateFixture;
        const persisted = carryKnockoutScores(
          previous,
          toPersistedIntermediateFixture(category),
        );
        const updated = await tx.$executeRawUnsafe(
          `UPDATE "tournament_settings" SET "intermediateFixture" = $1::jsonb WHERE "categoryId" = $2`,
          JSON.stringify(persisted),
          category.categoryId,
        );
        if (updated === 0) {
          await tx.tournamentSettings.create({
            data: { categoryId: category.categoryId },
          });
          await tx.$executeRawUnsafe(
            `UPDATE "tournament_settings" SET "intermediateFixture" = $1::jsonb WHERE "categoryId" = $2`,
            JSON.stringify(persisted),
            category.categoryId,
          );
        }
      }
    });

    const matchCount = result.categories.reduce(
      (sum, category) =>
        sum +
        category.rounds.reduce(
          (roundSum, round) => roundSum + round.matches.length,
          0,
        ),
      0,
    );

    return {
      ok: true,
      warnings: result.warnings,
      categoryCount: result.categories.length,
      matchCount,
    };
  }

  async buildAndSaveFinalFixture(
    clubId: string,
    tournamentId: string,
    categoryId?: string,
  ): Promise<
    | {
        ok: true;
        warnings: string[];
        categoryCount: number;
        matchCount: number;
      }
    | { ok: false; error: string }
  > {
    const tournament = await prisma.tournament.findFirst({
      where: { id: tournamentId, clubId, type: "ZONAS" },
      select: { id: true, courtCount: true },
    });
    if (!tournament) return { ok: false, error: "Torneo no encontrado" };
    if ((await readFixtureEditMode(tournamentId)) === "MANUAL") {
      return {
        ok: false,
        error: "Pasá a Modo Automático para actualizar el armado",
      };
    }

    const config = await this.getTournamentConfig(clubId, tournamentId);
    if (!config) return { ok: false, error: "Torneo no encontrado" };

    const pairs = await prisma.tournamentPair.findMany({
      where: { tournamentId, status: { not: "CANCELLED" } },
      select: {
        id: true,
        categoryId: true,
        player2Id: true,
        status: true,
      },
    });
    const pairItems = pairs.map((pair) => ({
      id: pair.id,
      categoryId: pair.categoryId,
      status: pair.status as PairListItem["status"],
      player2: pair.player2Id ? { id: pair.player2Id, name: "" } : null,
      player1: { id: "", name: "" },
      categoryName: "",
      zoneLabel: null,
      zonesDayPreference: "ANY" as const,
      player1Confirmed: false,
      player2Confirmed: false,
      player1PaymentStatus: "UNPAID" as const,
      player2PaymentStatus: "UNPAID" as const,
      paymentStatus: "UNPAID" as const,
      createdAt: "",
    }));

    const allBuilderCategories = config.categories
      .map((category) => {
        const settings = finalPhaseSettings(config, category.categoryId);
        const pairCount = eligiblePairCount(pairItems, category.categoryId);
        return {
          categoryId: category.categoryId,
          pairCount,
          zone4Advancers: settings.zone4Advancers,
          startsAtRound: settings.startsAtRound,
          zonesFixtureMatches:
            category.zonesFixture?.zones.flatMap((zone) => zone.matches) ?? [],
          priorKnockoutMatches:
            category.intermediateFixture?.rounds.flatMap(
              (round) => round.matches,
            ) ?? [],
        };
      })
      .filter((category) =>
        categoryHasFinalPhase({
          pairCount: category.pairCount,
          zone4Advancers: category.zone4Advancers,
          startsAtRound: category.startsAtRound,
        }),
      );

    const builderCategories = categoryId
      ? allBuilderCategories.filter((item) => item.categoryId === categoryId)
      : allBuilderCategories;

    if (builderCategories.length === 0) {
      return {
        ok: false,
        error: categoryId
          ? "Esta categoría no tiene fase final para armar"
          : "Ninguna categoría tiene fase final para armar",
      };
    }

    const reservedMatches = categoryId
      ? config.categories
          .filter((item) => item.categoryId !== categoryId)
          .flatMap((item) => [
            ...(item.zonesFixture?.zones.flatMap((zone) => zone.matches) ?? []),
            ...knockoutFixtureStamps(item.intermediateFixture),
            ...knockoutFixtureStamps(item.finalFixture),
          ])
      : [];

    const slotMinutes = Math.max(
      60,
      ...builderCategories.map((category) => {
        const categoryConfig = config.categories.find(
          (item) => item.categoryId === category.categoryId,
        );
        return (
          (categoryConfig?.phases.final.matchDurationMin ?? 120) +
          (categoryConfig?.intervalMin ?? 0)
        );
      }),
    );

    const result = buildFinalFixture({
      playDays: config.playDays,
      courtCount: Math.max(1, config.courtCount || tournament.courtCount || 1),
      slotMinutes,
      categories: builderCategories,
      reservedMatches,
    });

    if (
      result.warnings.some((warning) => warning.includes("último día")) &&
      result.categories.every((category) => category.rounds.length === 0)
    ) {
      return { ok: false, error: result.warnings[0] ?? "No se pudo armar" };
    }

    await ensureFinalFixtureColumn();
    await prisma.$transaction(async (tx) => {
      for (const category of result.categories) {
        const previous = config.categories.find(
          (item) => item.categoryId === category.categoryId,
        )?.finalFixture;
        const persisted = carryKnockoutScores(
          previous,
          toPersistedFinalFixture(category),
        );
        const updated = await tx.$executeRawUnsafe(
          `UPDATE "tournament_settings" SET "finalFixture" = $1::jsonb WHERE "categoryId" = $2`,
          JSON.stringify(persisted),
          category.categoryId,
        );
        if (updated === 0) {
          await tx.tournamentSettings.create({
            data: { categoryId: category.categoryId },
          });
          await tx.$executeRawUnsafe(
            `UPDATE "tournament_settings" SET "finalFixture" = $1::jsonb WHERE "categoryId" = $2`,
            JSON.stringify(persisted),
            category.categoryId,
          );
        }
      }
    });

    const matchCount = result.categories.reduce(
      (sum, category) =>
        sum +
        category.rounds.reduce(
          (roundSum, round) => roundSum + round.matches.length,
          0,
        ),
      0,
    );

    return {
      ok: true,
      warnings: result.warnings,
      categoryCount: result.categories.length,
      matchCount,
    };
  }

  async getFixtureEditMode(
    clubId: string,
    tournamentId: string,
  ): Promise<FixtureEditMode | null> {
    const tournament = await prisma.tournament.findFirst({
      where: { id: tournamentId, clubId, type: "ZONAS" },
      select: { id: true },
    });
    if (!tournament) return null;
    return readFixtureEditMode(tournament.id);
  }

  async setFixtureEditMode(
    clubId: string,
    tournamentId: string,
    mode: FixtureEditMode,
  ): Promise<MutationResult> {
    const tournament = await prisma.tournament.findFirst({
      where: { id: tournamentId, clubId, type: "ZONAS" },
      select: { id: true },
    });
    if (!tournament) return { ok: false, error: "Torneo no encontrado" };
    await ensureFixtureEditModeColumn();
    await prisma.$executeRawUnsafe(
      `UPDATE "tournaments" SET "fixtureEditMode" = $1 WHERE "id" = $2`,
      mode,
      tournamentId,
    );
    return { ok: true };
  }

  async saveZonesFixtureDraft(
    clubId: string,
    tournamentId: string,
    categoryId: string,
    draft: ZonesFixtureDraftInput,
  ): Promise<MutationResult> {
    const mode = await this.getFixtureEditMode(clubId, tournamentId);
    if (!mode) return { ok: false, error: "Torneo no encontrado" };

    const config = await this.getTournamentConfig(clubId, tournamentId);
    const category = config?.categories.find(
      (item) => item.categoryId === categoryId,
    );
    if (!config || !category) {
      return { ok: false, error: "Categoría no encontrada" };
    }

    const persisted =
      mode === "MANUAL"
        ? zonesDraftToPersisted(draft, category.zonesFixture)
        : category.zonesFixture
          ? mergeZoneDraftScores(category.zonesFixture, draft)
          : zonesDraftToPersisted(draft, null);
    await prisma.$transaction(async (tx) => {
      if (mode === "MANUAL") {
        await tx.tournamentPair.updateMany({
          where: { tournamentId, categoryId },
          data: { zoneLabel: null },
        });
        for (const zone of persisted.zones) {
          if (zone.pairIds.length === 0) continue;
          await tx.tournamentPair.updateMany({
            where: {
              tournamentId,
              categoryId,
              id: { in: zone.pairIds },
            },
            data: { zoneLabel: zone.label },
          });
        }
      }
      const updated = await tx.$executeRawUnsafe(
        `UPDATE "tournament_settings" SET "zonesFixture" = $1::jsonb WHERE "categoryId" = $2`,
        JSON.stringify(persisted),
        categoryId,
      );
      if (updated === 0) {
        await tx.tournamentSettings.create({
          data: { categoryId },
        });
        await tx.$executeRawUnsafe(
          `UPDATE "tournament_settings" SET "zonesFixture" = $1::jsonb WHERE "categoryId" = $2`,
          JSON.stringify(persisted),
          categoryId,
        );
      }
    });
    return { ok: true };
  }

  async saveKnockoutFixtureDraft(
    clubId: string,
    tournamentId: string,
    categoryId: string,
    phase: KnockoutFixturePhase,
    fixture: IntermediateFixturePersisted,
  ): Promise<MutationResult> {
    const mode = await this.getFixtureEditMode(clubId, tournamentId);
    if (!mode) return { ok: false, error: "Torneo no encontrado" };
    const config = await this.getTournamentConfig(clubId, tournamentId);
    const category = config?.categories.find(
      (item) => item.categoryId === categoryId,
    );
    if (!config || !category) {
      return { ok: false, error: "Categoría no encontrada" };
    }
    const previous =
      phase === "final"
        ? category.finalFixture
        : category.intermediateFixture;
    const nextFixture =
      mode === "MANUAL" || !previous
        ? fixture
        : mergeKnockoutDraftScores(previous, fixture);
    const column =
      phase === "final" ? "finalFixture" : "intermediateFixture";
    if (phase === "final") await ensureFinalFixtureColumn();
    else await ensureIntermediateFixtureColumn();
    const updated = await prisma.$executeRawUnsafe(
      `UPDATE "tournament_settings" SET "${column}" = $1::jsonb WHERE "categoryId" = $2`,
      JSON.stringify(nextFixture),
      categoryId,
    );
    if (updated === 0) {
      await prisma.tournamentSettings.create({
        data: { categoryId },
      });
      await prisma.$executeRawUnsafe(
        `UPDATE "tournament_settings" SET "${column}" = $1::jsonb WHERE "categoryId" = $2`,
        JSON.stringify(nextFixture),
        categoryId,
      );
    }
    return { ok: true };
  }

  async calculateAndSaveZoneQualification(
    clubId: string,
    tournamentId: string,
  ): Promise<
    | {
        ok: true;
        categoryCount: number;
        seedCount: number;
        warnings: string[];
      }
    | { ok: false; error: string }
  > {
    const config = await this.getTournamentConfig(clubId, tournamentId);
    if (!config) return { ok: false, error: "Torneo no encontrado" };

    await ensureZoneQualificationColumn();
    const warnings: string[] = [];
    let seedCount = 0;
    let categoryCount = 0;

    for (const category of config.categories) {
      const qualification = buildZoneQualification({
        fixture: category.zonesFixture,
        format: category.phases.zones.matchFormat,
        zone4Advancers: category.zone4Advancers === 2 ? 2 : 3,
      });
      categoryCount += 1;
      seedCount += qualification.seeds.length;
      for (const warning of qualification.warnings) {
        warnings.push(`${category.categoryName}: ${warning}`);
      }

      const updated = await prisma.$executeRawUnsafe(
        `UPDATE "tournament_settings" SET "zoneQualification" = $1::jsonb WHERE "categoryId" = $2`,
        JSON.stringify(qualification),
        category.categoryId,
      );
      if (updated === 0) {
        await prisma.tournamentSettings.create({
          data: { categoryId: category.categoryId },
        });
        await prisma.$executeRawUnsafe(
          `UPDATE "tournament_settings" SET "zoneQualification" = $1::jsonb WHERE "categoryId" = $2`,
          JSON.stringify(qualification),
          category.categoryId,
        );
      }
    }

    return { ok: true, categoryCount, seedCount, warnings };
  }

  async getTournamentConfig(
    clubId: string,
    tournamentId: string,
  ): Promise<TournamentConfig | null> {
    const tournament = await prisma.tournament.findFirst({
      where: { id: tournamentId, clubId, type: "ZONAS" },
      include: {
        playDays: { orderBy: { date: "asc" } },
        categories: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: { settings: SETTINGS_INCLUDE },
        },
      },
    });
    if (!tournament) return null;

    const startDate = fromDbDate(tournament.startDate);
    const endDate = tournament.endDate
      ? fromDbDate(tournament.endDate)
      : null;

    const storedDays = tournament.playDays.map((d) => mapStoredPlayDay(d));
    const playDays = syncPlayDaysToRange(storedDays, startDate, endDate);

    const categoryIds = tournament.categories.map((c) => c.id);
    await ensureIntermediateFixtureColumn();
    await ensureFinalFixtureColumn();
    const fixtureRows =
      categoryIds.length === 0
        ? []
        : await prisma.$queryRawUnsafe<
            Array<{
              categoryId: string;
              zonesFixture: unknown;
              intermediateFixture: unknown;
              finalFixture: unknown;
            }>
          >(
            `SELECT "categoryId", "zonesFixture", "intermediateFixture", "finalFixture" FROM "tournament_settings" WHERE "categoryId" = ANY($1::text[])`,
            categoryIds,
          );
    const fixtureByCategory = new Map(
      fixtureRows.map((row) => [row.categoryId, row.zonesFixture]),
    );
    const intermediateByCategory = new Map(
      fixtureRows.map((row) => [row.categoryId, row.intermediateFixture]),
    );
    const finalByCategory = new Map(
      fixtureRows.map((row) => [row.categoryId, row.finalFixture]),
    );
    const qualificationByCategory = new Map<string, unknown>();
    try {
      await ensureRuntimeSchema();
      if (categoryIds.length > 0) {
        const qualificationRows = await prisma.$queryRawUnsafe<
          Array<{ categoryId: string; zoneQualification: unknown }>
        >(
          `SELECT "categoryId", "zoneQualification" FROM "tournament_settings" WHERE "categoryId" = ANY($1::text[])`,
          categoryIds,
        );
        for (const row of qualificationRows) {
          qualificationByCategory.set(row.categoryId, row.zoneQualification);
        }
      }
    } catch (error) {
      console.error("[tournaments] zoneQualification unavailable", error);
    }

    return {
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      startDate,
      endDate,
      courtCount: Math.max(1, tournament.courtCount),
      playDays,
      fixtureEditMode: await readFixtureEditMode(tournament.id),
      categories: tournament.categories.map((category) => {
        const settings = category.settings
          ? {
              ...category.settings,
              zonesFixture:
                (category.settings as { zonesFixture?: unknown }).zonesFixture ??
                fixtureByCategory.get(category.id) ??
                null,
              intermediateFixture:
                (category.settings as { intermediateFixture?: unknown })
                  .intermediateFixture ??
                intermediateByCategory.get(category.id) ??
                null,
              finalFixture:
                (category.settings as { finalFixture?: unknown })
                  .finalFixture ??
                finalByCategory.get(category.id) ??
                null,
              zoneQualification:
                (category.settings as { zoneQualification?: unknown })
                  .zoneQualification ??
                qualificationByCategory.get(category.id) ??
                null,
            }
          : {
              zonesFixture: fixtureByCategory.get(category.id) ?? null,
              intermediateFixture:
                intermediateByCategory.get(category.id) ?? null,
              finalFixture: finalByCategory.get(category.id) ?? null,
              zoneQualification: qualificationByCategory.get(category.id) ?? null,
              zonesMatchFormat: "ONE_SET_6",
              zonesMatchDurationMin: 75,
              knockoutMatchFormat: "TWO_SETS_STB",
              knockoutMatchDurationMin: 90,
              finalMatchFormat: "BEST_OF_3",
              finalMatchDurationMin: 120,
              finalStartsAtRound: "SEMI_FINALS",
              intervalMin: 0,
              pairsPerZone: 3,
              zone4Advancers: 3,
              zonesPlayDates: [] as string[],
              knockoutPlayDates: [] as string[],
              finalPlayDates: [] as string[],
            };
        return mapCategoryPhaseConfig(category, settings);
      }),
    };
  }

  async saveTournamentConfig(
    clubId: string,
    tournamentId: string,
    input: TournamentConfigValues,
  ): Promise<MutationResult> {
    const tournament = await prisma.tournament.findFirst({
      where: { id: tournamentId, clubId, type: "ZONAS" },
      select: { id: true, startDate: true, endDate: true },
    });
    if (!tournament) return { ok: false, error: "Torneo no encontrado" };

    const categoryIds = await prisma.tournamentCategory.findMany({
      where: { tournamentId },
      select: { id: true },
    });
    const validIds = new Set(categoryIds.map((c) => c.id));
    if (!input.categories.every((c) => validIds.has(c.categoryId))) {
      return { ok: false, error: "Categoría no encontrada" };
    }

    const playDays = syncPlayDaysToRange(
      input.playDays,
      fromDbDate(tournament.startDate),
      tournament.endDate ? fromDbDate(tournament.endDate) : null,
    );

    await prisma.$transaction([
      prisma.tournament.update({
        where: { id: tournamentId },
        data: { courtCount: input.courtCount },
      }),
      prisma.tournamentPlayDay.deleteMany({ where: { tournamentId } }),
      prisma.tournamentPlayDay.createMany({
        data: playDays.map((d) => ({
          tournamentId,
          date: toDbDate(d.date),
          ...playDayPersistFields(d),
        })),
      }),
      ...input.categories.map((category) =>
        prisma.tournamentSettings.upsert({
          where: { categoryId: category.categoryId },
          create: {
            categoryId: category.categoryId,
            zonesMatchFormat: category.phases.zones.matchFormat,
            zonesMatchDurationMin: category.phases.zones.matchDurationMin,
            knockoutMatchFormat: category.phases.knockout.matchFormat,
            knockoutMatchDurationMin: category.phases.knockout.matchDurationMin,
            finalMatchFormat: category.phases.final.matchFormat,
            finalMatchDurationMin: category.phases.final.matchDurationMin,
            finalStartsAtRound: category.phases.final.startsAtRound,
            intervalMin: category.intervalMin,
            pairsPerZone: category.pairsPerZone,
            zone4Advancers: category.zone4Advancers,
            zonesPlayDates: category.phases.zones.playDates,
            knockoutPlayDates: category.phases.knockout.playDates,
            finalPlayDates: category.phases.final.playDates,
          },
          update: {
            zonesMatchFormat: category.phases.zones.matchFormat,
            zonesMatchDurationMin: category.phases.zones.matchDurationMin,
            knockoutMatchFormat: category.phases.knockout.matchFormat,
            knockoutMatchDurationMin: category.phases.knockout.matchDurationMin,
            finalMatchFormat: category.phases.final.matchFormat,
            finalMatchDurationMin: category.phases.final.matchDurationMin,
            finalStartsAtRound: category.phases.final.startsAtRound,
            intervalMin: category.intervalMin,
            pairsPerZone: category.pairsPerZone,
            zone4Advancers: category.zone4Advancers,
            zonesPlayDates: category.phases.zones.playDates,
            knockoutPlayDates: category.phases.knockout.playDates,
            finalPlayDates: category.phases.final.playDates,
          },
        }),
      ),
    ]);

    return { ok: true };
  }

  async copyCategoryPhaseConfig(
    clubId: string,
    tournamentId: string,
    sourceCategoryId: string,
    targetCategoryId: string,
  ): Promise<MutationResult> {
    if (sourceCategoryId === targetCategoryId) {
      return { ok: false, error: "Elegí otra categoría de origen" };
    }

    const tournament = await prisma.tournament.findFirst({
      where: { id: tournamentId, clubId, type: "ZONAS" },
      select: { id: true },
    });
    if (!tournament) return { ok: false, error: "Torneo no encontrado" };

    await ensureRuntimeSchema();
    const [source, target] = await Promise.all([
      prisma.tournamentCategory.findFirst({
        where: { id: sourceCategoryId, tournamentId },
        include: { settings: SETTINGS_INCLUDE },
      }),
      prisma.tournamentCategory.findFirst({
        where: { id: targetCategoryId, tournamentId },
        include: { settings: SETTINGS_INCLUDE },
      }),
    ]);
    if (!source?.settings) {
      return { ok: false, error: "La categoría de origen no tiene configuración" };
    }
    if (!target) return { ok: false, error: "Categoría destino no encontrada" };

    const s = source.settings;
    await prisma.tournamentSettings.upsert({
      where: { categoryId: targetCategoryId },
      create: {
        categoryId: targetCategoryId,
        zonesMatchFormat: s.zonesMatchFormat,
        zonesMatchDurationMin: s.zonesMatchDurationMin,
        knockoutMatchFormat: s.knockoutMatchFormat,
        knockoutMatchDurationMin: s.knockoutMatchDurationMin,
        finalMatchFormat: s.finalMatchFormat,
        finalMatchDurationMin: s.finalMatchDurationMin,
        finalStartsAtRound: s.finalStartsAtRound,
        intervalMin: s.intervalMin,
        pairsPerZone: s.pairsPerZone,
        zone4Advancers: s.zone4Advancers,
        zonesPlayDates: s.zonesPlayDates,
        knockoutPlayDates: s.knockoutPlayDates,
        finalPlayDates: s.finalPlayDates,
      },
      update: {
        zonesMatchFormat: s.zonesMatchFormat,
        zonesMatchDurationMin: s.zonesMatchDurationMin,
        knockoutMatchFormat: s.knockoutMatchFormat,
        knockoutMatchDurationMin: s.knockoutMatchDurationMin,
        finalMatchFormat: s.finalMatchFormat,
        finalMatchDurationMin: s.finalMatchDurationMin,
        finalStartsAtRound: s.finalStartsAtRound,
        intervalMin: s.intervalMin,
        pairsPerZone: s.pairsPerZone,
        zone4Advancers: s.zone4Advancers,
        zonesPlayDates: s.zonesPlayDates,
        knockoutPlayDates: s.knockoutPlayDates,
        finalPlayDates: s.finalPlayDates,
      },
    });

    return { ok: true };
  }
}
