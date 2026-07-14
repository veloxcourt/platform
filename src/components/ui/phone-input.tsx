"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DEFAULT_PHONE_DIAL, PHONE_COUNTRIES } from "@/lib/phone";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function PhoneInput({
  dial,
  local,
  onDialChange,
  onLocalChange,
  error,
  disabled,
}: {
  dial: string;
  local: string;
  onDialChange: (dial: string) => void;
  onLocalChange: (local: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>Teléfono</Label>
      <div className="flex gap-2">
        <select
          className={cn(SELECT_CLASS, "w-[7.5rem] shrink-0")}
          value={dial}
          disabled={disabled}
          onChange={(e) => onDialChange(e.target.value)}
          aria-label="País del teléfono"
        >
          {PHONE_COUNTRIES.map((c) => (
            <option key={c.iso} value={c.dial}>
              {c.flag} +{c.dial}
            </option>
          ))}
        </select>
        <Input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="11 2345 6789"
          value={local}
          disabled={disabled}
          onChange={(e) => onLocalChange(e.target.value)}
          aria-invalid={!!error}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Sin 0 ni 15. Ej: 11 2345 6789 — se guarda listo para WhatsApp.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export const EMPTY_PHONE_DIAL = DEFAULT_PHONE_DIAL;
