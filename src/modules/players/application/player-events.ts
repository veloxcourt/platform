import type { Prisma } from "@prisma/client";

import { ensureRuntimeSchema, prisma } from "@/lib/prisma";
import {
  normalizeCategoryLabel,
  normalizeCategoryLevel,
} from "@/modules/tournaments/domain/category-level";
import type { MatchFormat } from "@/modules/tournaments/domain/config-schema";
import { parseIntermediateFixture } from "@/modules/tournaments/domain/intermediate-fixture-schema";
import {
  buildZoneQualification,
  furthestRoundLabelForPair,
} from "@/modules/tournaments/domain/zone-qualification";
import { parseZonesFixture } from "@/modules/tournaments/domain/zones-fixture-schema";

import {
  isTournamentRound,
  parseEventDate,
  tournamentRoundRank,
  type CategoryChangeData,
  type CreatePlayerEventInput,
  type LinkedTournament,
  type PlayerInscriptionOption,
  type PlayedTournamentOption,
  type PlayerEventItem,
  type TournamentParticipationData,
  type TournamentRound,
} from "../domain/player-event";

export type PlayerEventsResult =
  | { ok: true; events: PlayerEventItem[] }
  | { ok: false; error: string };

export type CreatePlayerEventResult = { ok: true } | { ok: false; error: string };

export type PlayedTournamentsResult =
  | {
      ok: true;
      tournaments: PlayedTournamentOption[];
      inscriptions: PlayerInscriptionOption[];
    }
  | { ok: false; error: string };

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function toCategoryChangeData(
  data: Extract<CreatePlayerEventInput, { type: "CATEGORY_CHANGE" }>["data"],
  linkedTournament: LinkedTournament | null,
): CategoryChangeData | { error: string } {
  const previous = blankToNull(data.previousCategory);
  const next = normalizeCategoryLevel(data.newCategory);
  const previousNormalized = previous ? normalizeCategoryLevel(previous) : null;
  if (previousNormalized && previousNormalized === next) {
    return {
      error: "La categoría nueva tiene que ser distinta de la anterior",
    };
  }
  return {
    previousCategory: previousNormalized,
    newCategory: next,
    linkedTournament,
  };
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase("es");
}

function readLinkedTournament(value: unknown): LinkedTournament | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.name !== "string" || !record.name.trim()) return null;
  return {
    tournamentId:
      typeof record.tournamentId === "string" && record.tournamentId.trim()
        ? record.tournamentId
        : null,
    eventId:
      typeof record.eventId === "string" && record.eventId.trim()
        ? record.eventId
        : null,
    name: record.name,
  };
}

function parseLinkKey(
  key: string | undefined,
): { kind: "t" | "e"; id: string } | null | { error: string } {
  const trimmed = key?.trim() ?? "";
  if (!trimmed) return null;
  const match = /^(t|e):([a-z0-9]+)$/i.exec(trimmed);
  if (!match) return { error: "El torneo vinculado no es válido" };
  return { kind: match[1].toLowerCase() as "t" | "e", id: match[2] };
}

async function resolveLinkedTournament(
  clubId: string,
  playerId: string,
  key: string | undefined,
): Promise<LinkedTournament | null | { error: string }> {
  const parsed = parseLinkKey(key);
  if (!parsed || "error" in parsed) return parsed;

  if (parsed.kind === "t") {
    const pair = await prisma.tournamentPair.findFirst({
      where: {
        tournamentId: parsed.id,
        status: { not: "CANCELLED" },
        tournament: { clubId },
        OR: [{ player1Id: playerId }, { player2Id: playerId }],
      },
      select: { tournament: { select: { id: true, name: true } } },
    });
    if (!pair) {
      return { error: "Ese torneo no figura como jugado por este jugador" };
    }
    return {
      tournamentId: pair.tournament.id,
      eventId: null,
      name: pair.tournament.name.trim(),
    };
  }

  const event = await prisma.playerEvent.findFirst({
    where: {
      id: parsed.id,
      clubId,
      playerId,
      type: "TOURNAMENT",
    },
    select: { id: true, data: true },
  });
  const data = event?.data;
  const name =
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    typeof data.tournamentName === "string"
      ? data.tournamentName.trim()
      : "";
  if (!event || !name) {
    return { error: "Ese torneo no figura como jugado por este jugador" };
  }
  return { tournamentId: null, eventId: event.id, name };
}

