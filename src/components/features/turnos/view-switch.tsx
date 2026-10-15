"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, CalendarRange } from "lucide-react";

import { cn } from "@/lib/utils";
import { persistTurnosView, type TurnosView } from "./turnos-view";

export function ViewSwitch({ current }: { current: TurnosView }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const date = params.get("date");

  useEffect(() => {
    persistTurnosView(current);
  }, [current]);

  function build(view: TurnosView) {
    const p = new URLSearchParams();
    if (date) p.set("date", date);
    p.set("view", view);
    return `${pathname}?${p.toString()}`;
  }

  const base =
    "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm transition-colors";

  return (
    <div className="inline-flex rounded-lg border p-0.5">
      <Link
        href={build("dia")}
        prefetch
        onClick={() => persistTurnosView("dia")}
        className={cn(
          base,
          current === "dia"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <CalendarDays className="size-4" />
        Día
      </Link>
      <Link
        href={build("semana")}
        prefetch
        onClick={() => persistTurnosView("semana")}
        className={cn(
          base,
          current === "semana"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <CalendarRange className="size-4" />
        Semana
      </Link>
    </div>
  );
}
