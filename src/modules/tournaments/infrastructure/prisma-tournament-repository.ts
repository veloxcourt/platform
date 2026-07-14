import { prisma } from "@/lib/prisma";
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
import type { CreateCategoryValues } from "../domain/category-schema";
import type { UpdateCategorySimulationValues } from "../domain/category-simulation-schema";
import { buildCategoryName } from "../domain/category-schema";
import type { TournamentConfigValues } from "../domain/config-schema";
import type {
  TogglePairSlotValues,
  ReplacePairSlotPreferencesValues,
} from "../domain/slot-reservation-schema";
import { defaultPhaseConfigs, defaultPlayDays } from "../domain/config-defaults";
import type {
  CreateTournamentValues,
  UpdateTournamentValues,
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
import type { FinalPhaseStartRound, MatchFormat } from "../domain/config-schema";
import type { TournamentType } from "../domain/tournament-types";
import { normalizeCategoryLabel } from "../domain/category-level";
import { parseZonesDayPreference } from "../domain/zones-day-preference";
import type { ZonesDayPreference } from "../domain/zones-day-preference";
import {
  buildZonesFixture,
  type FixturePairInput,
} from "../domain/build-zones-fixture";
import {
  parseZonesFixture,
  toPersistedZonesFixture,
  type ZonesFixturePersisted,
} from "../domain/zones-fixture-schema";
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
    simulationEnabled?: boolean;
    simulationConfirmedCount?: number | null;
    pairs: {
      status: string;
      player2Id?: string | null;
      zoneLabel?: string | null;
    }[];
  },
): TournamentCategoryItem {
  const activePairs = row.pairs.filter((p) => p.status !== "CANCELLED");
  return {
    id: row.id,
    name: normalizeCategoryLabel(row.name),
    pairCount: activePairs.length,
    confirmedCount: activePairs.filter((p) => p.status === "CONFIRMED").length,
    withoutPartnerCount: activePairs.filter((p) => !p.player2Id).length,
    withoutZoneCount: activePairs.filter((p) => !p.zoneLabel).length,
    simulationEnabled: row.simulationEnabled ?? false,
    simulationConfirmedCount: row.simulationConfirmedCount ?? null,
  };
}

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
    zonesPlayDates?: string[];
    knockoutPlayDates?: string[];
    finalPlayDates?: string[];
    zonesFixture?: unknown;
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
    zonesFixture: parseZonesFixture(settings?.zonesFixture ?? null),
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
    return club;
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
          include: {
            pairs: {
              where: { status: { not: "CANCELLED" } },
              select: { status: true, player2Id: true, zoneLabel: true },
            },
          },
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
      include: {
        pairs: {
          where: { status: { not: "CANCELLED" } },
          select: { status: true, player2Id: true, zoneLabel: true },
        },
      },
    });

    return rows.map(mapCategory);
  }

  async createTournamentCategory(
    clubId: string,
    tournamentId: string,
    input: CreateCategoryValues,
  ): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
    const tournament = await prisma.tournament.findFirst({
      where: { id: tournamentId, clubId, type: "ZONAS" },
      select: { id: true, startDate: true, endDate: true },
    });
    if (!tournament) return { ok: false, error: "Torneo no encontrado" };

    const name = buildCategoryName(input.gender, input.level);
    const existing = await prisma.tournamentCategory.findUnique({
      where: { tournamentId_name: { tournamentId, name } },
    });
    if (existing) {
      return { ok: false, error: "Ya existe una categoría con ese nombre" };
    }

    const count = await prisma.tournamentCategory.count({
      where: { tournamentId },
    });

    const defaults = defaultPhaseConfigs();

    const category = await prisma.tournamentCategory.create({
      data: {
        tournamentId,
        name,
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

  async updateTournament(
    clubId: string,
    tournamentId: string,
    input: UpdateTournamentValues,
  ): Promise<MutationResult> {
    const updated = await prisma.tournament.updateMany({
      where: { id: tournamentId, clubId },
      data: {
        name: input.name,
        description: input.description || null,
        status: input.status,
        startDate: toDbDate(input.startDate),
        endDate: input.endDate ? toDbDate(input.endDate) : null,
        fee: input.fee,
      },
    });
    return updated.count
      ? { ok: true }
      : { ok: false, error: "Torneo no encontrado" };
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

    const category = await prisma.tournamentCategory.findFirst({
      where: { id: categoryId, tournamentId },
      include: { settings: true },
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

    const result = buildZonesFixture({
      pairs: fixturePairs,
      pairsPerZone: categoryConfig.pairsPerZone || 3,
      playDays: config.playDays,
      zonesPlayDates: categoryConfig.phases.zones.playDates,
      courtCount: Math.max(1, config.courtCount || tournament.courtCount || 1),
      slotMinutes: Math.max(1, slotMinutes),
    });

    const persisted = toPersistedZonesFixture(result);

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

    return { ok: true, fixture: persisted };
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
          include: { settings: true },
        },
      },
    });
    if (!tournament) return null;

    const startDate = fromDbDate(tournament.startDate);
    const endDate = tournament.endDate
      ? fromDbDate(tournament.endDate)
      : null;

    const playDays =
      tournament.playDays.length > 0
        ? tournament.playDays.map((d) => ({
            date: fromDbDate(d.date),
            startTime: d.startTime,
            endTime: d.endTime,
          }))
        : defaultPlayDays(startDate, endDate);

    const categoryIds = tournament.categories.map((c) => c.id);
    const fixtureRows =
      categoryIds.length === 0
        ? []
        : await prisma.$queryRawUnsafe<
            Array<{ categoryId: string; zonesFixture: unknown }>
          >(
            `SELECT "categoryId", "zonesFixture" FROM "tournament_settings" WHERE "categoryId" = ANY($1::text[])`,
            categoryIds,
          );
    const fixtureByCategory = new Map(
      fixtureRows.map((row) => [row.categoryId, row.zonesFixture]),
    );

    return {
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      startDate,
      endDate,
      courtCount: Math.max(1, tournament.courtCount),
      playDays,
      categories: tournament.categories.map((category) => {
        const settings = category.settings
          ? {
              ...category.settings,
              zonesFixture:
                (category.settings as { zonesFixture?: unknown }).zonesFixture ??
                fixtureByCategory.get(category.id) ??
                null,
            }
          : {
              zonesFixture: fixtureByCategory.get(category.id) ?? null,
              zonesMatchFormat: "ONE_SET_6",
              zonesMatchDurationMin: 75,
              knockoutMatchFormat: "TWO_SETS_STB",
              knockoutMatchDurationMin: 90,
              finalMatchFormat: "BEST_OF_3",
              finalMatchDurationMin: 120,
              finalStartsAtRound: "SEMI_FINALS",
              intervalMin: 0,
              pairsPerZone: 3,
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
      select: { id: true },
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

    await prisma.$transaction([
      prisma.tournament.update({
        where: { id: tournamentId },
        data: { courtCount: input.courtCount },
      }),
      prisma.tournamentPlayDay.deleteMany({ where: { tournamentId } }),
      prisma.tournamentPlayDay.createMany({
        data: input.playDays.map((d) => ({
          tournamentId,
          date: toDbDate(d.date),
          startTime: d.startTime,
          endTime: d.endTime,
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
            zonesPlayDates: category.phases.zones.playDates,
            knockoutPlayDates: category.phases.knockout.playDates,
            finalPlayDates: category.phases.final.playDates,
          },
        }),
      ),
    ]);

    return { ok: true };
  }
}
