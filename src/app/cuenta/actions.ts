"use server";

import { requireCurrentUser } from "@/lib/auth/access";
import { listUserActivePairs } from "@/modules/tournaments/application/find-public-pair";
import { requestPairCancellation } from "@/modules/tournaments/application/request-pair-cancellation";

export async function requestMyPairCancellationAction(
  pairId: string,
): Promise<
  | { ok: true; outcome: "cancelled" | "requested"; message: string }
  | { ok: false; error: string }
> {
  const { user } = await requireCurrentUser();
  return requestPairCancellation({ pairId, actorUserId: user.id });
}

export async function getMyPairsAction() {
  const { user } = await requireCurrentUser();
  return listUserActivePairs(user.id);
}
