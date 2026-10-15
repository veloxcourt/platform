"use client";

import { ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";

import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { AvailableCopyOption } from "./available-copy";

export function CopyAvailableMenu({
  options,
}: {
  options: AvailableCopyOption[];
}) {
  if (options.length === 0) return null;

  async function copy(option: AvailableCopyOption) {
    try {
      await navigator.clipboard.writeText(option.text);
      if (option.freeCount === 0) {
        toast.message("No hay turnos libres", {
          description: "Se copió el aviso para pegarlo en WhatsApp",
        });
        return;
      }
      toast.success("Turnos copiados", {
        description: "Listo para pegar en WhatsApp",
      });
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        <Copy />
        Copiar disponibles
        <ChevronDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-64">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.dateISO}
            onClick={() => void copy(option)}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
