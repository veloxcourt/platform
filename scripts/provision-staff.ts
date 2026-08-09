import "dotenv/config";

import { ensureClubUserTypes } from "../src/lib/auth/user-types";
import { prisma } from "../src/lib/prisma";
import { createSupabaseAdminClient } from "../src/lib/supabase/admin";

/**
 * Alta de staff con login listo (sin email de invitación).
 * Uso:
 *   npx tsx scripts/provision-staff.ts <clubSlug> <email> <fullName> <password> [tipo]
 * Ejemplo:
 *   npx tsx scripts/provision-staff.ts tiebreak dana@x.com "Dana" "secreto" Administrador
 */
async function main() {
  const [clubSlug, rawEmail, fullName, password, typeName = "Administrador"] =
    process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();

  if (!clubSlug || !email || !fullName || !password) {
    throw new Error(
      'Uso: npx tsx scripts/provision-staff.ts <clubSlug> <email> <fullName> <password> [tipo]',
    );
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en .env");
  }

  const club = await prisma.club.findUnique({ where: { slug: clubSlug } });
  if (!club) throw new Error(`Club no encontrado: ${clubSlug}`);

  await ensureClubUserTypes(club.id);
  const userType = await prisma.clubUserType.findFirst({
    where: { clubId: club.id, name: typeName, active: true },
  });
  if (!userType) {
    throw new Error(`Tipo de usuario no encontrado: ${typeName}`);
  }

  const supabase = createSupabaseAdminClient();
  const { data: listed, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;

  const existingAuth = listed.users.find(
    (user) => user.email?.toLowerCase() === email,
  );

  let authUserId = existingAuth?.id ?? null;
  if (authUserId) {
    const { error } = await supabase.auth.admin.updateUserById(authUserId, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, club_slug: clubSlug },
    });
    if (error) throw error;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, club_slug: clubSlug },
    });
    if (error || !data.user) {
      throw new Error(error?.message ?? "No se pudo crear el usuario de auth");
    }
    authUserId = data.user.id;
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { fullName, authUserId },
    create: { email, fullName, authUserId },
  });

  const existingMembership = await prisma.membership.findFirst({
    where: {
      clubId: club.id,
      userId: user.id,
      role: { in: ["OWNER", "CLUB_ADMIN"] },
    },
  });

  if (existingMembership) {
    await prisma.membership.update({
      where: { id: existingMembership.id },
      data: {
        role: existingMembership.role === "OWNER" ? "OWNER" : "CLUB_ADMIN",
        userTypeId: userType.id,
        allowedModules: userType.privileges,
        staffStatus: "ACTIVE",
        acceptedAt: new Date(),
        disabledAt: null,
      },
    });
  } else {
    await prisma.membership.create({
      data: {
        clubId: club.id,
        userId: user.id,
        role: "CLUB_ADMIN",
        userTypeId: userType.id,
        allowedModules: userType.privileges,
        staffStatus: "ACTIVE",
        acceptedAt: new Date(),
      },
    });
  }

  console.log(
    `OK ${fullName} <${email}> → ${clubSlug} (${userType.name}) — login listo`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
