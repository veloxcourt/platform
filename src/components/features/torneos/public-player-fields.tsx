"use client";

import { useEffect, useRef, useState } from "react";

import { searchPublicClubPlayersAction } from "@/app/inscripcion/[publicSlug]/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { GENDER_LABELS, GENDERS, type Gender } from "@/modules/bookings/domain/new-player-schema";
import type { PublicClubPlayerMatch } from "@/modules/tournaments/application/search-public-club-players";
import { requiredGenderFromCategoryName } from "@/modules/tournaments/domain/category-player-filter";

const FIELD_CLASS = "bg-white dark:bg-background";
const SELECT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 dark:bg-background";

export type PublicPlayerDefaults = {
  id?: string;
  firstName: string;
  lastName: string;
  phone: string;
  gender?: Gender | "";
  city?: string;
};

export function PublicPlayerFields({
  prefix,
  title,
  publicSlug,
  categoryName,
  excludeId,
  onMatchedIdChange,
  defaults,
  locked = false,
}: {
  prefix: "player1" | "player2";
  title: string;
  publicSlug: string;
  categoryName?: string;
  excludeId?: string;
  onMatchedIdChange?: (id: string) => void;
  defaults?: PublicPlayerDefaults | null;
  /** Jugador logueado: no se reemplaza por otra persona. */
  locked?: boolean;
}) {
  const requiredGender = requiredGenderFromCategoryName(categoryName ?? "");
  const [firstName, setFirstName] = useState(defaults?.firstName ?? "");
  const [lastName, setLastName] = useState(defaults?.lastName ?? "");
  const [phone, setPhone] = useState(defaults?.phone ?? "");
  const [gender, setGender] = useState(defaults?.gender ?? requiredGender ?? "");
  const [city, setCity] = useState(defaults?.city ?? "");
  const [matches, setMatches] = useState<PublicClubPlayerMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [matched, setMatched] = useState(Boolean(defaults?.id));
  const [searching, setSearching] = useState(false);
  const requestIdRef = useRef(0);
  const previousRequiredRef = useRef(requiredGender);
  const defaultsId = defaults?.id;

  useEffect(() => {
    if (!defaultsId) return;
    onMatchedIdChange?.(defaultsId);
  }, [defaultsId, onMatchedIdChange]);

  useEffect(() => {
    const previous = previousRequiredRef.current;
    previousRequiredRef.current = requiredGender;
    if (requiredGender) setGender(requiredGender);
    if (previous === requiredGender) return;
    if (locked || !matched) return;
    setFirstName("");
    setLastName("");
    setPhone("");
    setCity("");
    setMatched(false);
    onMatchedIdChange?.("");
  }, [requiredGender, matched, onMatchedIdChange, locked]);

  useEffect(() => {
    if (locked) {
      setMatches([]);
      setSearching(false);
      return;
    }
    const query = [firstName, lastName].filter(Boolean).join(" ").trim();
    const phoneQuery = phone.replace(/\D/g, "");
    const canSearch = query.replace(/\s/g, "").length >= 2 || phoneQuery.length >= 4;

    if (!canSearch) {
      setMatches([]);
      setSearching(false);
      return;
    }

    const handle = window.setTimeout(() => {
      const requestId = ++requestIdRef.current;
      setSearching(true);
      void searchPublicClubPlayersAction(
        publicSlug,
        query || phone,
        excludeId ? [excludeId] : [],
        categoryName,
      ).then((result) => {
        if (requestId !== requestIdRef.current) return;
        setMatches(result);
        setSearching(false);
      });
    }, 280);

    return () => window.clearTimeout(handle);
  }, [firstName, lastName, phone, publicSlug, excludeId, categoryName, locked]);

  function applyMatch(match: PublicClubPlayerMatch) {
    setFirstName(match.firstName);
    setLastName(match.lastName);
    setPhone(match.phone);
    setGender(match.gender ?? requiredGender ?? "");
    setCity(match.city ?? "");
    setMatched(true);
    setOpen(false);
    setMatches([]);
    onMatchedIdChange?.(match.id);
  }

  function markEdited() {
    if (locked) return;
    if (!matched) return;
    setMatched(false);
    onMatchedIdChange?.("");
  }

  const phoneLocked = locked && Boolean(defaults?.phone?.trim());
  const cityLocked = locked && Boolean(defaults?.city?.trim());
  const showList = !locked && open && (searching || matches.length > 0);

  return (
    <fieldset
      className={cn(
        "space-y-3 rounded-xl border p-4",
        prefix === "player1"
          ? "border-orange-200 bg-orange-50/50 dark:border-orange-900/50 dark:bg-orange-950/20"
          : "border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20",
      )}
    >
      <legend
        className={cn(
          "flex items-center gap-2 px-1 text-base font-semibold",
          prefix === "player1"
            ? "text-orange-800 dark:text-orange-300"
            : "text-amber-800 dark:text-amber-300",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-1 rounded-full",
            prefix === "player1" ? "bg-orange-500" : "bg-amber-400",
          )}
          aria-hidden
        />
        {title}
      </legend>
      <p className="text-xs text-muted-foreground">
        {locked
          ? "Estás ingresado: este jugador sos vos."
          : requiredGender === "FEMALE"
            ? "Escribí el nombre: solo se muestran jugadoras de esta categoría."
            : requiredGender === "MALE"
              ? "Escribí el nombre: solo se muestran jugadores de esta categoría."
              : "Escribí el nombre: si ya está en el club, lo vas a poder elegir."}
      </p>
      <div className="space-y-3">
        <div className="relative">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${prefix}FirstName`}>Nombre</Label>
              <Input
                id={`${prefix}FirstName`}
                name={`${prefix}FirstName`}
                autoComplete="off"
                required
                readOnly={locked}
                className={FIELD_CLASS}
                value={firstName}
                onChange={(event) => {
                  setFirstName(event.target.value);
                  markEdited();
                  setOpen(true);
                }}
                onFocus={() => !locked && setOpen(true)}
                onBlur={() => window.setTimeout(() => setOpen(false), 140)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${prefix}LastName`}>Apellido</Label>
              <Input
                id={`${prefix}LastName`}
                name={`${prefix}LastName`}
                autoComplete="off"
                required
                readOnly={locked}
                className={FIELD_CLASS}
                value={lastName}
                onChange={(event) => {
                  setLastName(event.target.value);
                  markEdited();
                  setOpen(true);
                }}
                onFocus={() => !locked && setOpen(true)}
                onBlur={() => window.setTimeout(() => setOpen(false), 140)}
              />
            </div>
          </div>
          {showList ? (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-auto rounded-lg border bg-popover text-popover-foreground shadow-md">
              {searching && matches.length === 0 ? (
                <p className="px-2.5 py-2 text-sm text-muted-foreground">
                  Buscando en el club…
                </p>
              ) : (
                matches.map((match) => (
                  <button
                    key={match.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyMatch(match)}
                    className="block w-full px-2.5 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <span className="font-medium">
                      {match.firstName} {match.lastName}
                    </span>
                    {match.city ? (
                      <span className="ml-2 text-muted-foreground">
                        {match.city}
                      </span>
                    ) : null}
                    {match.phoneHint ? (
                      <span className="ml-2 text-muted-foreground">
                        {match.phoneHint}
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}Phone`}>Teléfono</Label>
            <Input
              id={`${prefix}Phone`}
              name={`${prefix}Phone`}
              inputMode="tel"
              placeholder="11 2345 6789"
              required
              readOnly={phoneLocked}
              className={FIELD_CLASS}
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                markEdited();
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}Gender`}>Género</Label>
            {requiredGender || (locked && gender) ? (
              <input
                type="hidden"
                name={`${prefix}Gender`}
                value={requiredGender || gender}
              />
            ) : null}
            <select
              id={`${prefix}Gender`}
              name={
                requiredGender || locked ? undefined : `${prefix}Gender`
              }
              required={!requiredGender && !locked}
              disabled={Boolean(requiredGender) || locked}
              className={SELECT_CLASS}
              value={requiredGender || gender}
              onChange={(event) => {
                setGender(event.target.value as Gender | "");
                markEdited();
              }}
            >
              <option value="">Elegí…</option>
              {GENDERS.map((value) => (
                <option key={value} value={value}>
                  {GENDER_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}City`}>Localidad</Label>
          <Input
            id={`${prefix}City`}
            name={`${prefix}City`}
            autoComplete="address-level2"
            required
            readOnly={cityLocked}
            className={FIELD_CLASS}
            value={city}
            onChange={(event) => {
              setCity(event.target.value);
            }}
          />
        </div>
      </div>
      {matched && !locked ? (
        <p className="text-xs text-muted-foreground">
          Ya está en el club. Completamos teléfono, género y localidad.
        </p>
      ) : null}
    </fieldset>
  );
}