export async function listPlayedTournaments(
  clubId: string,
  playerId: string,
): Promise<PlayedTournamentsResult> {
  await ensureRuntimeSchema();

  const belongs = await prisma.membership.findFirst({
    where: { clubId, userId: playerId, role: "PLAYER" },
    select: { id: true },
  });
  if (!belongs) return { ok: false, error: "Jugador no encontrado" };

  const pairs = await prisma.tournamentPair.findMany({
      where: {
        status: { not: "CANCELLED" },
        tournament: { clubId },
        OR: [{ player1Id: playerId }, { player2Id: playerId }],
      },
      select: {
        player1Id: true,
        player2: { select: { fullName: true } },
        player1: { select: { fullName: true } },
        category: {
          select: {
            id: true,
            name: true,
            catalogCategory: { select: { name: true } },
          },
        },
        tournament: { select: { id: true, name: true, startDate: true } },
      },
    });
  let events: Array<{ id: string; occurredOn: Date; data: Prisma.JsonValue }> =
    [];
  try {
    events = await prisma.playerEvent.findMany({
      where: { clubId, playerId, type: "TOURNAMENT" },
      select: { id: true, occurredOn: true, data: true },
    });
  } catch (error) {
    console.error("[player-events] no se pudieron leer sucesos de torneo", error);
  }

  const byTournament = new Map<string, PlayedTournamentOption>();
  const inscriptions: PlayerInscriptionOption[] = [];
  for (const pair of pairs) {
    const name = pair.tournament.name.trim();
    if (!name) continue;
    const date = dateOnly(pair.tournament.startDate);
    if (!byTournament.has(pair.tournament.id)) {
      byTournament.set(pair.tournament.id, {
        key: `t:${pair.tournament.id}`,
        name,
        date,
      });
    }
    const categoryName = normalizeCategoryLabel(
      pair.category.catalogCategory?.name ?? pair.category.name,
    );
    const partner =
      pair.player1Id === playerId ? pair.player2?.fullName : pair.player1.fullName;
    inscriptions.push({
      key: `t:${pair.tournament.id}:${pair.category.id}`,
      name,
      date,
      categoryName,
      partnerName: partner?.trim() || null,
    });
  }

  const tournamentNames = new Set(
    [...byTournament.values()].map((item) => normalizeName(item.name)),
  );
  const options = [...byTournament.values()];

  for (const event of events) {
    const data = event.data;
    const name =
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      typeof data.tournamentName === "string"
        ? data.tournamentName.trim()
        : "";
    if (!name || tournamentNames.has(normalizeName(name))) continue;
    options.push({
      key: `e:${event.id}`,
      name,
      date: dateOnly(event.occurredOn),
    });
  }

  options.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name, "es"));
  inscriptions.sort(
    (a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name, "es"),
  );
  return { ok: true, tournaments: options, inscriptions };
}

function toTournamentData(
  data: Extract<CreatePlayerEventInput, { type: "TOURNAMENT" }>["data"],
): TournamentParticipationData {
  return {
    tournamentName: data.tournamentName.trim(),
    category: normalizeCategoryLevel(data.category),
    roundReached: data.roundReached,
    partnerName: data.partnerName.trim(),
  };
}

function readEvent(row: {
  id: string;
  type: "CATEGORY_CHANGE" | "TOURNAMENT";
  occurredOn: Date;
  note: string | null;
  data: Prisma.JsonValue;
  createdByName: string;
  createdAt: Date;
}): PlayerEventItem | null {
  const base = {
    id: row.id,
    occurredOn: dateOnly(row.occurredOn),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    createdByName: row.createdByName,
  };
  const data = row.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  if (row.type === "CATEGORY_CHANGE") {
    const previousCategory =
      typeof data.previousCategory === "string" && data.previousCategory.trim()
        ? data.previousCategory
        : null;
    if (typeof data.newCategory !== "string" || !data.newCategory.trim()) {
      return null;
    }
    return {
      ...base,
      type: "CATEGORY_CHANGE",
      data: {
        previousCategory,
        newCategory: data.newCategory,
        linkedTournament: readLinkedTournament(data.linkedTournament),
      },
    };
  }

  if (
    typeof data.tournamentName !== "string" ||
    typeof data.category !== "string" ||
    typeof data.roundReached !== "string" ||
    typeof data.partnerName !== "string"
  ) {
    return null;
  }

  return {
    ...base,
    type: "TOURNAMENT",
    data: {
      tournamentName: data.tournamentName,
      category: data.category,
      roundReached: data.roundReached as TournamentRound,
      partnerName: data.partnerName,
    },
  };
}

