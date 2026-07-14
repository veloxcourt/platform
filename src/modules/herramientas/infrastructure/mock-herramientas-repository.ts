import type { EcoItem } from "../domain/eco-torneo";
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
              },
            ]
          : [],
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
    return sim ? { ...sim, items: sim.items.map((i) => ({ ...i })) } : null;
  }

  async createEcoTorneoSimulation(
    clubId: string,
    input: { name: string; items: EcoItem[] },
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
    };
    record.simulations.push(created);
    return { ...created, items: created.items.map((i) => ({ ...i })) };
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
    return { ...sim, items: sim.items.map((i) => ({ ...i })) };
  }

  async updateEcoTorneoSimulationItems(
    clubId: string,
    id: string,
    items: EcoItem[],
  ): Promise<EcoTorneoSimulationDetail | null> {
    const record = byClubId(clubId);
    if (!record) return null;
    const sim = record.simulations.find((s) => s.id === id);
    if (!sim) return null;
    sim.items = items.map((i) => ({ ...i }));
    sim.updatedAt = new Date();
    return { ...sim, items: sim.items.map((i) => ({ ...i })) };
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
}
