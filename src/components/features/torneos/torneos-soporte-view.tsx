"use client";

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  describeDrawByPairCount,
  ZONE_STRUCTURE_LABELS,
  type ZoneDrawInfo,
} from "@/modules/tournaments/domain/draw-by-pairs";
import {
  flattenApaRounds,
  parseApaLlave,
} from "@/modules/tournaments/domain/apa-llaves";
import {
  flattenFapRounds,
  parseFapLlave,
} from "@/modules/tournaments/domain/fap-llaves";
import {
  ZONE4_ADVANCERS_LABELS,
  ZONE4_ADVANCERS_VALUES,
  type Zone4Advancers,
} from "@/modules/tournaments/domain/config-schema";
import { cn } from "@/lib/utils";
import { AyudaButton } from "./ayuda-button";

const MIN_PAIRS = 6;
const MAX_PAIRS = 36;
const PAIR_COUNTS = Array.from(
  { length: MAX_PAIRS - MIN_PAIRS + 1 },
  (_, i) => i + MIN_PAIRS,
);

const SELECT_CLASS =
  "h-8 w-full max-w-[280px] rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const ZONE_MATCHES: Record<
  ZoneDrawInfo["structure"],
  { label: string; kind: string }[]
> = {
  round_robin: [
    { label: "Pareja 1 vs Pareja 2", kind: "Round-robin" },
    { label: "Pareja 2 vs Pareja 3", kind: "Round-robin" },
    { label: "Pareja 1 vs Pareja 3", kind: "Round-robin" },
  ],
  opening_plus: [
    { label: "Pareja 1 vs Pareja 2", kind: "1.ª ronda" },
    { label: "Pareja 3 vs Pareja 4", kind: "1.ª ronda" },
    { label: "Ganador vs ganador", kind: "G/G" },
    { label: "Perdedor vs perdedor", kind: "P/P" },
  ],
  single_match: [{ label: "Pareja 1 vs Pareja 2", kind: "Único" }],
  incomplete: [],
};

function clampPairs(value: number) {
  if (!Number.isFinite(value)) return MIN_PAIRS;
  return Math.min(MAX_PAIRS, Math.max(MIN_PAIRS, Math.floor(value)));
}

