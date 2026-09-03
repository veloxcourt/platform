"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
} from "react";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarRange,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Filter,
  GripVertical,
  Layers,
  Minus,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StableTabButton } from "@/components/ui/stable-tab-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createCalendarCategoryAction,
  createCalendarSearchLinkAction,
  createCalendarVenueAction,
  createPlannedTournamentAction,
  deleteCalendarCategoryAction,
  deleteCalendarSearchLinkAction,
  deleteCalendarVenueAction,
  deletePlannedTournamentAction,
  reorderCalendarVenuesAction,
  updateCalendarCategoryAction,
  updateCalendarSearchLinkAction,
  updateCalendarSettingsAction,
  updateCalendarVenueAction,
  updatePlannedTournamentAction,
} from "@/app/(dashboard)/[clubSlug]/herramientas/calendario/actions";
import { CatalogCategoryCreateForm } from "@/components/features/categorias/catalog-category-create-form";
import { addDaysISO, formatShortDate, getWeekEndISO, todayISO } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  DEFAULT_TOURNAMENT_SEARCH_LINKS,
  nextPaletteColor,
  type CalendarClub,
  type CalendarSearchLink,
  type CatalogCategory,
  type PlannedTournament,
} from "@/modules/herramientas/domain/calendario-torneos";

type PanelTab = "timeline" | "clubes" | "categorias" | "busqueda";

const MIN_ZOOM_MONTHS = 2;
const MAX_ZOOM_MONTHS = 6;
const DEFAULT_ZOOM_MONTHS = 3;
/** Ancho del viewport ≈ N meses; el track es más largo para scrollear. */
const TRACK_MONTHS = 18;
const DAY_BASE_PX = 28;

/** Un color por mes (ene–dic) para distinguir cortes en el encabezado. */
const MONTH_HEADER_SHADES = [
  "bg-sky-200 text-sky-950 dark:bg-sky-800 dark:text-sky-50",
  "bg-violet-200 text-violet-950 dark:bg-violet-800 dark:text-violet-50",
  "bg-emerald-200 text-emerald-950 dark:bg-emerald-800 dark:text-emerald-50",
  "bg-amber-200 text-amber-950 dark:bg-amber-800 dark:text-amber-50",
  "bg-rose-200 text-rose-950 dark:bg-rose-800 dark:text-rose-50",
  "bg-cyan-200 text-cyan-950 dark:bg-cyan-800 dark:text-cyan-50",
  "bg-lime-200 text-lime-950 dark:bg-lime-800 dark:text-lime-50",
  "bg-yellow-300 text-yellow-950 dark:bg-yellow-700 dark:text-yellow-50",
  "bg-red-300 text-red-950 dark:bg-red-800 dark:text-red-50",
  "bg-green-300 text-green-950 dark:bg-green-800 dark:text-green-50",
  "bg-orange-200 text-orange-950 dark:bg-orange-800 dark:text-orange-50",
  "bg-indigo-200 text-indigo-950 dark:bg-indigo-800 dark:text-indigo-50",
] as const;

function monthHeaderShade(date: Date) {
  return MONTH_HEADER_SHADES[date.getMonth()]!;
}