export async function listPlayerEvents(
  clubId: string,
  playerId: string,
): Promise<PlayerEventsResult> {
  await ensureRuntimeSchema();

  const belongs = await prisma.membership.findFirst({
    where: { clubId, userId: playerId, role: "PLAYER" },
    select: { id: true },
  });
  if (!belongs) return { ok: false, error: "Jugador no encontrado" };

  const rows = await prisma.playerEvent.findMany({
    where: { clubId, playerId },
    orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
  });

  return {
    ok: true,
    events: rows.flatMap((row) => {
      const event = readEvent(row);
      return event ? [event] : [];
    }),
  };
}

export async function createPlayerEvent(
  clubId: string,
  playerId: string,
  createdById: string,
  createdByName: string,
  input: CreatePlayerEventInput,
): Promise<CreatePlayerEventResult> {
  await ensureRuntimeSchema();

  const occurredOn = parseEventDate(input.occurredOn);
  if (!occurredOn) return { ok: false, error: "Elegí la fecha del suceso" };

  const belongs = await prisma.membership.findFirst({
    where: { clubId, userId: playerId, role: "PLAYER" },
    select: { id: true },
  });
  if (!belongs) return { ok: false, error: "Jugador no encontrado" };

  let data: CategoryChangeData | TournamentParticipationData;
  if (input.type === "CATEGORY_CHANGE") {
    const linked = await resolveLinkedTournament(
      clubId,
      playerId,
      input.data.linkedTournamentKey,
    );
    if (linked && "error" in linked) return { ok: false, error: linked.error };
    const categoryData = toCategoryChangeData(input.data, linked);
    if ("error" in categoryData) return { ok: false, error: categoryData.error };
    data = categoryData;
  } else {
    data = toTournamentData(input.data);
  }

  await prisma.playerEvent.create({
    data: {
      clubId,
      playerId,
      type: input.type,
      occurredOn,
      note: blankToNull(input.note),
      data,
      createdById,
      createdByName: createdByName.trim() || "Usuario del club",
    },
  });

  return { ok: true };
}

const LABEL_TO_ROUND: Record<string, TournamentRound> = {
  "32 avos": "32avos",
  "16 avos": "16avos",
  Octavos: "Octavos",
  Cuartos: "Cuartos",
  Semifinal: "Semifinal",
  Final: "Final",
};

export type SyncTournamentEventsResult =
  | { ok: true; created: number; updated: number }
  | { ok: false; error: string };

function preferRound(current: unknown, next: TournamentRound): TournamentRound {
  if (!isTournamentRound(current)) return next;
  return tournamentRoundRank(next) > tournamentRoundRank(current) ? next : current;
}

function roundFromFixtures(
  pairId: string,
  settings: {
    zonesFixture: Prisma.JsonValue | null;
    intermediateFixture: Prisma.JsonValue | null;
    finalFixture: Prisma.JsonValue | null;
    zonesMatchFormat: MatchFormat;
    knockoutMatchFormat: MatchFormat;
    finalMatchFormat: MatchFormat;
    zone4Advancers: number;
  } | null,
): TournamentRound {
  if (!settings) return "Zonas";
  const zones = parseZonesFixture(settings.zonesFixture);

  const qualification = buildZoneQualification({
    fixture: zones,
    format: settings.zonesMatchFormat,
    zone4Advancers: settings.zone4Advancers === 2 ? 2 : 3,
  });
  const reached = furthestRoundLabelForPair(pairId, qualification, [
    {
      fixture: parseIntermediateFixture(settings.intermediateFixture),
      matchFormat: settings.knockoutMatchFormat,
    },
    {
      fixture: parseIntermediateFixture(settings.finalFixture),
      matchFormat: settings.finalMatchFormat,
    },
  ]);
  if (reached?.champion) return "Campeón";
  if (reached) return LABEL_TO_ROUND[reached.label] ?? "Zonas";
  return "Zonas";
}

function participationData(input: {
  tournamentId: string;
  categoryId: string;
  tournamentName: string;
  category: string;
  roundReached: TournamentRound;
  partnerName: string;
}): Prisma.InputJsonObject {
  return {
    tournamentId: input.tournamentId,
    categoryId: input.categoryId,
    tournamentName: input.tournamentName,
    category: input.category,
    roundReached: input.roundReached,
    partnerName: input.partnerName,
  };
}

