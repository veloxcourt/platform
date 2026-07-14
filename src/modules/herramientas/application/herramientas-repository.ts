import type { EcoItem } from "../domain/eco-torneo";
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
    input: { name: string; items: EcoItem[] },
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
  ): Promise<EcoTorneoSimulationDetail | null>;

  deleteEcoTorneoSimulation(clubId: string, id: string): Promise<boolean>;
}
