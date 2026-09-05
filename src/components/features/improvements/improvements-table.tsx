"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createImprovementAction,
  deleteImprovementAction,
  updateImprovementAction,
  updateImprovementStatusAction,
} from "@/app/(dashboard)/[clubSlug]/que-mejoro/actions";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import {
  IMPROVEMENT_KIND_LABELS,
  IMPROVEMENT_KINDS,
  IMPROVEMENT_STATUS_LABELS,
  IMPROVEMENT_STATUSES,
  type ImprovementItem,
  type ImprovementValues,
} from "@/modules/improvements/domain/schema";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const KIND_TONE: Record<ImprovementValues["kind"], string> = {
  IMPROVE:
    "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
  ADD: "border-teal-200 bg-teal-50 text-teal-950 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-100",
};

const STATUS_TONE: Record<ImprovementValues["status"], string> = {
  PENDING: "text-muted-foreground",
  IN_PROGRESS: "text-amber-700 dark:text-amber-300",
  DONE: "text-teal-700 dark:text-teal-300",
};

const EMPTY_FORM: ImprovementValues = {
  title: "",
  detail: "",
  kind: "IMPROVE",
  status: "PENDING",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ImprovementFormFields({
  idPrefix,
  values,
  onChange,
}: {
  idPrefix: string;
  values: ImprovementValues;
  onChange: (values: ImprovementValues) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-kind`}>Tipo</Label>
          <select
            id={`${idPrefix}-kind`}
            className={SELECT_CLASS}
            value={values.kind}
            onChange={(event) =>
              onChange({
                ...values,
                kind: event.target.value as ImprovementValues["kind"],
              })
            }
          >
            {IMPROVEMENT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {IMPROVEMENT_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-status`}>Estado</Label>
          <select
            id={`${idPrefix}-status`}
            className={SELECT_CLASS}
            value={values.status}
            onChange={(event) =>
              onChange({
                ...values,
                status: event.target.value as ImprovementValues["status"],
              })
            }
          >
            {IMPROVEMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {IMPROVEMENT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-title`}>Qué</Label>
        <Input
          id={`${idPrefix}-title`}
          value={values.title}
          onChange={(event) =>
            onChange({ ...values, title: event.target.value })
          }
          placeholder="Ej: exportar partidos del día a WhatsApp"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-detail`}>Detalle</Label>
        <textarea
          id={`${idPrefix}-detail`}
          value={values.detail ?? ""}
          onChange={(event) =>
            onChange({ ...values, detail: event.target.value })
          }
          placeholder="Opcional: cómo lo imaginas o por qué importa"
          rows={3}
          className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
    </div>
  );
}

export function ImprovementsTable({
  clubSlug,
  items,
}: {
  clubSlug: string;
  items: ImprovementItem[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<ImprovementValues>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.title, item.detail ?? "", IMPROVEMENT_KIND_LABELS[item.kind]]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [items, query]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(item: ImprovementItem) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      detail: item.detail ?? "",
      kind: item.kind,
      status: item.status,
    });
    setDialogOpen(true);
  }

  function save() {
    startTransition(async () => {
      const result = editingId
        ? await updateImprovementAction(clubSlug, editingId, form)
        : await createImprovementAction(clubSlug, form);
      if (result.ok) {
        toast.success(editingId ? "Idea actualizada" : "Idea agregada");
        setDialogOpen(false);
        router.refresh();
      } else {
        toast.error("No se pudo guardar", { description: result.error });
      }
    });
  }

  function changeStatus(item: ImprovementItem, status: ImprovementValues["status"]) {
    if (status === item.status) return;
    startTransition(async () => {
      const result = await updateImprovementStatusAction(
        clubSlug,
        item.id,
        status,
      );
      if (result.ok) router.refresh();
      else toast.error("No se pudo cambiar el estado", { description: result.error });
    });
  }

  function remove(item: ImprovementItem) {
    const ok = window.confirm(
      `¿Eliminar “${item.title}”?\n\nEsta acción no se puede deshacer.`,
    );
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteImprovementAction(clubSlug, item.id);
      if (result.ok) {
        toast.success("Idea eliminada");
        router.refresh();
      } else {
        toast.error("No se pudo eliminar", { description: result.error });
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar idea..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Nueva idea
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Qué</th>
              <th className="px-3 py-2 font-medium">Detalle</th>
              <th className="w-36 px-3 py-2 font-medium">Estado</th>
              <th className="w-28 px-3 py-2 font-medium">Fecha</th>
              <th className="w-20 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  <Lightbulb className="mx-auto mb-2 size-5 opacity-60" />
                  {items.length === 0
                    ? "Todavía no hay ideas. Cargá la primera con Nueva idea."
                    : "Ninguna idea coincide con la búsqueda."}
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium",
                        KIND_TONE[item.kind],
                      )}
                    >
                      {IMPROVEMENT_KIND_LABELS[item.kind]}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium">{item.title}</td>
                  <td className="max-w-xs px-3 py-2 text-muted-foreground">
                    <span className="line-clamp-2">{item.detail || "—"}</span>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className={cn(SELECT_CLASS, STATUS_TONE[item.status])}
                      value={item.status}
                      disabled={pending}
                      onChange={(event) =>
                        changeStatus(
                          item,
                          event.target.value as ImprovementValues["status"],
                        )
                      }
                    >
                      {IMPROVEMENT_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {IMPROVEMENT_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatDate(item.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Editar"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Eliminar"
                        disabled={pending}
                        onClick={() => remove(item)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar idea" : "Nueva idea"}
            </DialogTitle>
            <DialogDescription>
              Cargá algo que quieras mejorar o agregar.
            </DialogDescription>
          </DialogHeader>
          <ImprovementFormFields
            idPrefix={editingId ? "edit" : "new"}
            values={form}
            onChange={setForm}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={pending} onClick={save}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
