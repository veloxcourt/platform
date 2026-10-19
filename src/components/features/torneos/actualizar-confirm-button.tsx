"use client";

import { useRef, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActualizarConfirmCopy } from "@/modules/tournaments/domain/fixture-edit-mode";
import { ActualizarHoverHint } from "./actualizar-hover-hint";

export type ActualizarWarning = {
  title: string;
  description?: string;
  groups: Array<{ heading: string; reasons: string[] }>;
};

export function ActualizarConfirmButton({
  disabled = false,
  pending = false,
  heading,
  effects,
  note,
  confirm,
  onConfirm,
  loadWarning,
  className,
}: {
  disabled?: boolean;
  pending?: boolean;
  heading: string;
  effects: string[];
  note?: string;
  confirm: ActualizarConfirmCopy;
  onConfirm: () => void;
  /// Se consulta al abrir la confirmación (p. ej. resultados que se pierden).
  loadWarning?: () => Promise<ActualizarWarning | null>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [warning, setWarning] = useState<ActualizarWarning | null>(null);
  const requestRef = useRef(0);

  function openConfirm() {
    setOpen(true);
    setWarning(null);
    if (!loadWarning) return;
    const request = ++requestRef.current;
    setChecking(true);
    loadWarning()
      .then((next) => {
        if (requestRef.current === request) setWarning(next);
      })
      .catch(() => {
        if (requestRef.current === request) {
          setWarning({
            title: "No se pudo revisar si se pierden resultados",
            groups: [],
          });
        }
      })
      .finally(() => {
        if (requestRef.current === request) setChecking(false);
      });
  }

  const losesData = Boolean(warning && warning.groups.length > 0);

  return (
    <>
      <ActualizarHoverHint heading={heading} effects={effects} note={note}>
        <Button
          type="button"
          size="sm"
          className={className}
          disabled={disabled || pending}
          onClick={openConfirm}
        >
          <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </ActualizarHoverHint>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className={losesData ? "sm:max-w-lg" : "sm:max-w-md"}
        >
          <DialogHeader>
            <DialogTitle>{confirm.title}</DialogTitle>
            <DialogDescription>
              Revisá qué se regenera y qué queda como está.
            </DialogDescription>
          </DialogHeader>
          <ConfirmList title="Afecta" items={confirm.affects} />
          <ConfirmList title="No afecta" items={confirm.doesNotAffect} />
          {checking ? (
            <p className="text-sm text-muted-foreground">
              Revisando resultados cargados…
            </p>
          ) : warning ? (
            <WarningBlock warning={warning} />
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              No Actualizar
            </Button>
            <Button
              type="button"
              variant={losesData ? "destructive" : "default"}
              disabled={pending || checking}
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              {losesData ? "Actualizar igual" : "Actualizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function WarningBlock({ warning }: { warning: ActualizarWarning }) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
        <AlertTriangle className="size-4 shrink-0" />
        {warning.title}
      </p>
      {warning.description ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {warning.description}
        </p>
      ) : null}
      {warning.groups.length > 0 ? (
        <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
          {warning.groups.map((group) => (
            <div key={group.heading}>
              <p className="text-sm font-medium text-foreground">
                {group.heading}
              </p>
              <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-sm text-muted-foreground">
                {group.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ConfirmList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
