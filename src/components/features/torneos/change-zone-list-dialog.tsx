"use client";

import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ChangeZoneListOption = {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
};

export function ChangeZoneListDialog({
  open,
  onOpenChange,
  title,
  description,
  currentValue,
  options,
  searchable = false,
  searchPlaceholder = "Buscar",
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  currentValue: string;
  options: ChangeZoneListOption[];
  searchable?: boolean;
  searchPlaceholder?: string;
  onSelect: (value: string) => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        (option.hint?.toLowerCase().includes(needle) ?? false),
    );
  }, [options, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {searchable ? (
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            autoFocus
          />
        ) : null}

        <ul className="max-h-72 divide-y overflow-y-auto rounded-xl border">
          {filtered.length === 0 ? (
            <li className="px-3 py-4 text-sm text-muted-foreground">
              No hay opciones para mostrar.
            </li>
          ) : (
            filtered.map((option) => {
              const isCurrent = option.value === currentValue;
              const disabled = isCurrent || option.disabled;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect(option.value)}
                    className={cn(
                      "flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-sm",
                      disabled
                        ? "cursor-not-allowed opacity-60"
                        : "hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <span className="min-w-0 font-medium break-words">
                      {option.label}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {isCurrent ? "Actual" : option.hint}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