export function TorneosSoporteView() {
  const [pairCount, setPairCount] = useState(12);
  const [draft, setDraft] = useState("12");
  const [zone4Advancers, setZone4Advancers] = useState<Zone4Advancers>(3);
  const draw = useMemo(
    () => describeDrawByPairCount(pairCount, zone4Advancers),
    [pairCount, zone4Advancers],
  );
  const officialTree = useMemo(
    () =>
      zone4Advancers === 3
        ? parseFapLlave(pairCount)
        : parseApaLlave(pairCount),
    [pairCount, zone4Advancers],
  );
  const officialRounds = useMemo(
    () =>
      officialTree
        ? zone4Advancers === 3
          ? flattenFapRounds(officialTree)
          : flattenApaRounds(officialTree)
        : [],
    [officialTree, zone4Advancers],
  );

  function setPairs(next: number) {
    const value = clampPairs(next);
    setPairCount(value);
    setDraft(String(value));
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-medium">Cantidad de parejas</h2>
          <AyudaButton
            title="Ayuda de soporte"
            description="Cómo se calcula el armado según la cantidad de parejas."
          >
            <p>
              Elegí cuántas parejas tiene la categoría. El armado usa zonas de
              3 (objetivo) y completa con zonas de 4 cuando no cierra.
            </p>
            <p>
              Federación (FAP) pasa 3 en zonas de 4; Asociación (APA) pasa 2.
              En zonas de 3 siempre avanzan 2.
            </p>
            <p>
              Cada pareja juega 2 partidos en zona. Las que avanzan entran a
              eliminación directa. El cuadro se redondea a 4, 8, 16 o 32; los
              huecos son byes (pasan sin jugar esa ronda).
            </p>
          </AyudaButton>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Quitar pareja"
              disabled={pairCount <= MIN_PAIRS}
              onClick={() => setPairs(pairCount - 1)}
            >
              <Minus />
            </Button>
            <Input
              type="number"
              min={MIN_PAIRS}
              max={MAX_PAIRS}
              value={draft}
              onChange={(event) => {
                const raw = event.target.value;
                setDraft(raw);
                const parsed = Number(raw);
                if (
                  Number.isInteger(parsed) &&
                  parsed >= MIN_PAIRS &&
                  parsed <= MAX_PAIRS
                ) {
                  setPairCount(parsed);
                }
              }}
              onBlur={() => setPairs(Number(draft))}
              className="w-16 text-center tabular-nums"
              aria-label="Cantidad de parejas"
            />
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Agregar pareja"
              disabled={pairCount >= MAX_PAIRS}
              onClick={() => setPairs(pairCount + 1)}
            >
              <Plus />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PAIR_COUNTS.map((count) => (
              <Button
                key={count}
                type="button"
                size="xs"
                variant={count === pairCount ? "default" : "outline"}
                onClick={() => setPairs(count)}
              >
                {count}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="soporte-zone4-advancers" className="text-sm font-medium">
            Avance en zonas de 4
          </label>
          <select
            id="soporte-zone4-advancers"
            className={SELECT_CLASS}
            value={zone4Advancers}
            onChange={(event) =>
              setZone4Advancers(Number(event.target.value) === 2 ? 2 : 3)
            }
          >
            {ZONE4_ADVANCERS_VALUES.map((value) => (
              <option key={value} value={value}>
                {ZONE4_ADVANCERS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <SummaryStat
            label="Zonas"
            value={
              draw.zones.length === 0
                ? "—"
                : `${draw.zones.length} (${draw.zones.map((z) => z.size).join(" + ")})`
            }
          />
          <SummaryStat label="Partidos de zona" value={String(draw.zoneMatches)} />
          <SummaryStat label="Avanzan a llave" value={String(draw.advancers)} />
          <SummaryStat
            label="Etapas después de zona"
            value={
              draw.rounds.length === 0
                ? "—"
                : draw.rounds
                    .map((round) => `${round.label} ${round.matches}`)
                    .join(" · ")
            }
          />
          <SummaryStat
            label="Cuadro"
            value={
              draw.bracketSize > 0
                ? `${draw.bracketSize}${draw.byes > 0 ? ` · ${draw.byes} bye${draw.byes === 1 ? "" : "s"}` : ""}`
                : "—"
            }
          />
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Zonas</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {draw.zones.map((zone) => (
            <ZoneCard key={zone.label} zone={zone} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">
          Llave
          {draw.knockoutMatches > 0
            ? ` · ${draw.knockoutMatches} partido${draw.knockoutMatches === 1 ? "" : "s"}`
            : ""}
        </h2>
        {draw.rounds.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            Con esta cantidad no se arma llave.
          </p>
        ) : (
          <ol className="grid gap-2 sm:grid-cols-2">
            {draw.rounds.map((round, index) => (
              <li
                key={round.key}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium">{round.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {index === 0 && draw.byes > 0
                      ? `${draw.advancers} parejas · ${draw.byes} bye${draw.byes === 1 ? "" : "s"}`
                      : `${round.pairSlots} parejas`}
                  </p>
                </div>
                <Badge variant="secondary">
                  {round.matches} partido{round.matches === 1 ? "" : "s"}
                </Badge>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <article className="flex flex-col gap-2 rounded-lg border p-4">
          <h3 className="font-medium">Zona de 3</h3>
          <p className="text-sm text-muted-foreground">
            Todas contra todas. 3 partidos, cada pareja juega 2, avanzan las 2
            mejores.
          </p>
          <MatchList structure="round_robin" />
        </article>
        <article className="flex flex-col gap-2 rounded-lg border p-4">
          <h3 className="font-medium">Zona de 4</h3>
          <p className="text-sm text-muted-foreground">
            Dos aperturas, después ganador/ganador y perdedor/perdedor. Cada
            pareja juega 2 y avanzan {zone4Advancers} (
            {zone4Advancers === 2 ? "APA" : "FAP"}).
          </p>
          <MatchList structure="opening_plus" />
        </article>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-medium">Tabla de referencia</h2>
          <p className="text-sm text-muted-foreground">
            Cómo se reparte cada cantidad de parejas en el formato por zonas.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-[11px] text-muted-foreground">
                <th className="px-3 py-2 font-medium">Parejas</th>
                <th className="px-3 py-2 font-medium">Zonas</th>
                <th className="px-3 py-2 font-medium">Partidos zona</th>
                <th className="px-3 py-2 font-medium">Avanzan</th>
                <th className="px-3 py-2 font-medium">Llave</th>
              </tr>
            </thead>
            <tbody>
              {PAIR_COUNTS.map((count) => {
                const row = describeDrawByPairCount(count, zone4Advancers);
                const selected = count === pairCount;
                return (
                  <tr
                    key={count}
                    className={cn(
                      "cursor-pointer border-b border-dashed last:border-0",
                      selected
                        ? "bg-primary/10"
                        : "hover:bg-muted/40",
                    )}
                    onClick={() => setPairs(count)}
                  >
                    <td className="px-3 py-1.5 font-medium tabular-nums">
                      {count}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {row.zones.length === 0
                        ? "—"
                        : row.zones.map((z) => z.size).join(" + ")}
                    </td>
                    <td className="px-3 py-1.5 tabular-nums">
                      {row.zoneMatches}
                    </td>
                    <td className="px-3 py-1.5 tabular-nums">{row.advancers}</td>
                    <td className="px-3 py-1.5">
                      {row.bracketSize > 0
                        ? `Cuadro de ${row.bracketSize}${row.byes > 0 ? ` · ${row.byes} bye${row.byes === 1 ? "" : "s"}` : ""}`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-medium">Llave oficial</h2>
          <p className="text-sm text-muted-foreground">
            {zone4Advancers === 3
              ? `Cruces FAP para ${pairCount} parejas, según el armado del Colegio de Fiscales. 1° / 2° / 3° son los puestos de cada zona.`
              : pairCount <= 32
                ? `Cruces APA para ${pairCount} parejas, según el Reglamento Amateur. En zona de 4 también pasan 2; 7 y 8 usan el mismo cuadro que 6, y así en cada rango.`
                : "APA publica el draw hasta 32 parejas."}
          </p>
        </div>
        {officialRounds.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {officialRounds.map((round) => (
              <article key={round.label} className="flex flex-col gap-2 rounded-lg border p-3">
                <h3 className="text-sm font-medium">{round.label}</h3>
                <ul className="flex flex-col gap-1.5">
                  {round.crossings.map((crossing) => (
                    <li
                      key={`${round.label}-${crossing.id}`}
                      className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-sm"
                    >
                      <span>
                        {crossing.left}
                        <span className="text-muted-foreground"> vs </span>
                        {crossing.right}
                      </span>
                      {zone4Advancers === 3 ? (
                        <span className="text-[11px] text-muted-foreground">
                          n° {crossing.id}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            {zone4Advancers === 3
              ? `No hay llave FAP cargada para ${pairCount} parejas.`
              : "APA publica el draw hasta 32 parejas."}
          </p>
        )}
      </section>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium leading-snug">{value}</dd>
    </div>
  );
}

function ZoneCard({ zone }: { zone: ZoneDrawInfo }) {
  const matches = ZONE_MATCHES[zone.structure];

  return (
    <article className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">{zone.label}</h3>
          <p className="text-xs text-muted-foreground">
            {zone.size} pareja{zone.size === 1 ? "" : "s"} · {zone.matches}{" "}
            partido{zone.matches === 1 ? "" : "s"}
          </p>
        </div>
        <Badge variant="secondary">Avanzan {zone.advancers}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {ZONE_STRUCTURE_LABELS[zone.structure]}
      </p>
      {matches.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {matches.map((match) => (
            <li
              key={`${zone.label}-${match.label}`}
              className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1 text-xs"
            >
              <span>{match.label}</span>
              <span className="text-muted-foreground">{match.kind}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function MatchList({
  structure,
}: {
  structure: ZoneDrawInfo["structure"];
}) {
  return (
    <ul className="flex flex-col gap-1">
      {ZONE_MATCHES[structure].map((match) => (
        <li
          key={match.label}
          className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-sm"
        >
          <span>{match.label}</span>
          <span className="text-xs text-muted-foreground">{match.kind}</span>
        </li>
      ))}
    </ul>
  );
}
