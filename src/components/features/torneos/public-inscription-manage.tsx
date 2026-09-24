"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getMyPairsForTournamentAction } from "@/app/inscripcion/[publicSlug]/actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  pairManagePath,
  type PublicManagedPair,
} from "@/modules/tournaments/domain/pair-manage";
import { REGISTRATION_STATUS_LABELS } from "@/modules/tournaments/domain/pair-schema";

export function PublicInscriptionManage({
  publicSlug,
  isLoggedIn,
}: {
  publicSlug: string;
  isLoggedIn: boolean;
}) {
  const next = encodeURIComponent(`/inscripcion/${publicSlug}`);
  const [myPairs, setMyPairs] = useState<
    Array<PublicManagedPair & { tournamentId: string; startDate: string }>
  >([]);

  useEffect(() => {
    if (!isLoggedIn) return;
    void getMyPairsForTournamentAction(publicSlug).then(setMyPairs);
  }, [isLoggedIn, publicSlug]);

  return (
    <section
      id="gestionar"
      className="scroll-mt-6 rounded-xl border bg-background p-4 space-y-4"
    >
      <div>
        <h2 className="text-sm font-semibold">Ya me inscribí</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Para cambiar preferencias o pedir la baja necesitás el{" "}
          <span className="font-medium">link privado</span> que aparece al
          inscribirse, o una cuenta de jugador.
        </p>
      </div>

      {isLoggedIn ? (
        myPairs.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {myPairs.map((pair) => (
              <li
                key={pair.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
              >
                <span>
                  {pair.player1Name}
                  {pair.player2Name ? ` / ${pair.player2Name}` : ""} ·{" "}
                  {pair.categoryName} · {REGISTRATION_STATUS_LABELS[pair.status]}
                </span>
                <Link
                  href={pairManagePath(pair.publicSlug, pair.manageToken)}
                  className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                >
                  Gestionar
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No figurás en una inscripción activa de este torneo. Si te anotaste
            sin cuenta, usá el link privado o{" "}
            <Link href="/cuenta" className="underline underline-offset-4">
              revisá Mi cuenta
            </Link>
            .
          </p>
        )
      ) : (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/login?next=${next}`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Ingresar
          </Link>
          <Link
            href={`/registro?next=${next}`}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            Crear cuenta
          </Link>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Si perdiste el link y no tenés cuenta, pedile al club que te ayude desde
        el torneo.
      </p>
    </section>
  );
}