function moveById<T extends { id: string }>(
  list: T[],
  fromId: string,
  toId: string,
): T[] {
  const from = list.findIndex((item) => item.id === fromId);
  const to = list.findIndex((item) => item.id === toId);
  if (from < 0 || to < 0 || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

function moveByDelta<T>(list: T[], index: number, delta: number): T[] {
  const nextIndex = index + delta;
  if (index < 0 || nextIndex < 0 || nextIndex >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item!);
  return next;
}

function sortCategoriesAlpha(categories: CatalogCategory[]): CatalogCategory[] {
  return [...categories].sort((a, b) =>
    a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
  );
}

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Viernes, sábado o domingo (días Disponibles). */
function isLibreWeekday(date: Date): boolean {
  const day = date.getDay();
  return day === 5 || day === 6 || day === 0;
}

function libreDayLetter(date: Date): "V" | "S" | "D" {
  const day = date.getDay();
  if (day === 5) return "V";
  if (day === 6) return "S";
  return "D";
}

/** Viernes del fin de semana (V/S/D) que contiene la fecha. */
function fridayISOOf(date: Date): string {
  const iso = format(date, "yyyy-MM-dd");
  const day = date.getDay();
  if (day === 5) return iso;
  if (day === 6) return addDaysISO(iso, -1);
  return addDaysISO(iso, -2);
}

function coversDate(tournament: PlannedTournament, dateISO: string): boolean {
  return tournament.startDate <= dateISO && dateISO <= tournament.endDate;
}

function weekendIsOccupied(
  clubTournaments: PlannedTournament[],
  fridayISO: string,
): boolean {
  const saturdayISO = addDaysISO(fridayISO, 1);
  const sundayISO = addDaysISO(fridayISO, 2);
  return clubTournaments.some(
    (t) =>
      coversDate(t, fridayISO) ||
      coversDate(t, saturdayISO) ||
      coversDate(t, sundayISO),
  );
}

export function CalendarioTorneosView({
  clubSlug,
  initialClubs,
  initialCategories,
  initialTournaments,
  initialLibreFill,
  initialLibreBorder,
  initialSearchLinks,
}: {
  clubSlug: string;
  initialClubs: CalendarClub[];
  initialCategories: CatalogCategory[];
  initialTournaments: PlannedTournament[];
  initialLibreFill: string;
  initialLibreBorder: string;
  initialSearchLinks: CalendarSearchLink[];
}) {
  const [panel, setPanel] = useState<PanelTab>("timeline");
  const [zoomMonths, setZoomMonths] = useState(DEFAULT_ZOOM_MONTHS);
  const [clubs, setClubs] = useState<CalendarClub[]>(initialClubs);
  const [categories, setCategories] =
    useState<CatalogCategory[]>(initialCategories);
  const [tournaments, setTournaments] =
    useState<PlannedTournament[]>(initialTournaments);
  const [searchLinks, setSearchLinks] =
    useState<CalendarSearchLink[]>(initialSearchLinks);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftClubId, setDraftClubId] = useState("");
  const [draftStart, setDraftStart] = useState(todayISO());
  const [draftEnd, setDraftEnd] = useState(() => getWeekEndISO(todayISO()));
  const [draftStartOnly, setDraftStartOnly] = useState(true);
  const [draftCategoryIds, setDraftCategoryIds] = useState<string[]>([]);
  const [showTorneoLibre, setShowTorneoLibre] = useState(true);
  const [libreFill, setLibreFill] = useState(initialLibreFill);
  const [libreBorder, setLibreBorder] = useState(initialLibreBorder);
  const [colorFormOpen, setColorFormOpen] = useState(false);
  const [colorFill, setColorFill] = useState(initialLibreFill);
  const [colorBorder, setColorBorder] = useState(initialLibreBorder);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>([]);
  const [draftFilterIds, setDraftFilterIds] = useState<string[]>([]);
  const [hidePast, setHidePast] = useState(true);
  const [draftHidePast, setDraftHidePast] = useState(true);

  const trackStart = useMemo(
    () => startOfMonth(addMonths(new Date(), -3)),
    [],
  );
  const trackEnd = useMemo(
    () => startOfMonth(addMonths(trackStart, TRACK_MONTHS)),
    [trackStart],
  );

  const days = useMemo(
    () => eachDayOfInterval({ start: trackStart, end: addDays(trackEnd, -1) }),
    [trackStart, trackEnd],
  );

  const months = useMemo(
    () => eachMonthOfInterval({ start: trackStart, end: addDays(trackEnd, -1) }),
    [trackStart, trackEnd],
  );

  const dayWidth = (DAY_BASE_PX * DEFAULT_ZOOM_MONTHS) / zoomMonths;
  const trackWidth = days.length * dayWidth;

  const sortedCategories = useMemo(
    () => sortCategoriesAlpha(categories),
    [categories],
  );
  const usedCategories = useMemo(() => {
    const used = new Set<string>();
    for (const tournament of tournaments) {
      for (const id of tournament.categoryIds) used.add(id);
    }
    return sortCategoriesAlpha(categories.filter((c) => used.has(c.id)));
  }, [tournaments, categories]);
  const usedCategoryIds = useMemo(
    () => new Set(usedCategories.map((c) => c.id)),
    [usedCategories],
  );
  const activeFilterIds = useMemo(
    () => filterCategoryIds.filter((id) => usedCategoryIds.has(id)),
    [filterCategoryIds, usedCategoryIds],
  );
  const filterCategories = useMemo(
    () => usedCategories.filter((c) => activeFilterIds.includes(c.id)),
    [usedCategories, activeFilterIds],
  );
  const visibleTournaments = useMemo(() => {
    const today = todayISO();
    return tournaments.filter((t) => {
      if (hidePast && t.endDate < today) return false;
      if (activeFilterIds.length === 0) return true;
      const selected = new Set(activeFilterIds);
      return t.categoryIds.some((id) => selected.has(id));
    });
  }, [tournaments, activeFilterIds, hidePast]);

  function closeTournamentForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  function fillDraft(tournament?: PlannedTournament) {
    if (!tournament) {
      setEditingId(null);
      setDraftName("");
      setDraftClubId(clubs[0]!.id);
      const start = todayISO();
      setDraftStart(start);
      setDraftEnd(getWeekEndISO(start));
      setDraftStartOnly(true);
      setDraftCategoryIds([]);
      return;
    }
    setEditingId(tournament.id);
    setDraftName(tournament.name);
    setDraftClubId(tournament.clubId);
    setDraftStart(tournament.startDate);
    setDraftEnd(tournament.endDate);
    setDraftStartOnly(tournament.endDate === getWeekEndISO(tournament.startDate));
    setDraftCategoryIds([...tournament.categoryIds]);
  }

  function openAddTournament(preset?: { clubId?: string; startDate?: string }) {
    if (clubs.length === 0) {
      toast.error("Agregá al menos un club en la pestaña Clubes");
      setPanel("clubes");
      return;
    }
    fillDraft();
    if (preset?.clubId) setDraftClubId(preset.clubId);
    if (preset?.startDate) {
      setDraftStart(preset.startDate);
      setDraftStartOnly(true);
      setDraftEnd(getWeekEndISO(preset.startDate));
    }
    setFormOpen(true);
  }

  function openEditTournament(tournament: PlannedTournament) {
    if (clubs.length === 0) {
      toast.error("Agregá al menos un club en la pestaña Clubes");
      setPanel("clubes");
      return;
    }
    fillDraft(tournament);
    setFormOpen(true);
  }

  async function submitTournament() {
    const name = draftName.trim();
    if (!draftClubId) {
      toast.error("Elegí un club");
      return;
    }
    if (categories.length > 0 && draftCategoryIds.length === 0) {
      toast.error("Elegí al menos una categoría");
      return;
    }
    const endDate = draftStartOnly ? getWeekEndISO(draftStart) : draftEnd;
    if (endDate < draftStart) {
      toast.error("La fecha de fin no puede ser anterior al inicio");
      return;
    }
    const payload = {
      name,
      clubId: draftClubId,
      startDate: draftStart,
      endDate,
      categoryIds: draftCategoryIds,
    };
    if (editingId) {
      const result = await updatePlannedTournamentAction(
        clubSlug,
        editingId,
        payload,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTournaments((prev) =>
        prev.map((t) => (t.id === editingId ? result.data : t)),
      );
      closeTournamentForm();
      toast.success("Torneo actualizado");
      return;
    }
    const result = await createPlannedTournamentAction(clubSlug, payload);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setTournaments((prev) => [...prev, result.data]);
    closeTournamentForm();
    toast.success("Torneo agregado al timeline");
  }

  function openLibreColors() {
    setColorFill(libreFill);
    setColorBorder(libreBorder);
    setColorFormOpen(true);
  }

  async function saveLibreColors() {
    const result = await updateCalendarSettingsAction(clubSlug, {
      libreFill: colorFill,
      libreBorder: colorBorder,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setLibreFill(result.data.libreFill);
    setLibreBorder(result.data.libreBorder);
    setColorFormOpen(false);
    toast.success("Colores actualizados");
  }

  async function removeTournament(id: string) {
    const result = await deletePlannedTournamentAction(clubSlug, id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setTournaments((prev) => prev.filter((t) => t.id !== id));
  }

  function openCategoryFilter() {
    setDraftFilterIds(
      activeFilterIds.filter((id) => usedCategoryIds.has(id)),
    );
    setDraftHidePast(hidePast);
    setFilterOpen(true);
  }

  function applyCategoryFilter() {
    setFilterCategoryIds(
      draftFilterIds.filter((id) => usedCategoryIds.has(id)),
    );
    setHidePast(draftHidePast);
    setFilterOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Los clubes, categorías y torneos se guardan en el club.
      </p>

      <div
        className="flex w-full min-w-0 items-center gap-2 overflow-x-auto"
        role="tablist"
        aria-label="Secciones del calendario"
      >
        <StableTabButton
          active={panel === "timeline"}
          onSelect={() => setPanel("timeline")}
        >
          <CalendarRange />
          Timeline
        </StableTabButton>
        <StableTabButton
          active={panel === "clubes"}
          onSelect={() => setPanel("clubes")}
        >
          <Users />
          Clubes
        </StableTabButton>
        <StableTabButton
          active={panel === "categorias"}
          onSelect={() => setPanel("categorias")}
        >
          <Layers />
          Categorías
        </StableTabButton>
        <StableTabButton
          active={panel === "busqueda"}
          onSelect={() => setPanel("busqueda")}
        >
          <Search />
          Búsqueda
        </StableTabButton>
      </div>

      {panel === "timeline" ? (
        <TimelinePanel
          zoomMonths={zoomMonths}
          setZoomMonths={setZoomMonths}
          dayWidth={dayWidth}
          trackWidth={trackWidth}
          days={days}
          months={months}
          trackStart={trackStart}
          clubs={clubs}
          categories={categories}
          tournaments={visibleTournaments}
          filterCategories={filterCategories}
          hidePast={hidePast}
          onOpenFilter={openCategoryFilter}
          onRemoveFilter={(id) =>
            setFilterCategoryIds((prev) => prev.filter((x) => x !== id))
          }
          onClearHidePast={() => setHidePast(false)}
          onRemoveTournament={removeTournament}
          onAddTournament={openAddTournament}
          onEditTournament={openEditTournament}
          showTorneoLibre={showTorneoLibre}
          onToggleTorneoLibre={setShowTorneoLibre}
          libreFill={libreFill}
          libreBorder={libreBorder}
          onOpenLibreColors={openLibreColors}
          onMoveClub={async (id, delta) => {
            const index = clubs.findIndex((c) => c.id === id);
            const next = moveByDelta(clubs, index, delta);
            if (next === clubs) return;
            const previous = clubs;
            setClubs(next);
            const result = await reorderCalendarVenuesAction(
              clubSlug,
              next.map((c) => c.id),
            );
            if (!result.ok) {
              setClubs(previous);
              toast.error(result.error);
            }
          }}
        />
      ) : null}

      {panel === "clubes" ? (
        <ClubsCrud
          clubs={clubs}
          onCreate={async (input) => {
            const result = await createCalendarVenueAction(clubSlug, input);
            if (!result.ok) {
              toast.error(result.error);
              return null;
            }
            setClubs((prev) => [...prev, result.data]);
            return result.data;
          }}
          onUpdate={async (id, input) => {
            const result = await updateCalendarVenueAction(
              clubSlug,
              id,
              input,
            );
            if (!result.ok) {
              toast.error(result.error);
              return false;
            }
            setClubs((prev) =>
              prev.map((c) => (c.id === id ? result.data : c)),
            );
            return true;
          }}
          onDelete={async (id) => {
            const result = await deleteCalendarVenueAction(clubSlug, id);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            setClubs((prev) => prev.filter((c) => c.id !== id));
            setTournaments((prev) => prev.filter((t) => t.clubId !== id));
          }}
          onReorder={async (next) => {
            const previous = clubs;
            setClubs(next);
            const result = await reorderCalendarVenuesAction(
              clubSlug,
              next.map((c) => c.id),
            );
            if (!result.ok) {
              setClubs(previous);
              toast.error(result.error);
            }
          }}
        />
      ) : null}

      {panel === "busqueda" ? (
        <SearchPanel
          clubs={clubs}
          categories={sortedCategories}
          tournaments={tournaments}
          customLinks={searchLinks}
          onAddTournament={() => openAddTournament()}
          onEditTournament={openEditTournament}
          onCreateLink={async (input) => {
            const result = await createCalendarSearchLinkAction(
              clubSlug,
              input,
            );
            if (!result.ok) {
              toast.error(result.error);
              return null;
            }
            setSearchLinks((prev) => [...prev, result.data]);
            return result.data;
          }}
          onUpdateLink={async (id, input) => {
            const result = await updateCalendarSearchLinkAction(
              clubSlug,
              id,
              input,
            );
            if (!result.ok) {
              toast.error(result.error);
              return false;
            }
            setSearchLinks((prev) =>
              prev.map((l) => (l.id === id ? result.data : l)),
            );
            return true;
          }}
          onDeleteLink={async (id) => {
            const result = await deleteCalendarSearchLinkAction(clubSlug, id);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            setSearchLinks((prev) => prev.filter((l) => l.id !== id));
          }}
        />
      ) : null}

      {panel === "categorias" ? (
        <CategoriesCrud
          categories={sortedCategories}
          onCreate={async (input) => {
            const result = await createCalendarCategoryAction(
              clubSlug,
              input,
            );
            if (!result.ok) {
              toast.error(result.error);
              return null;
            }
            setCategories((prev) => [...prev, result.data]);
            return result.data;
          }}
          onUpdate={async (id, input) => {
            const result = await updateCalendarCategoryAction(
              clubSlug,
              id,
              input,
            );
            if (!result.ok) {
              toast.error(result.error);
              return false;
            }
            setCategories((prev) =>
              prev.map((c) => (c.id === id ? result.data : c)),
            );
            return true;
          }}
          onDelete={async (id) => {
            const result = await deleteCalendarCategoryAction(clubSlug, id);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            setCategories((prev) => prev.filter((c) => c.id !== id));
            setTournaments((prev) =>
              prev.map((t) => ({
                ...t,
                categoryIds: t.categoryIds.filter((catId) => catId !== id),
              })),
            );
          }}
        />
      ) : null}

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (open) setFormOpen(true);
          else closeTournamentForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar torneo" : "Agregar torneo"}
            </DialogTitle>
            <DialogDescription>
              Se muestra en el timeline con el color del club.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cal-torneo-name">Nombre (opcional)</Label>
              <Input
                id="cal-torneo-name"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Ej. Open de otoño"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cal-torneo-club">Club</Label>
              <select
                id="cal-torneo-club"
                className={SELECT_CLASS}
                value={draftClubId}
                onChange={(e) => setDraftClubId(e.target.value)}
              >
                {clubs.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={draftStartOnly}
                onCheckedChange={(v) => {
                  const on = v === true;
                  setDraftStartOnly(on);
                  if (on) setDraftEnd(getWeekEndISO(draftStart));
                }}
              />
              Solo Fecha Inicio
            </label>
            {draftStartOnly ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cal-torneo-start">Fecha de inicio</Label>
                <Input
                  id="cal-torneo-start"
                  type="date"
                  value={draftStart}
                  onChange={(e) => {
                    const next = e.target.value;
                    setDraftStart(next);
                    setDraftEnd(getWeekEndISO(next));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Se extiende hasta el domingo{" "}
                  {formatShortDate(getWeekEndISO(draftStart))}.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cal-torneo-start">Desde</Label>
                  <Input
                    id="cal-torneo-start"
                    type="date"
                    value={draftStart}
                    onChange={(e) => setDraftStart(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cal-torneo-end">Hasta</Label>
                  <Input
                    id="cal-torneo-end"
                    type="date"
                    value={draftEnd}
                    onChange={(e) => setDraftEnd(e.target.value)}
                  />
                </div>
              </div>
            )}
            {categories.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <Label>Categorías</Label>
                <div className="flex flex-wrap gap-2">
                  {sortedCategories.map((cat) => {
                    const checked = draftCategoryIds.includes(cat.id);
                    return (
                      <label
                        key={cat.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setDraftCategoryIds((prev) =>
                              v === true
                                ? [...prev, cat.id]
                                : prev.filter((id) => id !== cat.id),
                            );
                          }}
                        />
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span>
                          {cat.name}
                          <span className="ml-1 text-muted-foreground">
                            ({cat.abbreviation})
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={closeTournamentForm}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={submitTournament}>
                {editingId ? "Guardar" : "Agregar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={colorFormOpen} onOpenChange={setColorFormOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Colores de Disponibles</DialogTitle>
            <DialogDescription>
              Marcan los fines de semana sin torneo, disponibles para cargar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div
              className="flex h-12 items-center justify-center rounded-md border-2 text-xs font-bold"
              style={{
                backgroundColor: colorFill,
                borderColor: colorBorder,
                color: colorBorder,
              }}
            >
              V · S · D
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="libre-fill">Color de relleno</Label>
                <Input
                  id="libre-fill"
                  type="color"
                  value={colorFill}
                  onChange={(e) => setColorFill(e.target.value)}
                  className="h-8 w-full cursor-pointer p-1"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="libre-border">Color de contorno</Label>
                <Input
                  id="libre-border"
                  type="color"
                  value={colorBorder}
                  onChange={(e) => setColorBorder(e.target.value)}
                  className="h-8 w-full cursor-pointer p-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setColorFormOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={saveLibreColors}>
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filtrar</DialogTitle>
            <DialogDescription>
              Solo aparecen categorías que ya están en el calendario. Si no
              tildás ninguna, se muestran todas las que hay.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="flex cursor-pointer items-start gap-2 rounded-md border px-2 py-2 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={draftHidePast}
                onCheckedChange={(v) => setDraftHidePast(v === true)}
              />
              <span>
                Ocultar torneos anteriores a hoy
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  De hoy para atrás quedan invisibles. Destildá para ver el
                  historial.
                </span>
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {usedCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no hay categorías usadas en el calendario.
                </p>
              ) : (
                usedCategories.map((cat) => {
                  const checked = draftFilterIds.includes(cat.id);
                  return (
                    <label
                      key={cat.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          setDraftFilterIds((prev) =>
                            v === true
                              ? [...prev, cat.id]
                              : prev.filter((id) => id !== cat.id),
                          );
                        }}
                      />
                      <span
                        className="size-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span>
                        {cat.name}
                        <span className="ml-1 text-muted-foreground">
                          ({cat.abbreviation})
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDraftFilterIds([]);
                  setFilterCategoryIds([]);
                  setDraftHidePast(true);
                  setHidePast(true);
                  setFilterOpen(false);
                }}
              >
                Limpiar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFilterOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={applyCategoryFilter}>
                Aplicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TimelinePanel({
  zoomMonths,
  setZoomMonths,
  dayWidth,
  trackWidth,
  days,
  months,
  trackStart,
  clubs,
  categories,
  tournaments,
  filterCategories,
  hidePast,
  onOpenFilter,
  onRemoveFilter,
  onClearHidePast,
  onRemoveTournament,
  onAddTournament,
  onEditTournament,
  showTorneoLibre,
  onToggleTorneoLibre,
  libreFill,
  libreBorder,
  onOpenLibreColors,
  onMoveClub,
}: {
  zoomMonths: number;
  setZoomMonths: (n: number | ((prev: number) => number)) => void;
  dayWidth: number;
  trackWidth: number;
  days: Date[];
  months: Date[];
  trackStart: Date;
  clubs: CalendarClub[];
  categories: CatalogCategory[];
  tournaments: PlannedTournament[];
  filterCategories: CatalogCategory[];
  hidePast: boolean;
  onOpenFilter: () => void;
  onRemoveFilter: (id: string) => void;
  onClearHidePast: () => void;
  onRemoveTournament: (id: string) => void;
  onAddTournament: (preset?: {
    clubId?: string;
    startDate?: string;
  }) => void;
  onEditTournament: (tournament: PlannedTournament) => void;
  showTorneoLibre: boolean;
  onToggleTorneoLibre: (on: boolean) => void;
  libreFill: string;
  libreBorder: string;
  onOpenLibreColors: () => void;
  onMoveClub: (id: string, delta: -1 | 1) => void;
}) {
  const today = startOfDay(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startScroll: number;
    moved: boolean;
    clubId: string | null;
    startDate: string | null;
  } | null>(null);
  const [panning, setPanning] = useState(false);
  const PAN_THRESHOLD_PX = 6;

  function isPanBlocked(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest("[data-no-pan]"));
  }

  function cellFromTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) return null;
    const el = target.closest("[data-club-id][data-date]");
    if (!(el instanceof HTMLElement)) return null;
    const clubId = el.dataset.clubId;
    const startDate = el.dataset.date;
    if (!clubId || !startDate) return null;
    return { clubId, startDate };
  }

  function endPan(pointerId: number) {
    const el = scrollRef.current;
    if (panRef.current?.pointerId === pointerId) {
      panRef.current = null;
      setPanning(false);
    }
    if (el?.hasPointerCapture(pointerId)) {
      el.releasePointerCapture(pointerId);
    }
  }

  function onTrackPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    if (isPanBlocked(e.target)) return;
    const el = scrollRef.current;
    if (!el) return;
    const cell = cellFromTarget(e.target);
    panRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      moved: false,
      clubId: cell?.clubId ?? null,
      startDate: cell?.startDate ?? null,
    };
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onTrackPointerMove(e: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    const el = scrollRef.current;
    if (!pan || !el || e.pointerId !== pan.pointerId) return;
    const dx = e.clientX - pan.startX;
    if (!pan.moved && Math.abs(dx) < PAN_THRESHOLD_PX) return;
    if (!pan.moved) {
      pan.moved = true;
      setPanning(true);
    }
    el.scrollLeft = pan.startScroll - dx;
  }

  function onTrackPointerUp(e: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    const clickedCell =
      pan &&
      pan.pointerId === e.pointerId &&
      !pan.moved &&
      pan.clubId &&
      pan.startDate
        ? { clubId: pan.clubId, startDate: pan.startDate }
        : null;
    endPan(e.pointerId);
    if (clickedCell) onAddTournament(clickedCell);
  }

  const firstTournamentStart = useMemo(() => {
    if (tournaments.length === 0) return null;
    return tournaments.reduce(
      (min, t) => (t.startDate < min ? t.startDate : min),
      tournaments[0]!.startDate,
    );
  }, [tournaments]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !firstTournamentStart) return;
    const offset = differenceInCalendarDays(
      parseISO(firstTournamentStart),
      trackStart,
    );
    const padding = dayWidth * 2;
    el.scrollLeft = Math.max(0, offset * dayWidth - padding);
  }, [firstTournamentStart, dayWidth, trackStart, trackWidth]);

  const clubById = useMemo(
    () => new Map(clubs.map((c) => [c.id, c])),
    [clubs],
  );
  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const ROW_H = 56;
  const LABEL_W = 152;
  const HEADER_H = 52; // mes + días

  function leftFor(dateISO: string): number {
    const offset = differenceInCalendarDays(parseISO(dateISO), trackStart);
    return Math.max(0, offset) * dayWidth;
  }

  function widthFor(startISO: string, endISO: string): number {
    const daysSpan =
      differenceInCalendarDays(parseISO(endISO), parseISO(startISO)) + 1;
    return Math.max(dayWidth, daysSpan * dayWidth);
  }

  function ClubLabel({
    club,
    index,
  }: {
    club: CalendarClub;
    index: number;
  }) {
    return (
      <div
        className="flex items-center gap-1 border-b px-1.5 text-xs font-medium"
        style={{
          height: ROW_H,
          borderLeftWidth: 3,
          borderLeftColor: club.color,
        }}
      >
        <div className="flex shrink-0 flex-col">
          <button
            type="button"
            className="grid size-4 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={index === 0}
            onClick={() => onMoveClub(club.id, -1)}
            aria-label={`Subir ${club.name}`}
          >
            <ChevronUp className="size-3" />
          </button>
          <button
            type="button"
            className="grid size-4 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={index === clubs.length - 1}
            onClick={() => onMoveClub(club.id, 1)}
            aria-label={`Bajar ${club.name}`}
          >
            <ChevronDown className="size-3" />
          </button>
        </div>
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: club.color }}
        />
        <span className="truncate">{club.name}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Zoom</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-7"
            disabled={zoomMonths >= MAX_ZOOM_MONTHS}
            onClick={() =>
              setZoomMonths((n) => Math.min(MAX_ZOOM_MONTHS, n + 1))
            }
            title="Ver más meses"
            aria-label="Alejar"
          >
            <Minus className="size-3.5" />
          </Button>
          <span className="min-w-[4.5rem] text-center text-sm tabular-nums">
            {zoomMonths} meses
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-7"
            disabled={zoomMonths <= MIN_ZOOM_MONTHS}
            onClick={() =>
              setZoomMonths((n) => Math.max(MIN_ZOOM_MONTHS, n - 1))
            }
            title="Ver menos meses"
            aria-label="Acercar"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-x-3 gap-y-2">
          <div
            className="flex items-center gap-2 rounded-md border px-2 py-1"
            aria-label="Disponibles"
          >
            <Checkbox
              checked={showTorneoLibre}
              onCheckedChange={(v) => onToggleTorneoLibre(v === true)}
              aria-label="Mostrar días disponibles"
            />
            <span className="h-4 w-px bg-border" aria-hidden />
            <button
              type="button"
              className="text-sm whitespace-nowrap"
              onClick={() => onToggleTorneoLibre(!showTorneoLibre)}
            >
              Disponibles
            </button>
            <span className="h-4 w-px bg-border" aria-hidden />
            <button
              type="button"
              title="Editar colores de Disponibles"
              onClick={onOpenLibreColors}
              className="size-5 shrink-0 rounded-sm border-2"
              style={{
                backgroundColor: libreFill,
                borderColor: libreBorder,
              }}
            />
          </div>

          <span className="h-6 w-px bg-border" aria-hidden />

          <div className="flex min-w-0 items-center gap-2" aria-label="Filtros">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenFilter}
            >
              <Filter className="size-3.5" />
              Filtrar
            </Button>
            {hidePast || filterCategories.length > 0 ? (
              <>
                <span className="h-4 w-px bg-border" aria-hidden />
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {hidePast ? (
                    <button
                      type="button"
                      title="Ocultando torneos anteriores a hoy · Clic para mostrarlos"
                      onClick={onClearHidePast}
                      className="inline-flex h-6 shrink-0 items-center rounded-sm border px-1.5 text-[10px] font-semibold"
                    >
                      Desde hoy
                    </button>
                  ) : null}
                  {filterCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      title={`${cat.name} · Clic para quitar del filtro`}
                      onClick={() => onRemoveFilter(cat.id)}
                      className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-sm border-0 px-1 text-[10px] font-bold leading-none text-white"
                      style={{ backgroundColor: cat.color }}
                    >
                      {cat.abbreviation}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
        <Button type="button" size="sm" onClick={() => onAddTournament()}>
          <Plus className="size-4" />
          Agregar torneo
        </Button>
      </div>

      {clubs.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Agregá clubes en la pestaña Clubes: cada uno aparece como una fila en
          el timeline.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <div className="flex">
            {/* Etiquetas izquierdas (fijas) */}
            <div
              className="shrink-0 border-r bg-background"
              style={{ width: LABEL_W }}
            >
              <div
                className="border-b bg-muted/50"
                style={{ height: HEADER_H }}
              />
              {clubs.map((club, index) => (
                <ClubLabel key={`L-${club.id}`} club={club} index={index} />
              ))}
            </div>

            {/* Track con scroll horizontal */}
            <div
              ref={scrollRef}
              className={cn(
                "min-w-0 flex-1 touch-none overflow-x-auto overscroll-x-contain select-none",
                panning ? "cursor-grabbing" : "cursor-grab",
              )}
              onPointerDown={onTrackPointerDown}
              onPointerMove={onTrackPointerMove}
              onPointerUp={onTrackPointerUp}
              onPointerCancel={onTrackPointerUp}
            >
              <div style={{ width: trackWidth }}>
                <div
                  className="sticky top-0 z-10 border-b"
                  style={{ height: HEADER_H }}
                >
                  <div className="flex h-7 border-b border-black/15 dark:border-white/15">
                    {months.map((month) => {
                      const start = month < trackStart ? trackStart : month;
                      const next = addMonths(month, 1);
                      const endExclusive = addDays(trackStart, days.length);
                      const end = next > endExclusive ? endExclusive : next;
                      const width =
                        differenceInCalendarDays(end, start) * dayWidth;
                      return (
                        <div
                          key={month.toISOString()}
                          style={{ width }}
                          className={cn(
                            "shrink-0 border-r border-black/20 px-2 py-1 text-xs font-semibold capitalize dark:border-white/20",
                            monthHeaderShade(month),
                          )}
                        >
                          {format(month, "MMMM yyyy", { locale: es })}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex h-6">
                    {days.map((day) => {
                      const weekend =
                        day.getDay() === 0 || day.getDay() === 6;
                      const isToday = isSameDay(day, today);
                      const monthStart = day.getDate() === 1;
                      return (
                        <div
                          key={day.toISOString()}
                          style={{ width: dayWidth }}
                          className={cn(
                            "shrink-0 border-r border-black/10 text-center text-[10px] leading-6 tabular-nums dark:border-white/10",
                            monthHeaderShade(day),
                            weekend && "brightness-95",
                            isToday && "font-bold underline decoration-2",
                            monthStart &&
                              "border-l-2 border-l-black/40 dark:border-l-white/50",
                          )}
                        >
                          {format(day, "d")}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {clubs.map((club) => {
                  const clubTournaments = tournaments.filter(
                    (t) => t.clubId === club.id,
                  );
                  return (
                    <div
                      key={`row-${club.id}`}
                      className="relative border-b"
                      style={{ height: ROW_H }}
                    >
                      {days.map((day) => {
                        const weekend =
                          day.getDay() === 0 || day.getDay() === 6;
                        const monthStart = day.getDate() === 1;
                        return (
                          <div
                            key={`${club.id}-${day.toISOString()}`}
                            data-club-id={club.id}
                            data-date={format(day, "yyyy-MM-dd")}
                            title="Clic para agregar torneo · Arrastrá para desplazar"
                            style={{
                              left:
                                differenceInCalendarDays(day, trackStart) *
                                dayWidth,
                              width: dayWidth,
                            }}
                            className={cn(
                              "absolute inset-y-0 border-r border-border/40",
                              weekend && "bg-muted/20",
                              monthStart &&
                                "border-l-2 border-l-black/25 dark:border-l-white/30",
                            )}
                          />
                        );
                      })}

                      {showTorneoLibre
                        ? days
                            .filter((day) => {
                              if (!isLibreWeekday(day)) return false;
                              if (hidePast && format(day, "yyyy-MM-dd") < todayISO()) {
                                return false;
                              }
                              return !weekendIsOccupied(
                                clubTournaments,
                                fridayISOOf(day),
                              );
                            })
                            .map((day) => {
                              const dateISO = format(day, "yyyy-MM-dd");
                              return (
                                <button
                                  key={`disp-${club.id}-${day.toISOString()}`}
                                  type="button"
                                  title="Fin de semana disponible · Clic para agregar torneo"
                                  onClick={() =>
                                    onAddTournament({
                                      clubId: club.id,
                                      startDate: dateISO,
                                    })
                                  }
                                  style={{
                                    left: leftFor(dateISO),
                                    width: Math.max(dayWidth - 3, 10),
                                    top: 10,
                                    height: 36,
                                    backgroundColor: libreFill,
                                    borderColor: libreBorder,
                                    color: libreBorder,
                                  }}
                                  data-no-pan
                                  className="absolute z-[1] box-border flex cursor-pointer items-center justify-center rounded-sm border-2 text-[10px] font-bold hover:brightness-105"
                                >
                                  {libreDayLetter(day)}
                                </button>
                              );
                            })
                        : null}

                      {clubTournaments.map((tournament) => {
                        const allCats = tournament.categoryIds
                          .map((id) => categoryById.get(id))
                          .filter(Boolean) as CatalogCategory[];
                        const filterIds = new Set(
                          filterCategories.map((c) => c.id),
                        );
                        const cats =
                          filterIds.size === 0
                            ? allCats
                            : allCats.filter((c) => filterIds.has(c.id));
                        const catLabels = cats
                          .map((cat) => cat.abbreviation || cat.name)
                          .join(", ");
                        const titleLabel =
                          [tournament.name, catLabels]
                            .filter(Boolean)
                            .join(" · ") || "Torneo";

                        return (
                          <button
                            key={tournament.id}
                            type="button"
                            title={`${titleLabel} · Clic para editar`}
                            onClick={() => onEditTournament(tournament)}
                            style={{
                              left: leftFor(tournament.startDate),
                              width: widthFor(
                                tournament.startDate,
                                tournament.endDate,
                              ),
                              top: 10,
                              height: 36,
                              backgroundColor: club.color,
                            }}
                            data-no-pan
                            className="absolute z-[2] flex cursor-pointer items-center gap-1 overflow-hidden rounded-md border-0 px-1.5 text-left text-xs font-medium text-white shadow-sm hover:brightness-110"
                          >
                            {tournament.name ? (
                              <span className="min-w-0 truncate">
                                {tournament.name}
                              </span>
                            ) : null}
                            {cats.length > 0 ? (
                              <span className="flex min-w-0 flex-1 items-center gap-1">
                                {cats.map((cat) => (
                                  <span
                                    key={cat.id}
                                    title={cat.name}
                                    className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-sm px-1 text-[10px] font-bold leading-none text-white ring-1 ring-white/80"
                                    style={{ backgroundColor: cat.color }}
                                  >
                                    {cat.abbreviation || cat.name.slice(0, 4)}
                                  </span>
                                ))}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Etiquetas derechas (fijas) */}
            <div
              className="shrink-0 border-l bg-background"
              style={{ width: LABEL_W }}
            >
              <div
                className="border-b bg-muted/50"
                style={{ height: HEADER_H }}
              />
              {clubs.map((club, index) => (
                <ClubLabel key={`R-${club.id}`} club={club} index={index} />
              ))}
            </div>
          </div>
        </div>
      )}

      {tournaments.length > 0 ? (
        <ul className="divide-y rounded-xl border">
          {tournaments.map((t) => {
            const club = clubById.get(t.clubId);
            const cats = t.categoryIds
              .map((id) => categoryById.get(id))
              .filter(Boolean) as CatalogCategory[];
            return (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-start gap-2">
                  <span
                    className="mt-1 size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: club?.color ?? "#64748b" }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {t.name ||
                        (cats.length > 0
                          ? cats.map((c) => c.abbreviation).join(" · ")
                          : "Sin nombre")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {club?.name ?? "Sin club"} ·{" "}
                      {formatShortDate(t.startDate)}
                      {t.endDate !== t.startDate
                        ? ` – ${formatShortDate(t.endDate)}`
                        : ""}
                    </p>
                    {cats.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {cats.map((cat) => (
                          <span
                            key={cat.id}
                            className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]"
                          >
                            <span
                              className="size-1.5 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            {cat.abbreviation}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditTournament(t)}
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemoveTournament(t.id)}
                    aria-label={`Eliminar ${t.name || cats.map((c) => c.abbreviation).join(" ") || "torneo"}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function ClubsCrud({
  clubs,
  onCreate,
  onUpdate,
  onDelete,
  onReorder,
}: {
  clubs: CalendarClub[];
  onCreate: (input: {
    name: string;
    color: string;
  }) => Promise<CalendarClub | null>;
  onUpdate: (
    id: string,
    input: { name: string; color: string },
  ) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (next: CalendarClub[]) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(() => nextPaletteColor([]));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  async function addClub() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Escribí el nombre del club");
      return;
    }
    const created = await onCreate({ name: trimmed, color });
    if (!created) return;
    setName("");
    setColor(nextPaletteColor([...clubs.map((c) => c.color), color]));
    toast.success("Club agregado");
  }

  async function saveEdit(id: string) {
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error("Escribí el nombre");
      return;
    }
    const ok = await onUpdate(id, { name: trimmed, color: editColor });
    if (!ok) return;
    setEditingId(null);
    toast.success("Club actualizado");
  }

  function moveClub(id: string, delta: -1 | 1) {
    const index = clubs.findIndex((c) => c.id === id);
    const next = moveByDelta(clubs, index, delta);
    if (next !== clubs) void onReorder(next);
  }

  function onDragStart(id: string, e: DragEvent) {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function onDragOverRow(id: string, e: DragEvent) {
    e.preventDefault();
    if (id !== overId) setOverId(id);
  }

  function onDropRow(id: string, e: DragEvent) {
    e.preventDefault();
    const fromId = dragId ?? e.dataTransfer.getData("text/plain");
    setDragId(null);
    setOverId(null);
    if (!fromId || fromId === id) return;
    const next = moveById(clubs, fromId, id);
    if (next !== clubs) void onReorder(next);
  }

  function onDragEnd() {
    setDragId(null);
    setOverId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border p-3">
        <p className="mb-3 text-sm font-medium">Nuevo club</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
            <Label htmlFor="club-name">Nombre</Label>
            <Input
              id="club-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Tiebreak"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="club-color">Color</Label>
            <Input
              id="club-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 w-14 cursor-pointer p-1"
            />
          </div>
          <Button type="button" onClick={addClub}>
            <Plus className="size-4" />
            Agregar
          </Button>
        </div>
      </div>

      <ul className="divide-y rounded-xl border">
        {clubs.length === 0 ? (
          <li className="px-3 py-6 text-sm text-muted-foreground">
            Todavía no hay clubes.
          </li>
        ) : (
          clubs.map((club, index) => (
            <li
              key={club.id}
              onDragOver={(e) => onDragOverRow(club.id, e)}
              onDrop={(e) => onDropRow(club.id, e)}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 px-3 py-2.5",
                dragId === club.id && "opacity-40",
                overId === club.id && dragId !== club.id && "border-t-2 border-t-primary",
              )}
            >
              {editingId === club.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 w-48"
                  />
                  <Input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="h-8 w-14 cursor-pointer p-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => saveEdit(club.id)}
                  >
                    Guardar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => onDragStart(club.id, e)}
                    onDragEnd={onDragEnd}
                    aria-label={`Arrastrar ${club.name}`}
                    className="flex cursor-grab items-center rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
                  >
                    <GripVertical className="size-4" />
                  </button>
                  <div className="flex flex-col">
                    <button
                      type="button"
                      className="grid size-4 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={index === 0}
                      onClick={() => moveClub(club.id, -1)}
                      aria-label={`Subir ${club.name}`}
                    >
                      <ChevronUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      className="grid size-4 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={index === clubs.length - 1}
                      onClick={() => moveClub(club.id, 1)}
                      aria-label={`Bajar ${club.name}`}
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                  </div>
                  <span
                    className="size-3 rounded-full"
                    style={{ backgroundColor: club.color }}
                  />
                  <span className="text-sm font-medium">{club.name}</span>
                </div>
              )}
              {editingId !== club.id ? (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingId(club.id);
                      setEditName(club.name);
                      setEditColor(club.color);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => void onDelete(club.id)}
                    aria-label={`Eliminar ${club.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function CategoriesCrud({
  categories,
  onCreate,
  onUpdate,
  onDelete,
}: {
  categories: CatalogCategory[];
  onCreate: (input: {
    name: string;
    abbreviation: string;
    color: string;
  }) => Promise<CatalogCategory | null>;
  onUpdate: (
    id: string,
    input: { name: string; abbreviation: string; color: string },
  ) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAbbreviation, setEditAbbreviation] = useState("");
  const [editColor, setEditColor] = useState("");

  async function saveEdit(id: string) {
    const trimmedName = editName.trim();
    const trimmedAbbr = editAbbreviation.trim().toUpperCase();
    if (!trimmedName) {
      toast.error("Escribí el nombre");
      return;
    }
    if (!trimmedAbbr) {
      toast.error("Escribí la abreviación");
      return;
    }
    if (
      categories.some(
        (c) =>
          c.id !== id && c.name.toLowerCase() === trimmedName.toLowerCase(),
      )
    ) {
      toast.error("Ya existe una categoría con ese nombre");
      return;
    }
    if (
      categories.some(
        (c) =>
          c.id !== id &&
          c.abbreviation.toLowerCase() === trimmedAbbr.toLowerCase(),
      )
    ) {
      toast.error("Ya existe una categoría con esa abreviación");
      return;
    }
    const ok = await onUpdate(id, {
      name: trimmedName,
      abbreviation: trimmedAbbr,
      color: editColor,
    });
    if (!ok) return;
    setEditingId(null);
    toast.success("Categoría actualizada");
  }

  return (
    <div className="flex flex-col gap-4">
      <CatalogCategoryCreateForm
        existingCategories={categories}
        onCreate={async (input) => {
          const created = await onCreate(input);
          if (!created) return false;
          toast.success("Categoría agregada");
          return true;
        }}
      />

      <ul className="divide-y rounded-xl border">
        {categories.length === 0 ? (
          <li className="px-3 py-6 text-sm text-muted-foreground">
            Todavía no hay categorías en el catálogo.
          </li>
        ) : (
          categories.map((cat) => (
            <li
              key={cat.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
            >
              {editingId === cat.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 w-44"
                    placeholder="Nombre"
                  />
                  <Input
                    value={editAbbreviation}
                    onChange={(e) => setEditAbbreviation(e.target.value)}
                    className="h-8 w-20"
                    placeholder="Abr."
                    maxLength={6}
                  />
                  <Input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="h-8 w-14 cursor-pointer p-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => saveEdit(cat.id)}
                  >
                    Guardar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-sm font-medium">{cat.name}</span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                    {cat.abbreviation}
                  </span>
                </div>
              )}
              {editingId !== cat.id ? (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingId(cat.id);
                      setEditName(cat.name);
                      setEditAbbreviation(cat.abbreviation);
                      setEditColor(cat.color);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => void onDelete(cat.id)}
                    aria-label={`Eliminar ${cat.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function SearchPanel({
  clubs,
  categories,
  tournaments,
  customLinks,
  onAddTournament,
  onEditTournament,
  onCreateLink,
  onUpdateLink,
  onDeleteLink,
}: {
  clubs: CalendarClub[];
  categories: CatalogCategory[];
  tournaments: PlannedTournament[];
  customLinks: CalendarSearchLink[];
  onAddTournament: () => void;
  onEditTournament: (tournament: PlannedTournament) => void;
  onCreateLink: (input: {
    name: string;
    url: string;
    description: string;
  }) => Promise<CalendarSearchLink | null>;
  onUpdateLink: (
    id: string,
    input: { name: string; url: string; description: string },
  ) => Promise<boolean>;
  onDeleteLink: (id: string) => Promise<void>;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");

  const links = useMemo(
    () => [...DEFAULT_TOURNAMENT_SEARCH_LINKS, ...customLinks],
    [customLinks],
  );
  const customIds = useMemo(
    () => new Set(customLinks.map((l) => l.id)),
    [customLinks],
  );
  const clubById = useMemo(
    () => new Map(clubs.map((c) => [c.id, c])),
    [clubs],
  );

  const occupancy = useMemo(() => {
    const today = todayISO();
    return categories
      .map((cat) => {
        const items = tournaments
          .filter((t) => t.categoryIds.includes(cat.id) && t.endDate >= today)
          .sort((a, b) => a.startDate.localeCompare(b.startDate));
        return { cat, items };
      })
      .filter((row) => row.items.length > 0);
  }, [categories, tournaments]);

  function openCreate() {
    setEditingId(null);
    setName("");
    setUrl("");
    setDescription("");
    setFormOpen(true);
  }

  function openEdit(link: CalendarSearchLink) {
    setEditingId(link.id);
    setName(link.name);
    setUrl(link.url);
    setDescription(link.description);
    setFormOpen(true);
  }

  async function submitLink() {
    const payload = { name, url, description };
    if (editingId) {
      const ok = await onUpdateLink(editingId, payload);
      if (!ok) return;
      setFormOpen(false);
      toast.success("Sitio actualizado");
      return;
    }
    const created = await onCreateLink(payload);
    if (!created) return;
    setFormOpen(false);
    toast.success("Sitio agregado");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Métodos de búsqueda</p>
          <p className="text-sm text-muted-foreground">
            Abrí un sitio, mirá qué categorías ya se juegan en la zona y
            cargalas al calendario para no organizar la misma categoría que
            otro club.
          </p>
        </div>
        <Button type="button" size="sm" onClick={onAddTournament}>
          <Plus className="size-4" />
          Agregar torneo
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {links.map((link) => {
          const custom = customIds.has(link.id);
          return (
            <div
              key={link.id}
              className="flex flex-col rounded-xl border p-3"
            >
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">{link.name}</span>
                  <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                </div>
                {link.description ? (
                  <p className="text-xs text-muted-foreground">
                    {link.description}
                  </p>
                ) : null}
                <p className="text-[11px] text-muted-foreground/80">
                  {hostnameOf(link.url)}
                </p>
              </a>
              {custom ? (
                <div className="mt-2 flex justify-end gap-1 border-t pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(link)}
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => void onDeleteLink(link.id)}
                    aria-label={`Eliminar ${link.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
        <button
          type="button"
          onClick={openCreate}
          className="flex min-h-[7.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        >
          <Plus className="size-4" />
          Agregar sitio
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Categorías ya ocupadas</p>
        <p className="text-xs text-muted-foreground">
          Lo que ya está cargado en el calendario, de hoy en adelante. Si
          otra sede tiene esa categoría, evitá repetirla en las mismas
          fechas.
        </p>
        {occupancy.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
            Todavía no hay categorías ocupadas a futuro. Buscá torneos en los
            sitios y agregalos para ver choques.
          </div>
        ) : (
          <ul className="divide-y rounded-xl border">
            {occupancy.map(({ cat, items }) => (
              <li key={cat.id} className="flex flex-col gap-2 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-sm font-medium">{cat.name}</span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {cat.abbreviation}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {items.map((t) => {
                    const club = clubById.get(t.clubId);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onEditTournament(t)}
                        className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md px-1 py-0.5 text-left text-xs hover:bg-muted"
                      >
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: club?.color ?? "#64748b" }}
                        />
                        <span className="font-medium">
                          {club?.name ?? "Sin club"}
                        </span>
                        <span className="text-muted-foreground">
                          {formatShortDate(t.startDate)}
                          {t.endDate !== t.startDate
                            ? ` – ${formatShortDate(t.endDate)}`
                            : ""}
                        </span>
                        {t.name ? (
                          <span className="text-muted-foreground">
                            · {t.name}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar sitio" : "Agregar sitio"}
            </DialogTitle>
            <DialogDescription>
              Un enlace para buscar torneos de la zona y cruzar categorías.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="search-link-name">Nombre</Label>
              <Input
                id="search-link-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Circuito zona norte"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="search-link-url">Enlace</Label>
              <Input
                id="search-link-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="search-link-desc">Nota (opcional)</Label>
              <Input
                id="search-link-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Qué se puede ver en este sitio"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={() => void submitLink()}>
                {editingId ? "Guardar" : "Agregar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
