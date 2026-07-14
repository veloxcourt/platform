import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
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
}
