import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PublicInscriptionAuthBanner({
  publicSlug,
  loggedInName,
}: {
  publicSlug: string;
  loggedInName?: string | null;
}) {
  const next = encodeURIComponent(`/inscripcion/${publicSlug}`);

  if (loggedInName) {
    return (
      <div className="rounded-xl border border-orange-200/70 bg-orange-50/30 px-4 py-3 text-sm dark:border-orange-900/40 dark:bg-orange-950/20">
        <p>
          Estás ingresado como <span className="font-medium">{loggedInName}</span>.
          Vas a figurar como jugador 1.
        </p>
        <p className="mt-1 text-muted-foreground">
          Podés ver tus inscripciones en{" "}
          <Link href="/cuenta" className="underline underline-offset-4">
            Mi cuenta
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed bg-background/80 px-4 py-3 text-sm">
      <p className="font-medium">Creá una cuenta (opcional)</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
        <li>Ver tus torneos e inscripciones en un solo lugar</li>
        <li>Pedir baja o cambiar preferencias sin buscar el teléfono</li>
        <li>Una sola cuenta para todos los clubes</li>
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/registro?next=${next}`} className={cn(buttonVariants({ size: "sm" }))}>
          Crear cuenta
        </Link>
        <Link
          href={`/login?next=${next}`}
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
        >
          Ingresar
        </Link>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        No hace falta para inscribirse. El formulario de abajo funciona igual.
      </p>
    </div>
  );
}
