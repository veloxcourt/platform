"use client";

import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { saveSimulationItemsAction } from "@/app/(dashboard)/[clubSlug]/herramientas/eco-torneo/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, pesosToCents, centsToPesos } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  ECO_CATEGORY_DEFS,
  categoriesForFlow,
  computeGroupSaldoCents,
  computePlanilla,
  createEcoGroup,
  createEcoItem,
  nextGroupName,
  type EcoCategory,
  type EcoFlowType,
  type EcoGroup,
  type EcoItem,
} from "@/modules/herramientas/domain/eco-torneo";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const INPUT_NUM =
  "h-8 w-full min-w-[5.5rem] text-right tabular-nums";

const AUTOSAVE_MS = 500;

type SaveStatus = "idle" | "saving" | "saved" | "error";

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

export function EcoTorneoPlanilla({
  clubSlug,
  simulationId,
  currency = "ARS",
  initialItems,
  initialGroups = [],
}: {
  clubSlug: string;
  simulationId: string;
  currency?: string;
  initialItems: EcoItem[];
  initialGroups?: EcoGroup[];
}) {
  const [items, setItems] = useState<EcoItem[]>(initialItems);
  const [groups, setGroups] = useState<EcoGroup[]>(initialGroups);
  const [addFlow, setAddFlow] = useState<EcoFlowType>("ENTRADA");
  const [addCategory, setAddCategory] = useState<EcoCategory>("INSCRIPCIONES");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [groupItemIds, setGroupItemIds] = useState<string[]>([]);

  const itemsRef = useRef(items);
  const groupsRef = useRef(groups);
  const dirtyRef = useRef(false);
  const skipNextSaveRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  useEffect(() => {
    setItems(initialItems);
    setGroups(initialGroups);
    dirtyRef.current = false;
    skipNextSaveRef.current = true;
    setSaveStatus("idle");
    // Solo al cambiar de simulación; no resetear tras refresh/rename.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [simulationId]);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const snapshot = itemsRef.current;
      const groupsSnapshot = groupsRef.current;
      setSaveStatus("saving");
      void saveSimulationItemsAction(
        clubSlug,
        simulationId,
        snapshot,
        groupsSnapshot,
      ).then(
        (result) => {
          if (!result.ok) {
            setSaveStatus("error");
            toast.error(result.error);
            return;
          }
          dirtyRef.current = false;
          setSaveStatus("saved");
        },
      );
    }, AUTOSAVE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [items, groups, clubSlug, simulationId]);

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
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        itemIds: group.itemIds.filter((itemId) => itemId !== id),
      })),
    );
  }

  function openCreateGroup() {
    setEditingGroupId(null);
    setGroupNameDraft(nextGroupName(groups.map((group) => group.name)));
    setGroupItemIds([]);
    setGroupDialogOpen(true);
  }

  function openEditGroup(group: EcoGroup) {
    setEditingGroupId(group.id);
    setGroupNameDraft(group.name);
    setGroupItemIds(group.itemIds.filter((id) => items.some((item) => item.id === id)));
    setGroupDialogOpen(true);
  }

  function toggleGroupItem(id: string, checked: boolean) {
    setGroupItemIds((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((itemId) => itemId !== id),
    );
  }

  function confirmGroup() {
    if (groupItemIds.length === 0) {
      toast.error("Elegí al menos una fila para el grupo");
      return;
    }
    const name = groupNameDraft.trim() || nextGroupName(groups.map((g) => g.name));
    if (editingGroupId) {
      setGroups((prev) =>
        prev.map((group) =>
          group.id === editingGroupId
            ? { ...group, name, itemIds: groupItemIds }
            : group,
        ),
      );
    } else {
      setGroups((prev) => [
        ...prev,
        createEcoGroup(groupItemIds, prev.map((group) => group.name), name),
      ]);
    }
    setGroupDialogOpen(false);
  }

  function deleteGroup(id: string) {
    setGroups((prev) => prev.filter((group) => group.id !== id));
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
                    item.enSaldo === false
                      ? "bg-red-50 dark:bg-red-950/40"
                      : "bg-emerald-50 dark:bg-emerald-950/30",
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

      <div className="flex flex-wrap items-stretch gap-2">
        <Button type="button" variant="outline" onClick={openCreateGroup}>
          <Plus className="size-4" />
          Crear Grupo
        </Button>
        {groups.map((group) => {
          const saldo = computeGroupSaldoCents(group, planilla.lines);
          return (
            <div
              key={group.id}
              className="flex min-w-[11rem] items-center gap-2 rounded-lg border bg-background px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-muted-foreground">
                  {group.name}
                </p>
                <p
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    saldo < 0 && "text-destructive",
                  )}
                >
                  {formatMoney(saldo, currency)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Editar ${group.name}`}
                onClick={() => openEditGroup(group)}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Eliminar ${group.name}`}
                onClick={() => deleteGroup(group.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          );
        })}
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
        <p className="ml-auto text-xs text-muted-foreground">
          {saveStatus === "saving"
            ? "Guardando…"
            : saveStatus === "saved"
              ? "Guardado"
              : saveStatus === "error"
                ? "Error al guardar"
                : null}
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Arrastrá el ícono ⋮⋮ para reordenar. La columna Saldo decide si el ítem
        entra en totales. Uso canchas es informativo (tilde off por defecto):{" "}
        {planilla.restoPct}% de{" "}
        {formatMoney(planilla.inscripcionesTotalCents, currency)}. Clic en la
        pestaña activa para renombrar. Los cambios se guardan solos.
      </p>

      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingGroupId ? "Editar grupo" : "Crear grupo"}
            </DialogTitle>
            <DialogDescription>
              Elegí las filas que suman y restan en el saldo del grupo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="eco-group-name">Nombre</Label>
              <Input
                id="eco-group-name"
                value={groupNameDraft}
                onChange={(event) => setGroupNameDraft(event.target.value)}
                maxLength={80}
              />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border">
              {planilla.lines.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">
                  No hay filas para agrupar.
                </p>
              ) : (
                planilla.lines.map(({ item, debeCents, haberCents }) => {
                  const def = ECO_CATEGORY_DEFS[item.category];
                  const amount = debeCents - haberCents;
                  return (
                    <label
                      key={item.id}
                      className="flex cursor-pointer items-center gap-2 border-b px-3 py-2 last:border-b-0 hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={groupItemIds.includes(item.id)}
                        onCheckedChange={(value) =>
                          toggleGroupItem(item.id, value === true)
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {def.label}
                        </span>
                        {item.observacion ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.observacion}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-sm tabular-nums",
                          amount < 0 && "text-destructive",
                        )}
                      >
                        {formatMoney(amount, currency)}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            <p className="text-sm">
              Saldo del grupo:{" "}
              <span className="font-semibold tabular-nums">
                {formatMoney(
                  computeGroupSaldoCents(
                    { id: "draft", name: "draft", itemIds: groupItemIds },
                    planilla.lines,
                  ),
                  currency,
                )}
              </span>
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setGroupDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={confirmGroup}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
