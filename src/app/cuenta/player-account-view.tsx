"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { logoutAction } from "@/app/(auth)/login/actions";
import { requestMyPairCancellationAction } from "@/app/cuenta/actions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatShortDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  pairManagePath,
  type PublicManagedPair,
} from "@/modules/tournaments/domain/pair-manage";
import { REGISTRATION_STATUS_LABELS } from "@/modules/tournaments/domain/pair-schema";

type PairRow = PublicManagedPair & {
  tournamentId: string;
  startDate: string;
};

export function PlayerAccountView({
  fullName,
  email,
  pairs,
}: {
  fullName: string;
  email: string | null;
  pairs: PairRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function cancelPair(pairId: string) {
    startTransition(async () => {
      const result = await requestMyPairCancellationAction(pairId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Mi cuenta</p>
          <h1 className="text-xl font-semibold tracking-tight">{fullName}</h1>
          {email ? (
            <p className="text-sm text-muted-foreground">{email}</p>
          ) : null}
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="outline" size="sm">
            Salir
          </Button>
        </form>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Mis inscripciones</h2>
        {pairs.length === 0 ? (
          <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">
            Todavía no figurás en ninguna inscripción activa.
          </p>
        ) : (
          <ul className="space-y-3">
            {pairs.map((pair) => (
              <li
                key={pair.id}
                className="rounded-xl border bg-background p-4 text-sm space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{pair.tournamentName}</p>
                    <p className="text-muted-foreground">
                      {pair.clubName} · {formatShortDate(pair.startDate)} ·{" "}
                      {pair.categoryName}
                    </p>
                    <p className="mt-1">
                      {pair.player1Name}
                      {pair.player2Name ? ` / ${pair.player2Name}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant={
                      pair.status === "CANCEL_REQUESTED"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {REGISTRATION_STATUS_LABELS[pair.status]}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={pairManagePath(pair.publicSlug, pair.manageToken)}
                    className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                  >
                    Gestionar
                  </Link>
                  {pair.status !== "CANCEL_REQUESTED" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={isPending}
                      onClick={() => cancelPair(pair.id)}
                    >
                      Pedir baja
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground self-center">
                      El club tiene que confirmar la baja.
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
