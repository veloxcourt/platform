import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { createSupabaseAdminClient } from "../src/lib/supabase/admin";

async function main() {
  const [clubSlug, rawEmail] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  if (!clubSlug || !email) {
    throw new Error(
      "Uso: npm run auth:invite-owner -- <club-slug> <email-del-propietario>",
    );
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en .env");
  }

  const owner = await prisma.membership.findFirst({
    where: { role: "OWNER", club: { slug: clubSlug } },
    include: { user: true },
  });
  if (!owner) throw new Error(`No existe un propietario para ${clubSlug}`);

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const supabase = createSupabaseAdminClient();
  const { data: authUsers, error: listError } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;
  const existing = authUsers.users.find(
    (authUser) => authUser.email?.toLowerCase() === email,
  );

  if (existing?.email_confirmed_at) {
    await prisma.user.update({
      where: { id: owner.userId },
      data: { email, authUserId: existing.id },
    });
    const { error: recoveryError } =
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/confirm`,
      });
    if (recoveryError) throw recoveryError;
    console.log(`Enlace para crear contraseña enviado a ${email}`);
    return;
  }

  if (existing) {
    if (!existing.last_sign_in_at) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(
        existing.id,
      );
      if (deleteError) throw deleteError;
    }
  }

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name: owner.user.fullName, club_slug: clubSlug },
    redirectTo: `${siteUrl}/auth/confirm`,
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? "No se pudo invitar al propietario");
  }

  await prisma.user.update({
    where: { id: owner.userId },
    data: { email, authUserId: data.user.id },
  });
  console.log(`Invitación de propietario enviada a ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
