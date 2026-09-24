import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { isCategoryFixtureArmed } from "@/modules/tournaments/domain/fixture-armed";
import { getTournamentRepository } from "@/modules/tournaments/infrastructure/repository";

export type RequestPairCancellationResult =
  | {
      ok: true;
      outcome: "cancelled" | "requested";
      message: string;
    }
  | { ok: false; error: string };

/**
 * Pedido de baja de la pareja.
 * - Sin cuadro armado → CANCELLED inmediato.
 * - Con cuadro armado → CANCEL_REQUESTED (el Club confirma).
 */
export async function requestPairCancellation(input: {
  pairId: string;
  /** Usuario autenticado que pertenece a la pareja, o null si se validó por teléfono. */
  actorUserId?: string | null;
}): Promise<RequestPairCancellationResult> {
  const pair = await prisma.tournamentPair.findFirst({
    where: { id: input.pairId },
    select: {
      id: true,
      status: true,
      player1Id: true,
      player2Id: true,
      categoryId: true,
      tournamentId: true,
      tournament: {
        select: {
          clubId: true,
          publicSlug: true,
          club: { select: { slug: true } },
        },
      },
      category: {
        select: {
          settings: {
            select: {
              zonesFixture: true,
              intermediateFixture: true,
              finalFixture: true,
            },
          },
        },
      },
    },
  });

  if (!pair) return { ok: false, error: "Inscripción no encontrada." };
  if (pair.status === "CANCELLED") {
    return { ok: false, error: "Esta inscripción ya está cancelada." };
  }
  if (pair.status === "CANCEL_REQUESTED") {
    return {
      ok: true,
      outcome: "requested",
      message:
        "Ya pediste la baja. El club la tiene que confirmar. Avisá a tu compañero.",
    };
  }

  if (input.actorUserId) {
    const belongs =
      pair.player1Id === input.actorUserId ||
      pair.player2Id === input.actorUserId;
    if (!belongs) {
      return { ok: false, error: "No podés gestionar esta inscripción." };
    }
  }

  const fixtureArmed = isCategoryFixtureArmed(pair.category.settings);
  const repo = getTournamentRepository();

  if (!fixtureArmed) {
    const result = await repo.updatePairStatus(
      pair.tournament.clubId,
      pair.id,
      "CANCELLED",
    );
    if (!result.ok) {
      return { ok: false, error: result.error ?? "No se pudo cancelar." };
    }
    revalidateAfter(pair);
    return {
      ok: true,
      outcome: "cancelled",
      message:
        "Inscripción cancelada. Avisá a tu compañero para que también se entere.",
    };
  }

  const result = await repo.updatePairStatus(
    pair.tournament.clubId,
    pair.id,
    "CANCEL_REQUESTED",
  );
  if (!result.ok) {
    return { ok: false, error: result.error ?? "No se pudo pedir la baja." };
  }
  revalidateAfter(pair);
  return {
    ok: true,
    outcome: "requested",
    message:
      "Pedido de baja enviado. El club lo confirma porque el cuadro ya está armado. Avisá a tu compañero.",
  };
}

function revalidateAfter(pair: {
  tournamentId: string;
  tournament: { publicSlug: string; club: { slug: string } };
}) {
  revalidatePath(`/${pair.tournament.club.slug}/torneos`);
  revalidatePath(
    `/${pair.tournament.club.slug}/torneos/${pair.tournamentId}`,
  );
  revalidatePath(`/inscripcion/${pair.tournament.publicSlug}`);
  revalidatePath("/cuenta");
}
