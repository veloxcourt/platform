import { $Enums, Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Incrementar cuando cambie prisma/schema.prisma (invalida cliente cacheado en dev).
const PRISMA_SCHEMA_REVISION = 61;

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
    "player1PaymentMethod" in pairFields ? "1" : "0",
    "player1Confirmed" in pairFields ? "1" : "0",
    "zonesDayPreference" in pairFields ? "1" : "0",
    "simulationEnabled" in categoryFields ? "1" : "0",
    "simulationConfirmedCount" in categoryFields ? "1" : "0",
    "catalogCategoryId" in categoryFields ? "1" : "0",
    "enabledSlotIndexes" in Prisma.TournamentPlayDayScalarFieldEnum
      ? "1"
      : "0",
    "hasSlotSelection" in Prisma.TournamentPlayDayScalarFieldEnum ? "1" : "0",
    "intermediateSlotIndexes" in Prisma.TournamentPlayDayScalarFieldEnum
      ? "1"
      : "0",
    "isIntermediateDay" in Prisma.TournamentPlayDayScalarFieldEnum ? "1" : "0",
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
    "BOOKINGS_CONFIG" in $Enums.AdminModule ? "1" : "0",
    "clubImprovement" in Prisma.ModelName ? "1" : "0",
    "playerEvent" in Prisma.ModelName ? "1" : "0",
    "inviteSentAt" in Prisma.MembershipScalarFieldEnum ? "1" : "0",
    "inviteNote" in Prisma.MembershipScalarFieldEnum ? "1" : "0",
    "instagram" in Prisma.UserScalarFieldEnum ? "1" : "0",
    "showInClientMenu" in Prisma.ProductScalarFieldEnum ? "1" : "0",
    "catalogCityId" in Prisma.UserScalarFieldEnum ? "1" : "0",
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
      .clubImprovement?.findMany === "function" &&
    "playerEvent" in client &&
    typeof (client as { playerEvent?: { findMany?: unknown } }).playerEvent
      ?.findMany === "function" &&
    "city" in client &&
    typeof (client as { city?: { findMany?: unknown } }).city?.findMany ===
      "function" &&
    "province" in client &&
    typeof (client as { province?: { findMany?: unknown } }).province
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
    `ALTER TYPE "AdminModule" ADD VALUE IF NOT EXISTS 'BOOKINGS_CONFIG'`,
    `DO $$ BEGIN CREATE TYPE "ImprovementKind" AS ENUM ('IMPROVE', 'ADD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE TYPE "ImprovementStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "zoneQualification" JSONB`,
    `ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "roundPhaseConfigs" JSONB`,
    `ALTER TABLE "tournament_play_days" ADD COLUMN IF NOT EXISTS "intermediateSlotIndexes" INTEGER[] DEFAULT ARRAY[]::INTEGER[]`,
    `ALTER TABLE "tournament_play_days" ADD COLUMN IF NOT EXISTS "isIntermediateDay" BOOLEAN NOT NULL DEFAULT false`,
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
    `DO $$ BEGIN CREATE TYPE "PlayerEventType" AS ENUM ('CATEGORY_CHANGE', 'TOURNAMENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `CREATE TABLE IF NOT EXISTS "player_events" (
      "id" TEXT NOT NULL,
      "clubId" TEXT NOT NULL,
      "playerId" TEXT NOT NULL,
      "type" "PlayerEventType" NOT NULL,
      "occurredOn" DATE NOT NULL,
      "note" TEXT,
      "data" JSONB NOT NULL,
      "createdById" TEXT,
      "createdByName" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "player_events_pkey" PRIMARY KEY ("id")
    )`,
    `DO $$ BEGIN
      ALTER TABLE "player_events"
        ADD CONSTRAINT "player_events_clubId_fkey"
        FOREIGN KEY ("clubId") REFERENCES "clubs"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `DO $$ BEGIN
      ALTER TABLE "player_events"
        ADD CONSTRAINT "player_events_playerId_fkey"
        FOREIGN KEY ("playerId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `DO $$ BEGIN
      ALTER TABLE "player_events"
        ADD CONSTRAINT "player_events_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `CREATE INDEX IF NOT EXISTS "player_events_clubId_playerId_occurredOn_idx" ON "player_events"("clubId", "playerId", "occurredOn")`,
    `CREATE INDEX IF NOT EXISTS "tournament_pairs_player1Id_idx" ON "tournament_pairs"("player1Id")`,
    `CREATE INDEX IF NOT EXISTS "tournament_pairs_player2Id_idx" ON "tournament_pairs"("player2Id")`,
    `ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "inviteSentAt" TIMESTAMP(3)`,
    `ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "inviteForTournamentId" TEXT`,
    `ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "inviteNote" TEXT`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "instagram" TEXT`,
    `ALTER TABLE "booking_settings" ADD COLUMN IF NOT EXISTS "availabilityIntro" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "tournament_pairs" ADD COLUMN IF NOT EXISTS "player1PaymentMethod" TEXT NOT NULL DEFAULT 'UNPAID'`,
    `ALTER TABLE "tournament_pairs" ADD COLUMN IF NOT EXISTS "player2PaymentMethod" TEXT NOT NULL DEFAULT 'UNPAID'`,
    `UPDATE "tournament_pairs" SET "player1PaymentMethod" = CASE "player1PaymentStatus"::text
        WHEN 'TRANSFER' THEN 'TRANSFER'
        WHEN 'CASH' THEN 'CASH'
        WHEN 'PAID' THEN CASE WHEN "player1PaymentMethod" IN ('CASH', 'TRANSFER') THEN "player1PaymentMethod" ELSE 'CASH' END
        WHEN 'PARTIAL' THEN CASE WHEN "player1PaymentMethod" IN ('CASH', 'TRANSFER') THEN "player1PaymentMethod" ELSE 'CASH' END
        ELSE "player1PaymentMethod"
      END`,
    `UPDATE "tournament_pairs" SET "player2PaymentMethod" = CASE "player2PaymentStatus"::text
        WHEN 'TRANSFER' THEN 'TRANSFER'
        WHEN 'CASH' THEN 'CASH'
        WHEN 'PAID' THEN CASE WHEN "player2PaymentMethod" IN ('CASH', 'TRANSFER') THEN "player2PaymentMethod" ELSE 'CASH' END
        WHEN 'PARTIAL' THEN CASE WHEN "player2PaymentMethod" IN ('CASH', 'TRANSFER') THEN "player2PaymentMethod" ELSE 'CASH' END
        ELSE "player2PaymentMethod"
      END`,
    `UPDATE "tournament_pairs" SET "player1PaymentStatus" = 'PAID' WHERE "player1PaymentStatus"::text IN ('CASH', 'TRANSFER')`,
    `UPDATE "tournament_pairs" SET "player2PaymentStatus" = 'PAID' WHERE "player2PaymentStatus"::text IN ('CASH', 'TRANSFER')`,
    // Catálogo global de localidades. Todo aditivo: las columnas nuevas admiten
    // null, así que una versión anterior de la app sigue andando igual.
    `CREATE TABLE IF NOT EXISTS "provinces" (
      "id" TEXT NOT NULL,
      "country" TEXT NOT NULL DEFAULT 'AR',
      "name" TEXT NOT NULL,
      "searchName" TEXT NOT NULL,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "provinces_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "provinces_country_searchName_key" ON "provinces"("country", "searchName")`,
    `CREATE TABLE IF NOT EXISTS "cities" (
      "id" TEXT NOT NULL,
      "provinceId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "searchName" TEXT NOT NULL,
      "pending" BOOLEAN NOT NULL DEFAULT false,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
    )`,
    `DO $$ BEGIN
      ALTER TABLE "cities"
        ADD CONSTRAINT "cities_provinceId_fkey"
        FOREIGN KEY ("provinceId") REFERENCES "provinces"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "cities_provinceId_searchName_key" ON "cities"("provinceId", "searchName")`,
    `CREATE INDEX IF NOT EXISTS "cities_searchName_idx" ON "cities"("searchName")`,
    `CREATE TABLE IF NOT EXISTS "city_aliases" (
      "id" TEXT NOT NULL,
      "cityId" TEXT NOT NULL,
      "label" TEXT NOT NULL,
      "searchName" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "city_aliases_pkey" PRIMARY KEY ("id")
    )`,
    `DO $$ BEGIN
      ALTER TABLE "city_aliases"
        ADD CONSTRAINT "city_aliases_cityId_fkey"
        FOREIGN KEY ("cityId") REFERENCES "cities"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "city_aliases_searchName_key" ON "city_aliases"("searchName")`,
    `CREATE INDEX IF NOT EXISTS "city_aliases_cityId_idx" ON "city_aliases"("cityId")`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "catalogCityId" TEXT`,
    `DO $$ BEGIN
      ALTER TABLE "users"
        ADD CONSTRAINT "users_catalogCityId_fkey"
        FOREIGN KEY ("catalogCityId") REFERENCES "cities"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `CREATE INDEX IF NOT EXISTS "users_catalogCityId_idx" ON "users"("catalogCityId")`,
    `ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "catalogCityId" TEXT`,
    `DO $$ BEGIN
      ALTER TABLE "clubs"
        ADD CONSTRAINT "clubs_catalogCityId_fkey"
        FOREIGN KEY ("catalogCityId") REFERENCES "cities"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `CREATE INDEX IF NOT EXISTS "clubs_catalogCityId_idx" ON "clubs"("catalogCityId")`,
    `ALTER TABLE "club_requests" ADD COLUMN IF NOT EXISTS "catalogCityId" TEXT`,
    `DO $$ BEGIN
      ALTER TABLE "club_requests"
        ADD CONSTRAINT "club_requests_catalogCityId_fkey"
        FOREIGN KEY ("catalogCityId") REFERENCES "cities"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `CREATE INDEX IF NOT EXISTS "club_requests_catalogCityId_idx" ON "club_requests"("catalogCityId")`,
    `CREATE TABLE IF NOT EXISTS "fixed_booking_releases" (
      "id" TEXT NOT NULL,
      "fixedBookingId" TEXT NOT NULL,
      "date" DATE NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "fixed_booking_releases_pkey" PRIMARY KEY ("id")
    )`,
    `DO $$ BEGIN
      ALTER TABLE "fixed_booking_releases"
        ADD CONSTRAINT "fixed_booking_releases_fixedBookingId_fkey"
        FOREIGN KEY ("fixedBookingId") REFERENCES "fixed_bookings"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "fixed_booking_releases_fixedBookingId_date_key" ON "fixed_booking_releases"("fixedBookingId", "date")`,
    `CREATE INDEX IF NOT EXISTS "fixed_booking_releases_date_idx" ON "fixed_booking_releases"("date")`,
    `ALTER TABLE "fixed_bookings" ADD COLUMN IF NOT EXISTS "playersSet" BOOLEAN NOT NULL DEFAULT false`,
    `CREATE TABLE IF NOT EXISTS "fixed_booking_players" (
      "id" TEXT NOT NULL,
      "fixedBookingId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "position" INTEGER NOT NULL,
      CONSTRAINT "fixed_booking_players_pkey" PRIMARY KEY ("id")
    )`,
    `DO $$ BEGIN
      ALTER TABLE "fixed_booking_players"
        ADD CONSTRAINT "fixed_booking_players_fixedBookingId_fkey"
        FOREIGN KEY ("fixedBookingId") REFERENCES "fixed_bookings"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `DO $$ BEGIN
      ALTER TABLE "fixed_booking_players"
        ADD CONSTRAINT "fixed_booking_players_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "fixed_booking_players_fixedBookingId_userId_key" ON "fixed_booking_players"("fixedBookingId", "userId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "fixed_booking_players_fixedBookingId_position_key" ON "fixed_booking_players"("fixedBookingId", "position")`,
    `CREATE INDEX IF NOT EXISTS "fixed_booking_players_userId_idx" ON "fixed_booking_players"("userId")`,
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
