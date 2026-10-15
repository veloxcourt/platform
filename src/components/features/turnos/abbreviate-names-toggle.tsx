"use client";

import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { persistAbbreviateNames } from "./responsible-name";

export function useAbbreviateNames(initial: boolean) {
  const [abbreviateNames, setAbbreviateNames] = useState(initial);

  function setAbbreviate(next: boolean) {
    setAbbreviateNames(next);
    persistAbbreviateNames(next);
  }

  return { abbreviateNames, setAbbreviate };
}

export function AbbreviateNamesToggle({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label
      className="flex items-center gap-2 text-sm"
      title="Inicial del nombre y apellido completo. Por ejemplo, M. Pérez"
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      Nombres abreviados
    </label>
  );
}
