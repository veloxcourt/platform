import type { HerramientasRepository } from "../application/herramientas-repository";
import { MockHerramientasRepository } from "./mock-herramientas-repository";
import { PrismaHerramientasRepository } from "./prisma-herramientas-repository";

let instance: HerramientasRepository | null = null;

export function getHerramientasRepository(): HerramientasRepository {
  if (!instance) {
    instance = process.env.DATABASE_URL
      ? new PrismaHerramientasRepository()
      : new MockHerramientasRepository();
  }
  return instance;
}
