import type { AdminModule } from "@prisma/client";

import { ALL_PRIVILEGES } from "@/config/modules";
import { prisma } from "@/lib/prisma";

import { toDatabaseModules } from "./permissions";

const DEFAULT_ADMIN_PRIVILEGES = [
  "jugadores",
  "catalogo",
  "menu-precios",
  "turnos",
  "torneos",
  "herramientas",
] as const;

/** Crea tipos base del club y vincula membresías staff existentes. */
export async function ensureClubUserTypes(clubId: string) {
  const allPrivileges = toDatabaseModules(ALL_PRIVILEGES);
  const adminPrivileges = toDatabaseModules([...DEFAULT_ADMIN_PRIVILEGES]);

  const ownerType = await prisma.clubUserType.upsert({
    where: { clubId_name: { clubId, name: "Dueño" } },
    update: {
      // Mantener Dueño alineado con el catálogo actual de privilegios.
      privileges: allPrivileges,
    },
    create: {
      clubId,
      name: "Dueño",
      description: "Acceso completo al club.",
      privileges: allPrivileges,
    },
  });

  const adminType = await prisma.clubUserType.upsert({
    where: { clubId_name: { clubId, name: "Administrador" } },
    update: {},
    create: {
      clubId,
      name: "Administrador",
      description: "Operación diaria del club.",
      privileges: adminPrivileges,
    },
  });

  await prisma.membership.updateMany({
    where: { clubId, role: "OWNER", userTypeId: null },
    data: { userTypeId: ownerType.id, staffStatus: "ACTIVE" },
  });

  const admins = await prisma.membership.findMany({
    where: { clubId, role: "CLUB_ADMIN", userTypeId: null },
    select: { id: true, allowedModules: true },
  });

  for (const membership of admins) {
    let userTypeId = adminType.id;
    if (membership.allowedModules.length > 0) {
      const match = await findOrCreateTypeForPrivileges(
        clubId,
        membership.allowedModules,
      );
      userTypeId = match.id;
    }
    await prisma.membership.update({
      where: { id: membership.id },
      data: { userTypeId },
    });
  }

  return { ownerType, adminType };
}

async function findOrCreateTypeForPrivileges(
  clubId: string,
  privileges: AdminModule[],
) {
  const existing = await prisma.clubUserType.findMany({
    where: { clubId },
  });
  const sorted = [...privileges].sort().join(",");
  const match = existing.find(
    (type) => [...type.privileges].sort().join(",") === sorted,
  );
  if (match) return match;

  const count = existing.length + 1;
  return prisma.clubUserType.create({
    data: {
      clubId,
      name: `Perfil ${count}`,
      description: "Migrado desde permisos individuales.",
      privileges,
    },
  });
}
