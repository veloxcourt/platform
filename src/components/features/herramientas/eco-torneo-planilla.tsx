"use client";

import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatMoney, pesosToCents, centsToPesos } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  ECO_CATEGORY_DEFS,
  categoriesForFlow,
  computePlanilla,
  createEcoItem,
  type EcoCategory,
  type EcoFlowType,
  type EcoItem,
} from "@/modules/herramientas/domain/eco-torneo";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const INPUT_NUM =
  "h-8 w-full min-w-[5.5rem] text-right tabular-nums";

function exampleItems(): EcoItem[] {
  return [
    createEcoItem("INSCRIPCIONES", {
      observacion: "2 categorías · 21 parejas c/u · 84 jugadores",
      cantidad: 84,
      valorCents: pesosToCents(35_000),
    }),
    createEcoItem("SPONSOR", {
      observacion: "",
      valorCents: null,
    }),
    createEcoItem("PREMIOS_PLATA", {
      observacion: "",
      porcentaje: 30,
    }),
    createEcoItem("REMUNERACION_AYUDANTE", {
      observacion: "",
      porcentaje: 5,
    }),
    createEcoItem("USO_CANCHAS", {
      observacion: "Resto: 100% − premios − ayudante",
    }),
    createEcoItem("PELOTAS", {
      observacion: "",
      cantidad: null,
      valorCents: null,
    }),
    createEcoItem("PERSONAL_BAR", {
      observacion: "",
      cantidad: null,
      valorCents: null,
    }),
    createEcoItem("GASTO_GENERAL", {
      observacion: "",
      cantidad: null,
      valorCents: null,
    }),
  ];
}

