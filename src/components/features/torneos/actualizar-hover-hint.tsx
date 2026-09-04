"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function ActualizarHoverHint({
  children,
  heading,
  effects,
  note,
  align = "end",
}: {
  children: ReactNode;
  heading: string;
  effects: string[];
  note?: string;
  align?: "start" | "end";
}) {
  return (
    <span className="group/hint relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute top-full z-50 mt-1.5 w-72 rounded-lg border bg-popover p-2.5 text-left text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10",
          "invisible opacity-0 transition-opacity delay-75 duration-100 group-hover/hint:visible group-hover/hint:opacity-100 group-hover/hint:delay-150 group-focus-within/hint:visible group-focus-within/hint:opacity-100 group-focus-within/hint:delay-150",
          align === "end" ? "right-0" : "left-0",
        )}
      >
        <span className="block font-medium text-foreground">{heading}</span>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-3.5 text-muted-foreground">
          {effects.map((effect) => (
            <li key={effect}>{effect}</li>
          ))}
        </ul>
        {note ? (
          <span className="mt-1.5 block text-muted-foreground">{note}</span>
        ) : null}
      </span>
    </span>
  );
}
