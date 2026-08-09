import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Incrementar cuando cambie prisma/schema.prisma (invalida cliente cacheado en dev).
const PRISMA_SCHEMA_REVISION = 30;

/** Cap bajo: Supabase session pooler ~15 slots; Vercel + HMR multiplican clientes. */
const PG_POOL_MAX = 1;

type PrismaBundle = {
  client: PrismaClient;
  pool: Pool;
  revision: number;
  fingerprint: string;
};

type GlobalPrisma = {
  prismaBundle?: PrismaBundle;
};

const globalForPrisma = globalThis as unknown as GlobalPrisma;

function schemaFingerprint(): string {
  const pairFields = Prisma.TournamentPairScalarFieldEnum;
  const categoryFields = Prisma.TournamentCategoryScalarFieldEnum;
  const settingsFields = Prisma.TournamentSettingsScalarFieldEnum;
  return [
    PRISMA_SCHEMA_REVISION,
    "type" in Prisma.TournamentScalarFieldEnum ? "1" : "0",
    "categoryId" in pairFields ? "1" : "0",
    "player1PaymentStatus" in pairFields ? "1" : "0",
    "player1Confirmed" in pairFields ? "1" : "0",
    "zonesDayPreference" in pairFields ? "1" : "0",
    "simulationEnabled" in categoryFields ? "1" : "0",
    "simulationConfirmedCount" in categoryFields ? "1" : "0",
    "pairsPerZone" in settingsFields ? "1" : "0",
    "zonesPlayDates" in settingsFields ? "1" : "0",
    "zonesFixture" in settingsFields ? "1" : "0",
    "courtCount" in Prisma.TournamentScalarFieldEnum ? "1" : "0",
    "tournamentSlotReservation" in Prisma.ModelName ? "1" : "0",
    "ecoTorneoSimulation" in Prisma.ModelName ? "1" : "0",
    "productComponent" in Prisma.ModelName ? "1" : "0",
    "baseQuantity" in Prisma.ProductScalarFieldEnum ? "1" : "0",
    "authUserId" in Prisma.UserScalarFieldEnum ? "1" : "0",
    "allowedModules" in Prisma.MembershipScalarFieldEnum ? "1" : "0",
    "clubUserType" in Prisma.ModelName ? "1" : "0",
    "userTypeId" in Prisma.MembershipScalarFieldEnum ? "1" : "0",
    "isSuperAdmin" in Prisma.UserScalarFieldEnum ? "1" : "0",
    "clubRequest" in Prisma.ModelName ? "1" : "0",
  ].join(":");
}

function clientHasCurrentDelegates(client: PrismaClient): boolean {
  return (
    "tournamentSlotReservation" in client &&
    typeof (client as { tournamentSlotReservation?: { findMany?: unknown } })
      .tournamentSlotReservation?.findMany === "function" &&
    "ecoTorneoSimulation" in client &&
    typeof (client as { ecoTorneoSimulation?: { findMany?: unknown } })
      .ecoTorneoSimulation?.findMany === "function" &&
    "productComponent" in client &&
    typeof (client as { productComponent?: { findMany?: unknown } })
      .productComponent?.findMany === "function" &&
    "clubUserType" in client &&
    typeof (client as { clubUserType?: { findMany?: unknown } }).clubUserType
      ?.findMany === "function" &&
    "clubRequest" in client &&
    typeof (client as { clubRequest?: { findMany?: unknown } }).clubRequest
      ?.findMany === "function"
  );
}

function createBundle(fingerprint: string): PrismaBundle {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: PG_POOL_MAX,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on("error", (err) => {
    console.error("[prisma] pg pool error", err);
  });

  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

  return {
    client,
    pool,
    revision: PRISMA_SCHEMA_REVISION,
    fingerprint,
  };
}

function getPrismaClient(): PrismaClient {
  const fingerprint = schemaFingerprint();
  const cached = globalForPrisma.prismaBundle;

  if (
    cached &&
    cached.revision === PRISMA_SCHEMA_REVISION &&
    cached.fingerprint === fingerprint &&
    clientHasCurrentDelegates(cached.client)
  ) {
    return cached.client;
  }

  // En desarrollo no cerramos el pool anterior: HMR puede dejar requests
  // usando el cliente viejo y `pool.end()` provoca este error.
  // El proceso se limpia al reiniciar `npm run dev`.
  const previous = cached;
  const next = createBundle(fingerprint);
  globalForPrisma.prismaBundle = next;

  if (previous && process.env.NODE_ENV === "production") {
    void previous.client.$disconnect().catch(() => {});
    void previous.pool.end().catch(() => {});
  }

  return next.client;
}

/**
 * Proxy: evita que un `export const` quede apuntando a un cliente obsoleto
 * tras recrear el singleton.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
