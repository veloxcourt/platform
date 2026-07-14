"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  cloneSimulationAction,
  createSimulationAction,
  deleteSimulationAction,
} from "@/app/(dashboard)/[clubSlug]/herramientas/eco-torneo/actions";
import { Button } from "@/components/ui/button";

export function EcoTorneoHeaderActions({ clubSlug }: { clubSlug: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const onEcoTorneo = pathname.endsWith("/herramientas/eco-torneo");
  if (!onEcoTorneo) return null;

  const activeId = searchParams.get("s");
  const basePath = `/${clubSlug}/herramientas/eco-torneo`;

  function goTo(id: string | null) {
    if (id) {
      router.push(`${basePath}?s=${id}`);
    } else {
      router.push(basePath);
    }
    router.refresh();
  }

  function onNuevo() {
    startTransition(async () => {
      const result = await createSimulationAction(clubSlug);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      goTo(result.data.id);
    });
  }

  function onClonar() {
    if (!activeId) return;
    startTransition(async () => {
      const result = await cloneSimulationAction(clubSlug, activeId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      goTo(result.data.id);
    });
  }

  function onEliminar() {
    if (!activeId) return;
    const ok = window.confirm(
      "¿Eliminar esta simulación? Esta acción no se puede deshacer.",
    );
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteSimulationAction(clubSlug, activeId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      goTo(result.data.nextId);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        onClick={onNuevo}
        disabled={pending}
      >
        <Plus className="size-4" />
        Nuevo
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onClonar}
        disabled={pending || !activeId}
      >
        <Copy className="size-4" />
        Clonar
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onEliminar}
        disabled={pending || !activeId}
      >
        <Trash2 className="size-4" />
        Eliminar
      </Button>
    </div>
  );
}
