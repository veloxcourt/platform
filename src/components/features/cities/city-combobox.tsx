"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import {
  createClubCityAction,
  listCitiesAction,
  listProvincesAction,
} from "@/app/ciudades/actions";
import { cn } from "@/lib/utils";
import type { ProvinceOption } from "@/modules/cities/application/city-catalog";
import {
  normalizeCityName,
  searchCityOptions,
  type CityOption,
} from "@/modules/cities/domain/city";

const INPUT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-100";

/// Elige una localidad del catálogo global. Busca por nombre y por alias
/// ("SMS" encuentra "San Marcos Sud"). Si `allowCreate`, un admin del club
/// puede dar de alta una que no esté.
export function CityCombobox({
  value,
  onChange,
  name,
  required = false,
  allowCreate = false,
  clubSlug,
  disabled = false,
  id,
  inputClassName,
  placeholder = "Buscar localidad…",
}: {
  value: string;
  onChange?: (cityId: string, cityName: string) => void;
  /// Nombre del input oculto, para los formularios que postean FormData.
  name?: string;
  required?: boolean;
  allowCreate?: boolean;
  clubSlug?: string;
  disabled?: boolean;
  id?: string;
  inputClassName?: string;
  placeholder?: string;
}) {
  const [cities, setCities] = useState<CityOption[]>([]);
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [provinceQuery, setProvinceQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  /// El timeout del blur lee esto: si ya está eligiendo provincia, no cierra.
  const addingRef = useRef(false);
  addingRef.current = adding;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setAdding(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    void listCitiesAction().then((rows) => {
      if (!cancelled) setCities(rows);
    });
    if (allowCreate) {
      void listProvincesAction().then((rows) => {
        if (!cancelled) setProvinces(rows);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [allowCreate]);

  const selected = cities.find((city) => city.id === value) ?? null;
  const canClear = Boolean(value) && !required && !disabled;
  const results = useMemo(
    () => searchCityOptions(cities, query, 30),
    [cities, query],
  );
  const canAdd =
    allowCreate &&
    Boolean(clubSlug) &&
    query.trim().length >= 2 &&
    results.every((city) => city.name.toLowerCase() !== query.trim().toLowerCase());
  const visibleProvinces = useMemo(() => {
    const needle = normalizeCityName(provinceQuery);
    if (!needle) return provinces;
    return provinces.filter((province) =>
      normalizeCityName(province.name).includes(needle),
    );
  }, [provinces, provinceQuery]);

  function choose(city: CityOption | null) {
    onChange?.(city?.id ?? "", city?.name ?? "");
    setQuery("");
    setProvinceQuery("");
    setOpen(false);
    setAdding(false);
  }

  /// Un clic en la provincia termina el alta: no hay un segundo botón.
  async function createCity(nextProvinceId: string) {
    const cityName = query.trim();
    if (!clubSlug || !nextProvinceId || cityName.length < 2 || saving) return;
    setSaving(true);
    const result = await createClubCityAction(clubSlug, {
      name: cityName,
      provinceId: nextProvinceId,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setCities((current) => {
      if (current.some((city) => city.id === result.city.id)) return current;
      return [
        ...current,
        {
          id: result.city.id,
          name: result.city.name,
          provinceName: result.city.provinceName,
          terms: [],
        },
      ].sort((a, b) => a.name.localeCompare(b.name, "es"));
    });
    if (!result.created) {
      toast.message("Esa localidad ya estaba", {
        description: `Quedó elegida ${result.city.name}.`,
      });
    }
    choose({
      id: result.city.id,
      name: result.city.name,
      provinceName: result.city.provinceName,
      terms: [],
    });
  }

  return (
    <div ref={rootRef} className="relative">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <input
        id={id}
        className={cn(INPUT_CLASS, canClear && "pr-8", inputClassName)}
        value={open ? query : (selected?.name ?? "")}
        placeholder={selected ? selected.name : placeholder}
        required={required && !value}
        disabled={disabled}
        autoComplete="off"
        onMouseDown={() => {
          if (disabled || addingRef.current) return;
          if (!open) setQuery("");
          setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setAdding(false);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            if (addingRef.current) return;
            if (rootRef.current?.contains(document.activeElement)) return;
            setOpen(false);
          }, 140);
        }}
      />
      {canClear ? (
        <button
          type="button"
          title="Dejar sin localidad"
          aria-label="Dejar sin localidad"
          className="absolute right-1 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => choose(null)}
        >
          <X className="size-3.5" />
        </button>
      ) : null}
      {open && !disabled ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md">
          {adding ? (
            <div className="space-y-2 p-2">
              <input
                autoFocus
                value={provinceQuery}
                placeholder="Buscar provincia…"
                className={INPUT_CLASS}
                disabled={saving}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
                onChange={(event) => setProvinceQuery(event.target.value)}
              />
              <div className="max-h-40 overflow-auto">
                {saving ? (
                  <p className="px-2.5 py-2 text-sm text-muted-foreground">
                    Guardando…
                  </p>
                ) : provinces.length === 0 ? (
                  <p className="px-2.5 py-2 text-sm text-muted-foreground">
                    Cargando provincias…
                  </p>
                ) : visibleProvinces.length === 0 ? (
                  <p className="px-2.5 py-2 text-sm text-muted-foreground">
                    Ninguna provincia coincide
                  </p>
                ) : (
                  visibleProvinces.map((province) => (
                    <button
                      key={province.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => void createCity(province.id)}
                      className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      {province.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="max-h-56 overflow-auto">
              {canClear ? (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(null)}
                  className="block w-full border-b px-2.5 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
                >
                  Sin localidad
                </button>
              ) : null}
              {results.length === 0 && !canAdd ? (
                <p className="px-2.5 py-2 text-sm text-muted-foreground">
                  {cities.length === 0 ? "Cargando localidades…" : "Sin resultados"}
                </p>
              ) : (
                results.map((city) => (
                  <button
                    key={city.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(city)}
                    className={cn(
                      "block w-full px-2.5 py-1.5 text-left text-sm hover:bg-muted",
                      city.id === value && "bg-muted font-medium",
                    )}
                  >
                    {city.name}
                    <span className="ml-2 text-muted-foreground">
                      {city.provinceName}
                    </span>
                  </button>
                ))
              )}
              {canAdd ? (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setProvinceQuery("");
                    setAdding(true);
                  }}
                  className="block w-full border-t px-2.5 py-1.5 text-left text-sm hover:bg-muted"
                >
                  Agregar “{query.trim()}” al catálogo
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
