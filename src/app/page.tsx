import Link from "next/link";
import { CalendarClock, ArrowRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-b from-background to-muted/40 px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <CalendarClock className="size-7" />
        </span>
        <h1 className="text-4xl font-bold tracking-tight">VeloxCourt</h1>
        <p className="max-w-md text-balance text-muted-foreground">
          Plataforma SaaS integral para la gestión de clubes de pádel. Turnos,
          torneos, socios, caja y más, en un solo lugar.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Link
          href="/club-demo/turnos"
          className={cn(buttonVariants({ size: "lg" }))}
        >
          Ver módulo de Turnos (demo)
          <ArrowRight className="size-4" />
        </Link>
        <p className="text-xs text-muted-foreground">
          Primer módulo en desarrollo · datos de demostración
        </p>
      </div>
    </div>
  );
}
