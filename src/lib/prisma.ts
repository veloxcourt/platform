import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Incrementar cuando cambie prisma/schema.prisma (invalida cliente cacheado en dev).
const PRISMA_SCHEMA_REVISION = 26;

type GlobalPrisma = {
  prisma?: PrismaClient;
  prismaRevision?: number;
  prismaFingerprint?: string;
};

const globalForPrisma = globalThis as unknown as GlobalPrisma;

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

/// Huella del cliente generado: si cambia tras `prisma generate`, recreamos el singleton.
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
  ].join(":");
}

function clientHasCurrentDelegates(client: PrismaClient): boolean {
  return (
    "tournamentSlotReservation" in client &&
    typeof (client as { tournamentSlotReservation?: { findMany?: unknown } })
      .tournamentSlotReservation?.findMany === "function" &&
    "ecoTorneoSimulation" in client &&
    typeof (client as { ecoTorneoSimulation?: { findMany?: unknown } })
      .ecoTorneoSimulation?.findMany === "function"
  );
}

function isGeneratedClientCurrent(): boolean {
  const pairFields = Prisma.TournamentPairScalarFieldEnum;
  const categoryFields = Prisma.TournamentCategoryScalarFieldEnum;
  const settingsFields = Prisma.TournamentSettingsScalarFieldEnum;
  return (
    "type" in Prisma.TournamentScalarFieldEnum &&
    "courtCount" in Prisma.TournamentScalarFieldEnum &&
    "tournamentPair" in Prisma.ModelName &&
    "tournamentCategory" in Prisma.ModelName &&
    "tournamentSlotReservation" in Prisma.ModelName &&
    "categoryId" in pairFields &&
    "player1PaymentStatus" in pairFields &&
    "player2PaymentStatus" in pairFields &&
    "player1Confirmed" in pairFields &&
    "player2Confirmed" in pairFields &&
    "zonesDayPreference" in pairFields &&
    "simulationEnabled" in categoryFields &&
    "simulationConfirmedCount" in categoryFields &&
    "pairsPerZone" in settingsFields &&
    "zonesPlayDates" in settingsFields &&
    "knockoutPlayDates" in settingsFields &&
    "finalPlayDates" in settingsFields &&
    "zonesFixture" in settingsFields &&
    "ecoTorneoSimulation" in Prisma.ModelName &&
    !("category" in pairFields)
  );
}

/// Turbopack puede conservar un PrismaClient viejo tras `prisma generate`.
/// Recreamos el cliente si la revisión/huella del schema o los delegates no coinciden.
function getPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  const fingerprint = schemaFingerprint();
  const revisionOk =
    globalForPrisma.prismaRevision === PRISMA_SCHEMA_REVISION;
  const fingerprintOk = globalForPrisma.prismaFingerprint === fingerprint;

  if (
    cached &&
    revisionOk &&
    fingerprintOk &&
    isGeneratedClientCurrent() &&
    clientHasCurrentDelegates(cached)
  ) {
    return cached;
  }

  if (cached) {
    void cached.$disconnect();
  }

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaRevision = PRISMA_SCHEMA_REVISION;
  globalForPrisma.prismaFingerprint = fingerprint;
  return client;
}

export const prisma = getPrismaClient();
