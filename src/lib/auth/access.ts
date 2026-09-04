import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import {
  ALL_PRIVILEGES,
  firstControlUsuariosSlug,
  firstHerramientasSlug,
  type AdminModuleKey,
} from "@/config/modules";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { toModuleKeys } from "./permissions";

export class AuthenticationError extends Error {
  constructor() {
    super("Debes iniciar sesión.");
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  constructor(message = "No tenés permiso para realizar esta acción.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

const getCurrentUserRecord = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser || !authUser.email) {
    return null;
  }

  let user = await prisma.user.findFirst({
    where: {
      OR: [{ authUserId: authUser.id }, { email: authUser.email }],
    },
  });

  if (!user) return null;

  if (!user.authUserId) {
    const linked = await prisma.user.updateMany({
      where: { id: user.id, authUserId: null },
      data: { authUserId: authUser.id },
    });

    if (linked.count === 1) {
      user = { ...user, authUserId: authUser.id };
    } else {
      user = await prisma.user.findUnique({ where: { id: user.id } });
    }
  }

  if (!user || user.authUserId !== authUser.id) return null;

  return { authUser, user };
});

export async function getCurrentUser() {
  return getCurrentUserRecord();
}

export async function requireCurrentUser() {
  const current = await getCurrentUserRecord();
  if (!current) throw new AuthenticationError();
  return current;
}

export const getClubAccess = cache(async (clubSlug: string) => {
  const current = await getCurrentUserRecord();
  if (!current) return null;

  const club = await prisma.club.findUnique({
    where: { slug: clubSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      memberships: {
        where: {
          userId: current.user.id,
          role: { in: ["OWNER", "CLUB_ADMIN"] },
          OR: [{ staffStatus: null }, { staffStatus: { not: "DISABLED" } }],
        },
        select: {
          id: true,
          role: true,
          allowedModules: true,
          navOrder: true,
          staffStatus: true,
          userTypeId: true,
          userType: {
            select: {
              id: true,
              name: true,
              privileges: true,
              active: true,
            },
          },
        },
      },
    },
  });

  if (!club) return null;

  const membership =
    club.memberships.find((item) => item.role === "OWNER") ??
    club.memberships.find(
      (item) =>
        item.role === "CLUB_ADMIN" &&
        (item.staffStatus === "ACTIVE" || item.staffStatus === null),
    );

  if (!membership) return null;
  if (membership.staffStatus === "INVITED") return null;

  const privilegesFromType =
    membership.userType?.active === false
      ? []
      : membership.userType
        ? toModuleKeys(membership.userType.privileges)
        : membership.role === "OWNER"
          ? ALL_PRIVILEGES
          : toModuleKeys(membership.allowedModules);

  return {
    club: { id: club.id, name: club.name, slug: club.slug },
    user: current.user,
    authUser: current.authUser,
    membershipId: membership.id,
    userTypeId: membership.userTypeId,
    userTypeName: membership.userType?.name ?? null,
    role: membership.role,
    isOwner:
      membership.role === "OWNER" ||
      privilegesFromType.includes("tipos-usuario"),
    allowedModules: privilegesFromType,
    navOrder: membership.navOrder ?? [],
  };
});

export async function requireClubAccess(clubSlug: string) {
  const access = await getClubAccess(clubSlug);
  if (!access) throw new AuthorizationError("No tenés acceso a este club.");
  return access;
}

export async function requireClubPrivilege(
  clubSlug: string,
  privilege: AdminModuleKey,
) {
  const access = await requireClubAccess(clubSlug);
  if (!access.allowedModules.includes(privilege)) {
    throw new AuthorizationError();
  }
  return access;
}

/** Dueño real del club (rol OWNER). No alcanza con privilegios de admin. */
export async function requireClubOwnerRole(clubSlug: string) {
  const access = await requireClubAccess(clubSlug);
  if (access.role !== "OWNER") {
    throw new AuthorizationError(
      "Solo el dueño del club puede editar estos datos.",
    );
  }
  return access;
}

/** @deprecated prefer requireClubPrivilege("usuarios") */
export async function requireClubOwner(clubSlug: string) {
  return requireClubPrivilege(clubSlug, "usuarios");
}

export async function requireClubModuleAccess(
  clubSlug: string,
  module: AdminModuleKey,
) {
  return requireClubPrivilege(clubSlug, module);
}

export async function requireClubAnyModuleAccess(
  clubSlug: string,
  modules: AdminModuleKey[],
) {
  const access = await requireClubAccess(clubSlug);
  if (!modules.some((module) => access.allowedModules.includes(module))) {
    throw new AuthorizationError();
  }
  return access;
}

export async function enforceClubModulePage(
  clubSlug: string,
  module: AdminModuleKey,
) {
  const access = await getClubAccess(clubSlug);
  if (!access) redirect(`/login?next=/${clubSlug}/${module}`);
  if (!access.allowedModules.includes(module)) {
    const fallback = access.allowedModules.find(
      (item) =>
        item !== "tipos-usuario" &&
        item !== "usuarios" &&
        item !== "menu-precios" &&
        item !== "eco-torneo" &&
        item !== "calendario",
    );
    if (fallback) redirect(`/${clubSlug}/${fallback}`);
    if (access.allowedModules.includes("menu-precios")) {
      redirect(`/${clubSlug}/catalogo/menu`);
    }
    const herramientasSlug = firstHerramientasSlug(access.allowedModules);
    if (herramientasSlug) {
      redirect(`/${clubSlug}/herramientas/${herramientasSlug}`);
    }
    const controlSlug = firstControlUsuariosSlug(access.allowedModules);
    if (controlSlug) {
      redirect(`/${clubSlug}/control-usuarios/${controlSlug}`);
    }
    redirect("/login");
  }
  return access;
}