function moveItem(list: EcoItem[], fromId: string, toId: string): EcoItem[] {
  if (fromId === toId) return list;
  const from = list.findIndex((i) => i.id === fromId);
  const to = list.findIndex((i) => i.id === toId);
  if (from < 0 || to < 0) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function EcoTorneoPlanilla({ currency = "ARS" }: { currency?: string }) {
  const [items, setItems] = useState<EcoItem[]>(() => exampleItems());
  const [addFlow, setAddFlow] = useState<EcoFlowType>("ENTRADA");
  const [addCategory, setAddCategory] = useState<EcoCategory>("INSCRIPCIONES");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const planilla = computePlanilla(items);

  function updateItem(id: string, patch: Partial<EcoItem>) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function changeCategory(id: string, category: EcoCategory) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const def = ECO_CATEGORY_DEFS[category];
        return {
          ...item,
          category,
          cantidad: null,
          valorCents: null,
          porcentaje: null,
          enSaldo: def.defaultEnSaldo ?? true,
        };
      }),
    );
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function addItem() {
    setItems((prev) => [...prev, createEcoItem(addCategory)]);
  }

  function onDragStart(id: string, e: React.DragEvent) {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function onDragOverRow(id: string, e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overId !== id) setOverId(id);
  }

  function onDropRow(id: string, e: React.DragEvent) {
    e.preventDefault();
    const fromId = e.dataTransfer.getData("text/plain") || dragId;
    if (fromId) {
      setItems((prev) => moveItem(prev, fromId, id));
    }
    setDragId(null);
    setOverId(null);
  }

  function onDragEnd() {
    setDragId(null);
    setOverId(null);
  }

  const addCategories = categoriesForFlow(addFlow);

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[54rem] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="w-8 px-1 py-2" aria-label="Reordenar" />
              <th
                className="px-2 py-2 text-center font-medium"
                title="Incluir en saldo"
              >
                Saldo
              </th>
              <th className="px-2 py-2 font-medium">Categoría</th>
              <th className="px-2 py-2 font-medium">Observación</th>
              <th className="px-2 py-2 font-medium text-right">Cantidad</th>
              <th className="px-2 py-2 font-medium text-right">Valor / %</th>
              <th className="px-2 py-2 font-medium text-right">Debe</th>
              <th className="px-2 py-2 font-medium text-right">Haber</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {planilla.lines.map(({ item, debeCents, haberCents, restoPct }) => {
              const def = ECO_CATEGORY_DEFS[item.category];
              const flowCats = categoriesForFlow(def.flow);
              const isDragging = dragId === item.id;
              const isOver = overId === item.id && dragId !== item.id;

              return (
                <tr
                  key={item.id}
                  onDragOver={(e) => onDragOverRow(item.id, e)}
                  onDrop={(e) => onDropRow(item.id, e)}
                  className={cn(
                    "border-b last:border-b-0",
                    item.enSaldo === false && "bg-muted/20",
                    isDragging && "opacity-50",
                    isOver && "border-t-2 border-t-primary",
                  )}
                >
                  <td className="px-1 py-1.5 align-middle">
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) => onDragStart(item.id, e)}
                      onDragEnd={onDragEnd}
                      aria-label="Arrastrar para reordenar"
                      className="flex cursor-grab touch-none items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
                    >
                      <GripVertical className="size-4" />
                    </button>
                  </td>
                  <td className="px-2 py-1.5 text-center align-middle">
                    <Checkbox
                      checked={item.enSaldo ?? true}
                      onCheckedChange={(v) =>
                        updateItem(item.id, { enSaldo: v === true })
                      }
                      aria-label="Incluir en saldo"
                    />
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <select
                      className={SELECT_CLASS}
                      value={item.category}
                      onChange={(e) =>
                        changeCategory(item.id, e.target.value as EcoCategory)
                      }
                    >
                      {flowCats.map((key) => (
                        <option key={key} value={key}>
                          {ECO_CATEGORY_DEFS[key].label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {def.flow}
                    </p>
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <Input
                      value={item.observacion}
                      placeholder="Nota…"
                      onChange={(e) =>
                        updateItem(item.id, { observacion: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    {def.formula === "cantidad_x_valor" ? (
                      <Input
                        type="number"
                        min={0}
                        className={INPUT_NUM}
                        value={item.cantidad ?? ""}
                        placeholder="0"
                        onChange={(e) =>
                          updateItem(item.id, {
                            cantidad:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      />
                    ) : (
                      <span className="block text-right text-muted-foreground">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    {def.formula === "cantidad_x_valor" ||
                    def.formula === "valor" ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          className={INPUT_NUM}
                          value={
                            item.valorCents == null
                              ? ""
                              : centsToPesos(item.valorCents)
                          }
                          placeholder="0"
                          onChange={(e) =>
                            updateItem(item.id, {
                              valorCents:
                                e.target.value === ""
                                  ? null
                                  : pesosToCents(Number(e.target.value)),
                            })
                          }
                        />
                        {def.valorLabel ? (
                          <span className="text-[10px] text-muted-foreground">
                            {def.valorLabel}
                          </span>
                        ) : null}
                      </div>
                    ) : def.formula === "pct_inscripciones" ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          className={INPUT_NUM}
                          value={item.porcentaje ?? ""}
                          placeholder="0"
                          onChange={(e) =>
                            updateItem(item.id, {
                              porcentaje:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                        />
                        <span className="text-[10px] text-muted-foreground">
                          % sobre insc.
                        </span>
                      </div>
                    ) : def.formula === "resto_pct_inscripciones" ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <span
                          className={cn(
                            "block w-full min-w-[5.5rem] text-right tabular-nums font-medium",
                            (restoPct ?? 0) < 0 && "text-destructive",
                          )}
                        >
                          {restoPct ?? 0}%
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          resto × insc.
                        </span>
                      </div>
                    ) : (
                      <span className="block text-right text-muted-foreground">
                        —
                      </span>
                    )}
                  </td>
                  <td
                    className={cn(
                      "px-2 py-1.5 text-right align-middle tabular-nums",
                      debeCents > 0 && "font-medium",
                      item.enSaldo === false && "text-muted-foreground",
                    )}
                  >
                    {debeCents > 0 ? formatMoney(debeCents, currency) : "—"}
                  </td>
                  <td
                    className={cn(
                      "px-2 py-1.5 text-right align-middle tabular-nums",
                      haberCents > 0 && "font-medium",
                      item.enSaldo === false && "text-muted-foreground",
                    )}
                  >
                    {haberCents > 0 ? formatMoney(haberCents, currency) : "—"}
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Eliminar ítem"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/30 text-sm font-medium">
              <td className="px-2 py-2" colSpan={6}>
                Totales (ítems en saldo)
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {formatMoney(planilla.totalDebeCents, currency)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {formatMoney(planilla.totalHaberCents, currency)}
              </td>
              <td />
            </tr>
            <tr className="text-sm">
              <td className="px-2 py-2 text-muted-foreground" colSpan={6}>
                Saldo (Debe − Haber)
              </td>
              <td
                className={cn(
                  "px-2 py-2 text-right tabular-nums font-semibold",
                  planilla.saldoCents >= 0
                    ? "text-foreground"
                    : "text-destructive",
                )}
                colSpan={2}
              >
                {formatMoney(planilla.saldoCents, currency)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Tipo</label>
          <select
            className={cn(SELECT_CLASS, "w-36")}
            value={addFlow}
            onChange={(e) => {
              const flow = e.target.value as EcoFlowType;
              setAddFlow(flow);
              const first = categoriesForFlow(flow)[0];
              setAddCategory(first);
            }}
          >
            <option value="ENTRADA">Entrada</option>
            <option value="SALIDA">Salida</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Categoría</label>
          <select
            className={cn(SELECT_CLASS, "w-56")}
            value={addCategory}
            onChange={(e) =>
              setAddCategory(e.target.value as EcoCategory)
            }
          >
            {addCategories.map((key) => (
              <option key={key} value={key}>
                {ECO_CATEGORY_DEFS[key].label}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" variant="outline" onClick={addItem}>
          <Plus className="size-4" />
          Agregar ítem
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Arrastrá el ícono ⋮⋮ para reordenar. La columna Saldo decide si el ítem
        entra en totales. Uso canchas es informativo (tilde off por defecto):{" "}
        {planilla.restoPct}% de{" "}
        {formatMoney(planilla.inscripcionesTotalCents, currency)}. Todavía no se
        guarda.
      </p>
    </div>
  );
}
