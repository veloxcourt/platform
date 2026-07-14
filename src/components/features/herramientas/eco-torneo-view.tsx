"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createSimulationAction,
  renameSimulationAction,
} from "@/app/(dashboard)/[clubSlug]/herramientas/eco-torneo/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  EcoTorneoSimulationDetail,
  EcoTorneoSimulationListItem,
} from "@/modules/herramientas/domain/types";

import { EcoTorneoPlanilla } from "./eco-torneo-planilla";

export function EcoTorneoView({
  clubSlug,
  currency,
  simulations,
  active,
}: {
  clubSlug: string;
  currency: string;
  simulations: EcoTorneoSimulationListItem[];
  active: EcoTorneoSimulationDetail | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const basePath = `/${clubSlug}/herramientas/eco-torneo`;

  if (simulations.length === 0 || !active) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed px-6 py-10">
        <p className="text-sm text-muted-foreground">
          Todavía no hay simulaciones. Creá una para estimar costos e ingresos
          de un torneo.
        </p>
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await createSimulationAction(clubSlug);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              router.push(`${basePath}?s=${result.data.id}`);
              router.refresh();
            });
          }}
        >
          <Plus className="size-4" />
          Nueva simulación
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SimulationTabs
        clubSlug={clubSlug}
        simulations={simulations}
        activeId={active.id}
        basePath={basePath}
      />
      <EcoTorneoPlanilla
        key={active.id}
        clubSlug={clubSlug}
        simulationId={active.id}
        currency={currency}
        initialItems={active.items}
      />
    </div>
  );
}

function SimulationTabs({
  clubSlug,
  simulations,
  activeId,
  basePath,
}: {
  clubSlug: string;
  simulations: EcoTorneoSimulationListItem[];
  activeId: string;
  basePath: string;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-1 border-b">
      {simulations.map((sim) => (
        <SimulationTab
          key={sim.id}
          clubSlug={clubSlug}
          simulation={sim}
          active={sim.id === activeId}
          href={`${basePath}?s=${sim.id}`}
          onSelect={() => {
            router.push(`${basePath}?s=${sim.id}`);
          }}
        />
      ))}
    </div>
  );
}

function SimulationTab({
  clubSlug,
  simulation,
  active,
  href,
  onSelect,
}: {
  clubSlug: string;
  simulation: EcoTorneoSimulationListItem;
  active: boolean;
  href: string;
  onSelect: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(simulation.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setDraft(simulation.name);
  }, [simulation.name]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commitRename() {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === simulation.name) {
      setDraft(simulation.name);
      return;
    }
    startTransition(async () => {
      const result = await renameSimulationAction(
        clubSlug,
        simulation.id,
        next,
      );
      if (!result.ok) {
        toast.error(result.error);
        setDraft(simulation.name);
        return;
      }
      router.refresh();
    });
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitRename();
          }
          if (e.key === "Escape") {
            setDraft(simulation.name);
            setEditing(false);
          }
        }}
        className="mb-[-1px] h-9 w-40 rounded-b-none border-b-2 border-primary px-3 text-sm"
        aria-label="Nombre de la simulación"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (!active) onSelect();
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        setEditing(true);
      }}
      title={href}
      className={cn(
        "mb-[-1px] inline-block max-w-[12rem] truncate border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {simulation.name}
    </button>
  );
}
