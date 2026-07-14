import type { EcoItem } from "./eco-torneo";

export type EcoTorneoSimulationListItem = {
  id: string;
  name: string;
  sortOrder: number;
  updatedAt: Date;
};

export type EcoTorneoSimulationDetail = EcoTorneoSimulationListItem & {
  items: EcoItem[];
};