/// Crea o completa un suceso de participación por cada torneo en el que el jugador está inscripto.
export async function syncPlayerTournamentEvents(
  clubId: string,
  playerId: string,
  createdById: string,
  createdByName: string,
): Promise<SyncTournamentEventsResult> {
  await ensureRuntimeSchema();

  const belongs = await prisma.membership.findFirst({
    where: { clubId, userId: playerId, role: "PLAYER" },
    select: { id: true },
  });
  if (!belongs) return { ok: false, error: "Jugador no encontrado" };

  const pairs = await prisma.tournamentPair.findMany({
    where: {
      status: { not: "CANCELLED" },
      tournament: { clubId },
      OR: [{ player1Id: playerId }, { player2Id: playerId }],
    },
    select: {
      id: true,
      player1Id: true,
      player1: { select: { fullName: true } },
      player2: { select: { fullName: true } },
      category: {
        select: {
          id: true,
          name: true,
          catalogCategory: { select: { name: true } },
          settings: {
            select: {
              zonesFixture: true,
              intermediateFixture: true,
              finalFixture: true,
              zonesMatchFormat: true,
              knockoutMatchFormat: true,
              finalMatchFormat: true,
              zone4Advancers: true,
            },
          },
        },
      },
      tournament: { select: { id: true, name: true, startDate: true } },
    },
  });

  const existing = await prisma.playerEvent.findMany({
    where: { clubId, playerId, type: "TOURNAMENT" },
    select: { id: true, data: true },
  });

  const byId = new Map<string, { id: string; roundReached: unknown }>();
  const byName = new Map<string, { id: string; roundReached: unknown }>();
  for (const row of existing) {
    const data = row.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) continue;
    const record = { id: row.id, roundReached: data.roundReached };
    const tournamentId =
      typeof data.tournamentId === "string" ? data.tournamentId : "";
    const categoryId =
      typeof data.categoryId === "string" ? data.categoryId : "";
    if (tournamentId && categoryId) {
      byId.set(`${tournamentId}:${categoryId}`, record);
    }
    const name =
      typeof data.tournamentName === "string" ? normalizeName(data.tournamentName) : "";
    const category =
      typeof data.category === "string" ? normalizeName(data.category) : "";
    if (name) byName.set(`${name}|${category}`, record);
  }

  let created = 0;
  let updated = 0;
  const author = createdByName.trim() || "Usuario del club";

  for (const pair of pairs) {
    const tournamentName = pair.tournament.name.trim();
    if (!tournamentName) continue;
    const category = normalizeCategoryLabel(
      pair.category.catalogCategory?.name ?? pair.category.name,
    );
    const partner =
      (pair.player1Id === playerId
        ? pair.player2?.fullName
        : pair.player1.fullName
      )?.trim() || "Sin compañero";
    const occurredOn = new Date(
      `${dateOnly(pair.tournament.startDate)}T00:00:00.000Z`,
    );
    const roundReached = roundFromFixtures(pair.id, pair.category.settings);
    const key = `${pair.tournament.id}:${pair.category.id}`;
    const current =
      byId.get(key) ??
      byName.get(`${normalizeName(tournamentName)}|${normalizeName(category)}`);
    const nextRound = preferRound(current?.roundReached, roundReached);
    const data = participationData({
      tournamentId: pair.tournament.id,
      categoryId: pair.category.id,
      tournamentName,
      category,
      roundReached: nextRound,
      partnerName: partner,
    });

    if (current) {
      await prisma.playerEvent.update({
        where: { id: current.id },
        data: { occurredOn, data },
      });
      updated += 1;
      byId.set(key, { id: current.id, roundReached: nextRound });
      continue;
    }

    const row = await prisma.playerEvent.create({
      data: {
        clubId,
        playerId,
        type: "TOURNAMENT",
        occurredOn,
        data,
        createdById,
        createdByName: author,
      },
      select: { id: true },
    });
    created += 1;
    const saved = { id: row.id, roundReached: nextRound };
    byId.set(key, saved);
    byName.set(
      `${normalizeName(tournamentName)}|${normalizeName(category)}`,
      saved,
    );
  }

  return { ok: true, created, updated };
}
