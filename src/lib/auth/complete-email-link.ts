import { prisma } from "@/lib/prisma";

export type EmailLinkResult =
  | { ok: true }
  | { ok: false; error: string; signOut: boolean };

export async function linkAuthUserToLocalAccount(
  authUser: { id: string; email: string },
  options: { activateInvites: boolean },
): Promise<EmailLinkResult> {
  const email = authUser.email.toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { authUserId: authUser.id },
        { email: { equals: email, mode: "insensitive" } },
      ],
    },
  });

  if (!user) {
    return {
      ok: false,
      error: "La cuenta no tiene acceso a ningún club.",
      signOut: true,
    };
  }
  if (user.authUserId && user.authUserId !== authUser.id) {
    return {
      ok: false,
      error: "El enlace no corresponde a esta cuenta.",
      signOut: true,
    };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { authUserId: authUser.id, email },
    }),
    ...(options.activateInvites
      ? [
          prisma.membership.updateMany({
            where: {
              userId: user.id,
              role: "CLUB_ADMIN",
              staffStatus: "INVITED",
            },
            data: {
              staffStatus: "ACTIVE",
              acceptedAt: new Date(),
              disabledAt: null,
            },
          }),
        ]
      : []),
  ]);

  return { ok: true };
}
