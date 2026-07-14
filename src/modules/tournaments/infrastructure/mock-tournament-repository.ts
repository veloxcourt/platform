import type {
  TournamentRepository,
  MutationResult,
} from "../application/tournament-repository";
import type { AddPairValues, UpdatePairValues } from "../domain/pair-schema";
import { derivePairPaymentStatus } from "../domain/pair-payment";
import { derivePairRegistrationStatus } from "../domain/pair-confirmation";
import type { CreateCategoryValues } from "../domain/category-schema";
import type { UpdateCategorySimulationValues } from "../domain/category-simulation-schema";
import { buildCategoryName } from "../domain/category-schema";
import type { TournamentConfigValues } from "../domain/config-schema";
import { defaultPhaseConfigs, defaultPlayDays } from "../domain/config-defaults";
import type {
  CreateTournamentValues,
  UpdateTournamentValues,
} from "../domain/tournament-schema";
import { buildTournamentPublicSlug } from "../domain/slug";
import type {
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
import { buildZonesFixture } from "../domain/build-zones-fixture";
import { toPersistedZonesFixture } from "../domain/zones-fixture-schema";
import type { TournamentType } from "../domain/tournament-types";
import type {
  TogglePairSlotValues,
  ReplacePairSlotPreferencesValues,
} from "../domain/slot-reservation-schema";
import {
  buildCategoryZonesGrid,
  estimateIntermediateMatches,
  findPreferenceSlotInRules,
} from "../domain/zones-slot-registration";
import type { SlotReservationRef } from "../domain/court-day-slots";
import { listSelectablePreferenceSlots } from "../domain/court-day-slots";

const DEMO_PLAYERS: Record<string, string> = {
  "demo-p1": "Martín Pérez",
  "demo-p2": "Lucía Gómez",
  "demo-p3": "Diego Fernández",
  "demo-p4": "Sofía Ramírez",
  "demo-p5": "Nicolás Torres",
  "demo-p6": "Valentina Ruiz",
};

const DEFAULT_LEVELS = ["1ra", "2da", "3ra", "4ta", "5ta", "6ta", "7ma", "8va"];

interface ClubRecord {
  club: { id: string; name: string; slug: string; currency: string };
  tournaments: TournamentListItem[];
  categories: Map<string, TournamentCategoryItem[]>;
  pairs: Map<string, PairListItem[]>;
  configs: Map<string, TournamentConfig>;
  slotReservations: Map<string, SlotReservationItem[]>;
}

const store = new Map<string, ClubRecord>();

function ensureClub(slug: string): ClubRecord {
  let record = store.get(slug);
  if (!record) {
    record = {
      club: {
        id: `club-${slug}`,
        name: slug === "club-demo" ? "Club Demo Pádel" : slug,
        slug,
        currency: "ARS",
      },
      tournaments: slug === "club-demo" ? demoTournaments() : [],
      categories: slug === "club-demo" ? demoCategories() : new Map(),
      pairs: slug === "club-demo" ? demoPairs() : new Map(),
      configs: slug === "club-demo" ? demoConfigs() : new Map(),
      slotReservations: new Map(),
    };
    store.set(slug, record);
  }
  if (!record.slotReservations) {
    record.slotReservations = new Map();
  }
  return record;
}

function demoTournaments(): TournamentListItem[] {
  return [
    {
      id: "demo-t1",
      type: "ZONAS",
      name: "Torneo de Verano 2026",
      description: "Femenina y masculina · formato zonas",
      status: "OPEN",
      startDate: "2026-02-14",
      endDate: "2026-02-16",
      fee: 2500000,
      publicSlug: "torneo-verano-2026",
      registrationCount: 3,
      confirmedCount: 2,
    },
    {
      id: "demo-t2",
      type: "AMERICANO",
      name: "Copa Invierno",
      description: null,
      status: "DRAFT",
      startDate: "2026-07-20",
      endDate: null,
      fee: 0,
      publicSlug: "copa-invierno-demo",
      registrationCount: 0,
      confirmedCount: 0,
    },
  ];
}

function demoCategories(): Map<string, TournamentCategoryItem[]> {
  return new Map([
    [
      "demo-t1",
      [
        {
          id: "demo-cat-f5",
          name: "Femenina 5ta",
          pairCount: 3,
          confirmedCount: 2,
          withoutPartnerCount: 1,
          withoutZoneCount: 1,
          simulationEnabled: false,
          simulationConfirmedCount: null,
        },
        {
          id: "demo-cat-m4",
          name: "Masculina 4ta",
          pairCount: 1,
          confirmedCount: 0,
          withoutPartnerCount: 0,
          withoutZoneCount: 1,
          simulationEnabled: false,
          simulationConfirmedCount: null,
        },
      ],
    ],
  ]);
}

function demoPairs(): Map<string, PairListItem[]> {
  const pairs: PairListItem[] = [
    {
      id: "demo-pair-1",
      player1: { id: "demo-p1", name: "Martín Pérez" },
      player2: { id: "demo-p2", name: "Lucía Gómez" },
      categoryId: "demo-cat-f5",
      categoryName: "Femenina 5ta",
      zoneLabel: "Zona A",
      zonesDayPreference: "ANY" as const,
      status: "CONFIRMED",
      player1Confirmed: true,
      player2Confirmed: true,
      player1PaymentStatus: "PAID",
      player2PaymentStatus: "PAID",
      paymentStatus: "PAID",
      createdAt: "2026-01-10T12:00:00.000Z",
    },
    {
      id: "demo-pair-2",
      player1: { id: "demo-p3", name: "Diego Fernández" },
      player2: { id: "demo-p4", name: "Sofía Ramírez" },
      categoryId: "demo-cat-f5",
      categoryName: "Femenina 5ta",
      zoneLabel: "Zona A",
      zonesDayPreference: "ANY" as const,
      status: "CONFIRMED",
      player1Confirmed: true,
      player2Confirmed: true,
      player1PaymentStatus: "PAID",
      player2PaymentStatus: "PAID",
      paymentStatus: "PAID",
      createdAt: "2026-01-11T12:00:00.000Z",
    },
    {
      id: "demo-pair-3",
      player1: { id: "demo-p4", name: "Sofía Ramírez" },
      player2: { id: "demo-p5", name: "Nicolás Torres" },
      categoryId: "demo-cat-m4",
      categoryName: "Masculina 4ta",
      zoneLabel: null,
      zonesDayPreference: "ANY" as const,
      status: "PENDING",
      player1Confirmed: false,
      player2Confirmed: false,
      player1PaymentStatus: "UNPAID",
      player2PaymentStatus: "UNPAID",
      paymentStatus: "UNPAID",
      createdAt: "2026-01-12T12:00:00.000Z",
    },
    {
      id: "demo-pair-4",
      player1: { id: "demo-p6", name: "Valentina Ruiz" },
      player2: null,
      categoryId: "demo-cat-f5",
      categoryName: "Femenina 5ta",
      zoneLabel: null,
      zonesDayPreference: "ANY" as const,
      status: "PENDING",
      player1Confirmed: true,
      player2Confirmed: false,
      player1PaymentStatus: "PAID",
      player2PaymentStatus: "UNPAID",
      paymentStatus: "PAID",
      createdAt: "2026-01-13T12:00:00.000Z",
    },
  ];
  return new Map([["demo-t1", pairs]]);
}

function demoConfigs(): Map<string, TournamentConfig> {
  const defaults = defaultPhaseConfigs();
  const playDays = defaultPlayDays("2026-02-14", "2026-02-16");
  return new Map([
    [
      "demo-t1",
      {
        tournamentId: "demo-t1",
        tournamentName: "Torneo de Verano 2026",
        startDate: "2026-02-14",
        endDate: "2026-02-16",
        courtCount: 4,
        playDays,
        categories: [
          {
            categoryId: "demo-cat-f5",
            categoryName: "Femenina 5ta",
            phases: defaults,
            intervalMin: 0,
            pairsPerZone: 3,
            zonesFixture: null,
          },
          {
            categoryId: "demo-cat-m4",
            categoryName: "Masculina 4ta",
            phases: defaults,
            intervalMin: 0,
            pairsPerZone: 3,
            zonesFixture: null,
          },
        ],
      },
    ],
  ]);
}

function buildTournamentConfig(
  tournament: TournamentListItem,
  categories: TournamentCategoryItem[],
  stored?: TournamentConfig,
): TournamentConfig {
  const defaults = defaultPhaseConfigs();
  return {
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    startDate: tournament.startDate,
    endDate: tournament.endDate,
    courtCount: stored?.courtCount ?? 4,
    playDays:
      stored?.playDays ??
      defaultPlayDays(tournament.startDate, tournament.endDate),
    categories: categories.map((category) => {
      const saved = stored?.categories.find(
        (item) => item.categoryId === category.id,
      );
      return (
        saved ?? {
          categoryId: category.id,
          categoryName: category.name,
          phases: defaults,
          intervalMin: 0,
          pairsPerZone: 3,
          zonesFixture: null,
        }
      );
    }),
  };
}

function syncCategoryCounts(record: ClubRecord, tournamentId: string) {
  const categories = record.categories.get(tournamentId) ?? [];
  const pairs = (record.pairs.get(tournamentId) ?? []).filter(
    (p) => p.status !== "CANCELLED",
  );
  for (const category of categories) {
    const catPairs = pairs.filter((p) => p.categoryId === category.id);
    category.pairCount = catPairs.length;
    category.confirmedCount = catPairs.filter(
      (p) => p.status === "CONFIRMED",
    ).length;
    category.withoutPartnerCount = catPairs.filter((p) => !p.player2).length;
    category.withoutZoneCount = catPairs.filter((p) => !p.zoneLabel).length;
  }
}

function syncTournamentCounts(record: ClubRecord, tournamentId: string) {
  const tournament = record.tournaments.find((t) => t.id === tournamentId);
  const pairs = record.pairs.get(tournamentId) ?? [];
  if (!tournament) return;
  tournament.registrationCount = pairs.filter((p) => p.status !== "CANCELLED")
    .length;
  tournament.confirmedCount = pairs.filter((p) => p.status === "CONFIRMED")
    .length;
  syncCategoryCounts(record, tournamentId);
}

function playerName(id: string): string {
  return DEMO_PLAYERS[id] ?? `Jugador ${id.slice(-4)}`;
}

function pairUsesPlayer(pair: PairListItem, userId: string): boolean {
  return pair.player1.id === userId || pair.player2?.id === userId;
}

export class MockTournamentRepository implements TournamentRepository {
  async getClubBySlug(slug: string) {
    return ensureClub(slug).club;
  }

  async getClubLevels(clubId: string) {
    for (const record of store.values()) {
      if (record.club.id === clubId) return [...DEFAULT_LEVELS];
    }
    return DEFAULT_LEVELS;
  }

  async listTournaments(clubId: string): Promise<TournamentListItem[]> {
    for (const record of store.values()) {
      if (record.club.id === clubId) {
        return [...record.tournaments].sort((a, b) =>
          b.startDate.localeCompare(a.startDate),
        );
      }
    }
    return [];
  }

  async getZonasTournamentDetail(
    clubId: string,
    tournamentId: string,
  ): Promise<ZonasTournamentDetail | null> {
    for (const record of store.values()) {
      if (record.club.id !== clubId) continue;
      const tournament = record.tournaments.find((t) => t.id === tournamentId);
      if (!tournament || tournament.type !== "ZONAS") return null;
      const pairs = [...(record.pairs.get(tournamentId) ?? [])]
        .filter((p) => p.status !== "CANCELLED")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const categories = [...(record.categories.get(tournamentId) ?? [])];
      return {
        id: tournament.id,
        type: "ZONAS",
        name: tournament.name,
        description: tournament.description,
        status: tournament.status,
        startDate: tournament.startDate,
        endDate: tournament.endDate,
        fee: tournament.fee,
        publicSlug: tournament.publicSlug,
        categories,
        pairs,
        slotReservations: [
          ...(record.slotReservations.get(tournamentId) ?? []),
        ].filter((r) => pairs.some((p) => p.id === r.pairId)),
      };
    }
    return null;
  }

  async listTournamentCategories(
    clubId: string,
    tournamentId: string,
  ): Promise<TournamentCategoryItem[] | null> {
    for (const record of store.values()) {
      if (record.club.id !== clubId) continue;
      const tournament = record.tournaments.find((t) => t.id === tournamentId);
      if (!tournament || tournament.type !== "ZONAS") return null;
      return [...(record.categories.get(tournamentId) ?? [])];
    }
    return null;
  }

  async createTournamentCategory(
    clubId: string,
    tournamentId: string,
    input: CreateCategoryValues,
  ): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
    for (const record of store.values()) {
      if (record.club.id !== clubId) continue;
      const tournament = record.tournaments.find((t) => t.id === tournamentId);
      if (!tournament || tournament.type !== "ZONAS") {
        return { ok: false, error: "Torneo no encontrado" };
      }

      const name = buildCategoryName(input.gender, input.level);
      const categories = record.categories.get(tournamentId) ?? [];
      if (categories.some((c) => c.name === name)) {
        return { ok: false, error: "Ya existe una categoría con ese nombre" };
      }

      const id = `cat-${Date.now()}`;
      const category: TournamentCategoryItem = {
        id,
        name,
        pairCount: 0,
        confirmedCount: 0,
        withoutPartnerCount: 0,
        withoutZoneCount: 0,
        simulationEnabled: false,
        simulationConfirmedCount: null,
      };
      categories.push(category);
      record.categories.set(tournamentId, categories);
      return { ok: true, id };
    }
    return { ok: false, error: "Club no encontrado" };
  }

  async updateCategorySimulation(
    clubId: string,
    tournamentId: string,
    categoryId: string,
    input: UpdateCategorySimulationValues,
  ): Promise<MutationResult> {
    for (const record of store.values()) {
      if (record.club.id !== clubId) continue;
      const categories = record.categories.get(tournamentId) ?? [];
      const category = categories.find((c) => c.id === categoryId);
      if (!category) return { ok: false, error: "Categoría no encontrada" };
      category.simulationEnabled = input.simulationEnabled;
      category.simulationConfirmedCount = input.simulationConfirmedCount;
      return { ok: true };
    }
    return { ok: false, error: "Categoría no encontrada" };
  }

  async createTournament(
    clubId: string,
    input: CreateTournamentValues,
  ): Promise<{ id: string }> {
    for (const record of store.values()) {
      if (record.club.id !== clubId) continue;

      const id = `t-${Date.now()}`;
      const item: TournamentListItem = {
        id,
        type: input.type as TournamentType,
        name: input.name,
        description: input.description || null,
        status: input.status as TournamentStatus,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        fee: input.fee,
        publicSlug: buildTournamentPublicSlug(input.name),
        registrationCount: 0,
        confirmedCount: 0,
      };
      record.tournaments.unshift(item);
      record.pairs.set(id, []);
      record.categories.set(id, []);
      return { id };
    }
    throw new Error("Club no encontrado");
  }

  async updateTournament(
    clubId: string,
    tournamentId: string,
    input: UpdateTournamentValues,
  ): Promise<MutationResult> {
    for (const record of store.values()) {
      if (record.club.id !== clubId) continue;
      const tournament = record.tournaments.find((t) => t.id === tournamentId);
      if (!tournament) return { ok: false, error: "Torneo no encontrado" };
      tournament.name = input.name;
      tournament.description = input.description || null;
      tournament.status = input.status as TournamentStatus;
      tournament.startDate = input.startDate;
      tournament.endDate = input.endDate ?? null;
      tournament.fee = input.fee;
      return { ok: true };
    }
    return { ok: false, error: "Club no encontrado" };
  }

  async addPair(
    clubId: string,
    tournamentId: string,
    input: AddPairValues,
  ): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
    for (const record of store.values()) {
      if (record.club.id !== clubId) continue;
      const tournament = record.tournaments.find((t) => t.id === tournamentId);
      if (!tournament || tournament.type !== "ZONAS") {
        return { ok: false, error: "Torneo no encontrado" };
      }

      const category = (record.categories.get(tournamentId) ?? []).find(
        (c) => c.id === input.categoryId,
      );
      if (!category) {
        return { ok: false, error: "Categoría del torneo no encontrada" };
      }

      const pairs = record.pairs.get(tournamentId) ?? [];
      const player2Id = input.player2Id ?? null;
      const active = pairs.filter((p) => p.status !== "CANCELLED");
      if (
        active.some(
          (p) =>
            pairUsesPlayer(p, input.player1Id) ||
            (player2Id ? pairUsesPlayer(p, player2Id) : false),
        )
      ) {
        return {
          ok: false,
          error: "Uno de los jugadores ya está inscripto en otra pareja",
        };
      }

      const pair: PairListItem = {
        id: `pair-${Date.now()}`,
        player1: { id: input.player1Id, name: playerName(input.player1Id) },
        player2: player2Id
          ? { id: player2Id, name: playerName(player2Id) }
          : null,
        categoryId: category.id,
        categoryName: category.name,
        zoneLabel: null,
        zonesDayPreference: "ANY",
        status: "PENDING",
        player1Confirmed: false,
        player2Confirmed: false,
        player1PaymentStatus: "UNPAID",
        player2PaymentStatus: "UNPAID",
        paymentStatus: "UNPAID",
        createdAt: new Date().toISOString(),
      };
      pairs.push(pair);
      record.pairs.set(tournamentId, pairs);
      syncTournamentCounts(record, tournamentId);
      return { ok: true, id: pair.id };
    }
    return { ok: false, error: "Club no encontrado" };
  }

  async updatePair(
    clubId: string,
    tournamentId: string,
    pairId: string,
    input: UpdatePairValues,
  ): Promise<MutationResult> {
    for (const record of store.values()) {
      if (record.club.id !== clubId) continue;
      const categories = record.categories.get(tournamentId) ?? [];
      const category = categories.find((c) => c.id === input.categoryId);
      if (!category) {
        return { ok: false, error: "Categoría del torneo no encontrada" };
      }

      const pairs = record.pairs.get(tournamentId) ?? [];
      const pair = pairs.find((p) => p.id === pairId);
      if (!pair) return { ok: false, error: "Pareja no encontrada" };

      const player2Id = input.player2Id ?? null;
      const busy = pairs.some(
        (p) =>
          p.id !== pairId &&
          p.status !== "CANCELLED" &&
          (pairUsesPlayer(p, input.player1Id) ||
            (player2Id ? pairUsesPlayer(p, player2Id) : false)),
      );
      if (busy) {
        return {
          ok: false,
          error: "Uno de los jugadores ya está inscripto en otra pareja",
        };
      }

      const player2Changed = pair.player2?.id !== player2Id;
      pair.player1 = { id: input.player1Id, name: playerName(input.player1Id) };
      pair.player2 = player2Id
        ? { id: player2Id, name: playerName(player2Id) }
        : null;
      pair.categoryId = category.id;
      pair.categoryName = category.name;
      if (player2Changed || !player2Id) {
        pair.player2Confirmed = false;
        pair.player2PaymentStatus = "UNPAID";
      }
      pair.status = derivePairRegistrationStatus(
        pair.status,
        player2Id,
        pair.player1Confirmed,
        pair.player2Confirmed,
      );
      pair.paymentStatus = derivePairPaymentStatus(
        pair.player1PaymentStatus,
        pair.player2PaymentStatus,
        player2Id !== null,
      );
      syncTournamentCounts(record, tournamentId);
      return { ok: true };
    }
    return { ok: false, error: "Pareja no encontrada" };
  }

  async updatePairStatus(
    clubId: string,
    pairId: string,
    status: RegistrationStatus,
  ): Promise<MutationResult> {
    for (const record of store.values()) {
      if (record.club.id !== clubId) continue;
      for (const [tournamentId, pairs] of record.pairs.entries()) {
        const pair = pairs.find((p) => p.id === pairId);
        if (!pair) continue;
        pair.status = status;
        if (status === "CANCELLED") {
          const slots = record.slotReservations.get(tournamentId) ?? [];
          record.slotReservations.set(
            tournamentId,
            slots.filter((s) => s.pairId !== pairId),
          );
        }
        syncTournamentCounts(record, tournamentId);
        return { ok: true };
      }
    }
    return { ok: false, error: "Pareja no encontrada" };
  }

  async updatePairPlayerPayment(
    clubId: string,
    pairId: string,
    slot: 1 | 2,
    paymentStatus: PaymentStatus,
  ): Promise<MutationResult> {
    for (const record of store.values()) {
      if (record.club.id !== clubId) continue;
      for (const [tournamentId, pairs] of record.pairs.entries()) {
        const pair = pairs.find((p) => p.id === pairId);
        if (!pair) continue;
        if (slot === 2 && !pair.player2) {
          return { ok: false, error: "La inscripción no tiene compañero" };
        }

        const player1PaymentStatus =
          slot === 1 ? paymentStatus : pair.player1PaymentStatus;
        const player2PaymentStatus =
          slot === 2 ? paymentStatus : pair.player2PaymentStatus;

        pair.player1PaymentStatus = player1PaymentStatus;
        pair.player2PaymentStatus = player2PaymentStatus;
        pair.paymentStatus = derivePairPaymentStatus(
          player1PaymentStatus,
          player2PaymentStatus,
          pair.player2 !== null,
        );
        syncTournamentCounts(record, tournamentId);
        return { ok: true };
      }
    }
    return { ok: false, error: "Pareja no encontrada" };
  }

  async updatePairPlayerConfirmation(
    clubId: string,
    pairId: string,
    slot: 1 | 2,
    confirmed: boolean,
  ): Promise<MutationResult> {
    for (const record of store.values()) {
      if (record.club.id !== clubId) continue;
      for (const [tournamentId, pairs] of record.pairs.entries()) {
        const pair = pairs.find((p) => p.id === pairId);
        if (!pair) continue;
        if (slot === 2 && !pair.player2) {
          return { ok: false, error: "La inscripción no tiene compañero" };
        }

        if (slot === 1) pair.player1Confirmed = confirmed;
        if (slot === 2) pair.player2Confirmed = confirmed;

        pair.status = derivePairRegistrationStatus(
          pair.status,
          pair.player2?.id ?? null,
          pair.player1Confirmed,
          pair.player2Confirmed,
        );
        syncTournamentCounts(record, tournamentId);
        return { ok: true };
      }
    }
    return { ok: false, error: "Pareja no encontrada" };
  }

  private patchPair(
    clubId: string,
    pairId: string,
    patch: Partial<Pick<PairListItem, "status">>,
  ): MutationResult {
    for (const record of store.values()) {
      if (record.club.id !== clubId) continue;
      for (const [tournamentId, pairs] of record.pairs.entries()) {
        const pair = pairs.find((p) => p.id === pairId);
        if (!pair) continue;
        Object.assign(pair, patch);
        syncTournamentCounts(record, tournamentId);
        return { ok: true };
      }
    }
    return { ok: false, error: "Pareja no encontrada" };
  }

  async updatePairZonesDayPreference(
    clubId: string,
    tournamentId: string,
    pairId: string,
    zonesDayPreference: "SAME_DAY" | "DIFFERENT_DAYS" | "ANY",
  ): Promise<MutationResult> {
    for (const record of store.values()) {
      if (record.club.id !== clubId) continue;
      const pairs = record.pairs.get(tournamentId) ?? [];
      const pair = pairs.find(
        (p) => p.id === pairId && p.status !== "CANCELLED",
      );
      if (!pair) continue;
      pair.zonesDayPreference = zonesDayPreference;
      return { ok: true };
    }
    return { ok: false, error: "Pareja no encontrada" };
  }

  async listSlotReservations(
    clubId: string,
    tournamentId: string,
  ): Promise<SlotReservationItem[]> {
    for (const record of store.values()) {
      if (record.club.id !== clubId) continue;
      return [...(record.slotReservations.get(tournamentId) ?? [])];
    }
    return [];
  }

  async togglePairSlotReservation(
    clubId: string,
    tournamentId: string,
    pairId: string,
    input: TogglePairSlotValues,
  ): Promise<MutationResult> {
    for (const record of store.values()) {
      if (record.club.id !== clubId) continue;
      const pairs = record.pairs.get(tournamentId) ?? [];
      const pair = pairs.find(
        (p) => p.id === pairId && p.status !== "CANCELLED",
      );
      if (!pair) return { ok: false, error: "Pareja no encontrada" };

      const config = record.configs.get(tournamentId);
      if (!config) {
        return {
          ok: false,
          error: "Configurá el torneo antes de elegir horarios",
        };
      }
      const categoryConfig = config.categories.find(
        (c) => c.categoryId === pair.categoryId,
      );
      if (!categoryConfig) {
        return { ok: false, error: "Categoría sin configuración" };
      }

      const existing = record.slotReservations.get(tournamentId) ?? [];
      const mineOnSlot = existing.find(
        (r) =>
          r.pairId === pairId &&
          r.playDate === input.playDate &&
          r.slotIndex === input.slotIndex,
      );
      if (mineOnSlot) {
        record.slotReservations.set(
          tournamentId,
          existing.filter(
            (r) =>
              !(
                r.pairId === pairId &&
                r.playDate === input.playDate &&
                r.slotIndex === input.slotIndex
              ),
          ),
        );
        return { ok: true };
      }

      const cats = record.categories.get(tournamentId) ?? [];
      const category = cats.find((c) => c.id === pair.categoryId);
      const confirmedPairsForEstimate =
        category?.simulationConfirmedCount ??
        category?.confirmedCount ??
        8;

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
        const catMeta = cats.find((c) => c.id === catCfg.categoryId);
        const n =
          catCfg.categoryId === pair.categoryId
            ? confirmedPairsForEstimate
            : (catMeta?.simulationConfirmedCount ??
              catMeta?.confirmedCount ??
              0);
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

      const pairLabel = pair.player2
        ? `${pair.player1.name} / ${pair.player2.name}`
        : pair.player1.name;
      existing.push({
        id: `slot-${Date.now()}`,
        tournamentId,
        categoryId: pair.categoryId,
        pairId,
        pairLabel,
        playDate: input.playDate,
        courtIndex: 0,
        slotIndex: input.slotIndex,
        startTime: input.startTime,
        endTime: input.endTime,
        phase: "zones",
      });
      record.slotReservations.set(tournamentId, existing);
      return { ok: true };
    }
    return { ok: false, error: "Club no encontrado" };
  }

  async replacePairSlotPreferences(
    clubId: string,
    tournamentId: string,
    pairId: string,
    input: ReplacePairSlotPreferencesValues,
  ): Promise<MutationResult> {
    for (const record of store.values()) {
      if (record.club.id !== clubId) continue;
      const pairs = record.pairs.get(tournamentId) ?? [];
      const pair = pairs.find(
        (p) => p.id === pairId && p.status !== "CANCELLED",
      );
      if (!pair) return { ok: false, error: "Pareja no encontrada" };

      const config = record.configs.get(tournamentId);
      if (!config) {
        return {
          ok: false,
          error: "Configurá el torneo antes de elegir horarios",
        };
      }
      const categoryConfig = config.categories.find(
        (c) => c.categoryId === pair.categoryId,
      );
      if (!categoryConfig) {
        return { ok: false, error: "Categoría sin configuración" };
      }

      const cats = record.categories.get(tournamentId) ?? [];
      const category = cats.find((c) => c.id === pair.categoryId);
      const confirmedPairsForEstimate =
        category?.simulationConfirmedCount ??
        category?.confirmedCount ??
        8;

      let intermediateMatches = 0;
      for (const catCfg of config.categories) {
        const catMeta = cats.find((c) => c.id === catCfg.categoryId);
        const n =
          catCfg.categoryId === pair.categoryId
            ? confirmedPairsForEstimate
            : (catMeta?.simulationConfirmedCount ??
              catMeta?.confirmedCount ??
              0);
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
        if (!selectable.has(`${slot.playDate}:${slot.slotIndex}`)) {
          return { ok: false, error: "Uno o más horarios no están disponibles" };
        }
      }

      const existing = record.slotReservations.get(tournamentId) ?? [];
      const remaining = existing.filter((r) => r.pairId !== pairId);
      const pairLabel = pair.player2
        ? `${pair.player1.name} / ${pair.player2.name}`
        : pair.player1.name;

      const created = [...uniqueSlots.values()].map((slot, index) => ({
        id: `slot-bulk-${Date.now()}-${index}`,
        tournamentId,
        categoryId: pair.categoryId,
        pairId,
        pairLabel,
        playDate: slot.playDate,
        courtIndex: 0,
        slotIndex: slot.slotIndex,
        startTime: slot.startTime,
        endTime: slot.endTime,
        phase: "zones" as const,
      }));

      record.slotReservations.set(tournamentId, [...remaining, ...created]);
      return { ok: true };
    }
    return { ok: false, error: "Club no encontrado" };
  }

  async buildAndSaveZonesFixture(
    clubId: string,
    tournamentId: string,
    categoryId: string,
  ): Promise<
    | { ok: true; fixture: import("../domain/zones-fixture-schema").ZonesFixturePersisted }
    | { ok: false; error: string }
  > {
    for (const record of store.values()) {
      if (record.club.id !== clubId) continue;
      const tournament = record.tournaments.find((t) => t.id === tournamentId);
      if (!tournament || tournament.type !== "ZONAS") {
        return { ok: false, error: "Torneo no encontrado" };
      }
      const categories = record.categories.get(tournamentId) ?? [];
      if (!categories.some((c) => c.id === categoryId)) {
        return { ok: false, error: "Categoría no encontrada" };
      }

      const config =
        record.configs.get(tournamentId) ??
        buildTournamentConfig(tournament, categories);
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

      const pairs = (record.pairs.get(tournamentId) ?? []).filter(
        (p) =>
          p.categoryId === categoryId &&
          p.status !== "CANCELLED" &&
          Boolean(p.player2),
      );
      if (pairs.length === 0) {
        return {
          ok: false,
          error: "No hay parejas con compañero para armar zonas",
        };
      }

      const reservations = (record.slotReservations.get(tournamentId) ?? []).filter(
        (r) => r.categoryId === categoryId,
      );

      const fixturePairs = pairs.map((pair) => ({
        id: pair.id,
        zonesDayPreference: pair.zonesDayPreference,
        preferences: reservations
          .filter((r) => r.pairId === pair.id)
          .map((r) => ({
            playDate: r.playDate,
            slotIndex: r.slotIndex,
            startTime: r.startTime,
            endTime: r.endTime,
          })),
      }));

      const slotMinutes =
        categoryConfig.phases.zones.matchDurationMin +
        categoryConfig.intervalMin;

      const result = buildZonesFixture({
        pairs: fixturePairs,
        pairsPerZone: categoryConfig.pairsPerZone || 3,
        playDays: config.playDays,
        zonesPlayDates: categoryConfig.phases.zones.playDates,
        courtCount: Math.max(1, config.courtCount || 1),
        slotMinutes: Math.max(1, slotMinutes),
      });

      const persisted = toPersistedZonesFixture(result);

      for (const pair of record.pairs.get(tournamentId) ?? []) {
        if (pair.categoryId === categoryId) pair.zoneLabel = null;
      }
      for (const zone of persisted.zones) {
        for (const pairId of zone.pairIds) {
          const pair = (record.pairs.get(tournamentId) ?? []).find(
            (p) => p.id === pairId,
          );
          if (pair) pair.zoneLabel = zone.label;
        }
      }

      const nextCategories = config.categories.map((c) =>
        c.categoryId === categoryId ? { ...c, zonesFixture: persisted } : c,
      );
      record.configs.set(tournamentId, { ...config, categories: nextCategories });
      syncCategoryCounts(record, tournamentId);
      return { ok: true, fixture: persisted };
    }
    return { ok: false, error: "Club no encontrado" };
  }

  async getTournamentConfig(
    clubId: string,
    tournamentId: string,
  ): Promise<TournamentConfig | null> {
    for (const record of store.values()) {
      if (record.club.id !== clubId) continue;
      const tournament = record.tournaments.find((t) => t.id === tournamentId);
      if (!tournament || tournament.type !== "ZONAS") return null;
      const categories = record.categories.get(tournamentId) ?? [];
      const stored = record.configs.get(tournamentId);
      return buildTournamentConfig(tournament, categories, stored);
    }
    return null;
  }

  async saveTournamentConfig(
    clubId: string,
    tournamentId: string,
    input: TournamentConfigValues,
  ): Promise<MutationResult> {
    for (const record of store.values()) {
      if (record.club.id !== clubId) continue;
      const tournament = record.tournaments.find((t) => t.id === tournamentId);
      if (!tournament || tournament.type !== "ZONAS") {
        return { ok: false, error: "Torneo no encontrado" };
      }
      const categories = record.categories.get(tournamentId) ?? [];
      const previous = record.configs.get(tournamentId);
      const categoryConfigs = input.categories.map((category) => {
        const meta = categories.find((item) => item.id === category.categoryId);
        return {
          categoryId: category.categoryId,
          categoryName: meta?.name ?? "Categoría",
          phases: category.phases,
          intervalMin: category.intervalMin,
          pairsPerZone: category.pairsPerZone,
          zonesFixture:
            previous?.categories.find(
              (c) => c.categoryId === category.categoryId,
            )?.zonesFixture ?? null,
        };
      });
      record.configs.set(tournamentId, {
        tournamentId,
        tournamentName: tournament.name,
        startDate: tournament.startDate,
        endDate: tournament.endDate,
        courtCount: input.courtCount,
        playDays: input.playDays,
        categories: categoryConfigs,
      });
      return { ok: true };
    }
    return { ok: false, error: "Club no encontrado" };
  }
}
