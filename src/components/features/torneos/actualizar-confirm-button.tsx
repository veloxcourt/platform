"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

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

export function ActualizarConfirmButton({
  disabled = false,
  pending = false,
  heading,
  effects,
  note,
  confirm,
  onConfirm,
  className,
}: {
  disabled?: boolean;
  pending?: boolean;
  heading: string;
  effects: string[];
  note?: string;
  confirm: ActualizarConfirmCopy;
  onConfirm: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ActualizarHoverHint heading={heading} effects={effects} note={note}>
        <Button
          type="button"
          size="sm"
          className={className}
          disabled={disabled || pending}
          onClick={() => setOpen(true)}
        >
          <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </ActualizarHoverHint>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm.title}</DialogTitle>
            <DialogDescription>
              Revisá qué se regenera y qué queda como está.
            </DialogDescription>
          </DialogHeader>
          <ConfirmList title="Afecta" items={confirm.affects} />
          <ConfirmList title="No afecta" items={confirm.doesNotAffect} />
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
              disabled={pending}
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              Actualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
