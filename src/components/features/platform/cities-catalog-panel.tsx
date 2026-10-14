"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createSuperadminCityAction } from "@/app/ciudades/actions";
import {
  mergeCitiesAction,
  reviewCityAction,
} from "@/app/superadmin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type CatalogCityRow = {
  id: string;
  name: string;
  provinceName: string;
  pending: boolean;
  playerCount: number;
  aliases: string[];
};

export type CatalogProvince = { id: string; name: string };

export function CitiesCatalogPanel({
  cities,
  provinces,
}: {
  cities: CatalogCityRow[];
  provinces: CatalogProvince[];
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [provinceId, setProvinceId] = useState(provinces[0]?.id ?? "");
  const [mergeTarget, setMergeTarget] = useState<Record<string, string>>({});

  function run(
    work: () => Promise<{ ok: true } | { ok: false; error: string }>,
    success: string,
  ) {
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(success);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Localidades</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Catálogo único de la plataforma. Fusionar junta los jugadores y deja
          el nombre viejo como alias, para que el buscador lo siga encontrando.
        </p>

        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () => createSuperadminCityAction({ name, provinceId }),
              "Localidad agregada",
            );
            setName("");
          }}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nueva localidad"
            className="max-w-xs"
            maxLength={80}
          />
          <select
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={provinceId}
            onChange={(event) => setProvinceId(event.target.value)}
          >
            {provinces.map((province) => (
              <option key={province.id} value={province.id}>
                {province.name}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" disabled={isPending || name.trim().length < 2}>
            Agregar
          </Button>
        </form>

        <ul className="divide-y rounded-lg border">
          {cities.map((city) => (
            <li key={city.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-40 font-medium">{city.name}</span>
              <span className="text-muted-foreground">{city.provinceName}</span>
              <span className="text-muted-foreground">{city.playerCount} jugadores</span>
              {city.pending ? <Badge variant="secondary">Pendiente</Badge> : null}
              {city.aliases.length > 0 ? (
                <span className="text-muted-foreground">
                  alias: {city.aliases.join(", ")}
                </span>
              ) : null}
              <span className="ml-auto flex flex-wrap items-center gap-2">
                {city.pending ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      run(() => reviewCityAction(city.id), "Marcada como revisada")
                    }
                  >
                    Revisada
                  </Button>
                ) : null}
                <select
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                  value={mergeTarget[city.id] ?? ""}
                  onChange={(event) =>
                    setMergeTarget((current) => ({
                      ...current,
                      [city.id]: event.target.value,
                    }))
                  }
                  aria-label={`Fusionar ${city.name} con`}
                >
                  <option value="">Fusionar con…</option>
                  {cities
                    .filter((other) => other.id !== city.id)
                    .map((other) => (
                      <option key={other.id} value={other.id}>
                        {other.name}
                      </option>
                    ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending || !mergeTarget[city.id]}
                  onClick={() => {
                    const targetId = mergeTarget[city.id];
                    if (!targetId) return;
                    run(
                      () => mergeCitiesAction(city.id, targetId),
                      `${city.name} fusionada`,
                    );
                  }}
                >
                  Fusionar
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
