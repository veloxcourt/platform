"use client";

import {
  applyPrivilegeToggle,
  PRIVILEGE_GROUPS,
  type AdminModuleKey,
} from "@/config/modules";
import { Checkbox } from "@/components/ui/checkbox";

export function PrivilegeGroups({
  value,
  onChange,
}: {
  value: AdminModuleKey[];
  onChange: (value: AdminModuleKey[]) => void;
}) {
  const toggle = (privilege: AdminModuleKey, checked: boolean) => {
    onChange(applyPrivilegeToggle(value, privilege, checked));
  };

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {PRIVILEGE_GROUPS.map((group) => (
        <section
          key={group.id}
          className="rounded-xl border bg-muted/20 p-3"
        >
          <h3 className="mb-3 text-sm font-semibold">{group.label}</h3>
          <div className="space-y-2">
            {group.options.map((option) => {
              const checked = value.includes(option.key);
              const lockedByEdition =
                option.key === "menu-precios" && value.includes("catalogo");

              return (
                <label
                  key={option.key}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={checked}
                    disabled={lockedByEdition}
                    onCheckedChange={(next) => toggle(option.key, next)}
                  />
                  <span className={lockedByEdition ? "text-muted-foreground" : undefined}>
                    {option.label}
                    {lockedByEdition ? " (incluido con Edición)" : null}
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
