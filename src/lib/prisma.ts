import { $Enums, Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Incrementar cuando cambie prisma/schema.prisma (invalida cliente cacheado en dev).
const PRISMA_SCHEMA_REVISION = 44;

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
    "catalogCategoryId" in categoryFields ? "1" : "0",
    "enabledSlotIndexes" in Prisma.TournamentPlayDayScalarFieldEnum
      ? "1"
      : "0",
    "hasSlotSelection" in Prisma.TournamentPlayDayScalarFieldEnum ? "1" : "0",
    "pairsPerZone" in settingsFields ? "1" : "0",
    "zone4Advancers" in settingsFields ? "1" : "0",
    "zonesPlayDates" in settingsFields ? "1" : "0",
    "zonesFixture" in settingsFields ? "1" : "0",
    "intermediateFixture" in settingsFields ? "1" : "0",
    "finalFixture" in settingsFields ? "1" : "0",
    "courtCount" in Prisma.TournamentScalarFieldEnum ? "1" : "0",
    "fixtureEditMode" in Prisma.TournamentScalarFieldEnum ? "1" : "0",
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
    "navOrder" in Prisma.MembershipScalarFieldEnum ? "1" : "0",
    "calendarPlannerVenue" in Prisma.ModelName ? "1" : "0",
    "calendarPlannerSettings" in Prisma.ModelName ? "1" : "0",
    "calendarSearchLink" in Prisma.ModelName ? "1" : "0",
    "logoUrl" in Prisma.ClubScalarFieldEnum ? "1" : "0",
    "TOOLS_ECO_TORNEO" in $Enums.AdminModule ? "1" : "0",
    "TOOLS_CALENDARIO" in $Enums.AdminModule ? "1" : "0",
    "QUE_MEJORO" in $Enums.AdminModule ? "1" : "0",
    "clubImprovement" in Prisma.ModelName ? "1" : "0",
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
      ?.findMany === "function" &&
    "calendarPlannerVenue" in client &&
    typeof (client as { calendarPlannerVenue?: { findMany?: unknown } })
      .calendarPlannerVenue?.findMany === "function" &&
    "calendarSearchLink" in client &&
    typeof (client as { calendarSearchLink?: { findMany?: unknown } })
      .calendarSearchLink?.findMany === "function" &&
    "clubImprovement" in client &&
    typeof (client as { clubImprovement?: { findMany?: unknown } })
      .clubImprovement?.findMany === "function"
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
  get(_target, prop) {
    const client = getPrismaClient();
    const value = Reflect.get(client as object, prop, client);
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});

let runtimeSchemaPromise: Promise<void> | null = null;

/**
 * DDL por una conexión aparte (DIRECT_URL / session). Nunca usar el cliente
 * Prisma del request: el transaction pooler (6543) aborta ALTER y deja
 * la sesión inutilizable, y la app no carga.
 */
async function applyRuntimeSchema() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) return;

  const statements = [
    `ALTER TYPE "AdminModule" ADD VALUE IF NOT EXISTS 'QUE_MEJORO'`,
    `DO $$ BEGIN CREATE TYPE "ImprovementKind" AS ENUM ('IMPROVE', 'ADD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE TYPE "ImprovementStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "zoneQualification" JSONB`,
    `CREATE TABLE IF NOT EXISTS "club_improvements" (
      "id" TEXT NOT NULL,
      "clubId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "detail" TEXT,
      "kind" "ImprovementKind" NOT NULL DEFAULT 'IMPROVE',
      "status" "ImprovementStatus" NOT NULL DEFAULT 'PENDING',
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "club_improvements_pkey" PRIMARY KEY ("id")
    )`,
    `DO $$ BEGIN
      ALTER TABLE "club_improvements"
        ADD CONSTRAINT "club_improvements_clubId_fkey"
        FOREIGN KEY ("clubId") REFERENCES "clubs"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `CREATE INDEX IF NOT EXISTS "club_improvements_clubId_sortOrder_idx" ON "club_improvements"("clubId", "sortOrder")`,
    `CREATE INDEX IF NOT EXISTS "club_improvements_clubId_createdAt_idx" ON "club_improvements"("clubId", "createdAt")`,
  ];

  const pool = new Pool({
    connectionString: url,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  });
  try {
    for (const sql of statements) {
      try {
        await pool.query(sql);
      } catch (error) {
        console.error("[prisma] ensureRuntimeSchema", sql.slice(0, 80), error);
      }
    }
  } finally {
    await pool.end().catch(() => {});
  }
}

/** Completa columnas/tablas nuevas. Usar solo en pantallas que las necesitan. */
export async function ensureRuntimeSchema() {
  if (!runtimeSchemaPromise) {
    runtimeSchemaPromise = applyRuntimeSchema().catch((error) => {
      runtimeSchemaPromise = null;
      throw error;
    });
  }
  await runtimeSchemaPromise;
}
