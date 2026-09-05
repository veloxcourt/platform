"use client";

import { useEffect, useRef, useState } from "react";

import { searchPublicClubPlayersAction } from "@/app/inscripcion/[publicSlug]/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GENDER_LABELS, GENDERS, type Gender } from "@/modules/bookings/domain/new-player-schema";
import type { PublicClubPlayerMatch } from "@/modules/tournaments/application/search-public-club-players";
import { requiredGenderFromCategoryName } from "@/modules/tournaments/domain/category-player-filter";

const SELECT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function PublicPlayerFields({
  prefix,
  title,
  publicSlug,
  categoryName,
  excludeId,
  onMatchedIdChange,
}: {
  prefix: "player1" | "player2";
  title: string;
  publicSlug: string;
  categoryName?: string;
  excludeId?: string;
  onMatchedIdChange?: (id: string) => void;
}) {
  const requiredGender = requiredGenderFromCategoryName(categoryName ?? "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState(requiredGender ?? "");
  const [matches, setMatches] = useState<PublicClubPlayerMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [matched, setMatched] = useState(false);
  const [searching, setSearching] = useState(false);
  const requestIdRef = useRef(0);
  const previousRequiredRef = useRef(requiredGender);

  useEffect(() => {
    const previous = previousRequiredRef.current;
    previousRequiredRef.current = requiredGender;
    if (requiredGender) setGender(requiredGender);
    if (previous === requiredGender) return;
    if (!matched) return;
    setFirstName("");
    setLastName("");
    setPhone("");
    setMatched(false);
    onMatchedIdChange?.("");
  }, [requiredGender, matched, onMatchedIdChange]);

  useEffect(() => {
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
  }, [firstName, lastName, phone, publicSlug, excludeId, categoryName]);

  function applyMatch(match: PublicClubPlayerMatch) {
    setFirstName(match.firstName);
    setLastName(match.lastName);
    setPhone(match.phone);
    setGender(match.gender ?? requiredGender ?? "");
    setMatched(true);
    setOpen(false);
    setMatches([]);
    onMatchedIdChange?.(match.id);
  }

  function markEdited() {
    if (!matched) return;
    setMatched(false);
    onMatchedIdChange?.("");
  }

  const showList = open && (searching || matches.length > 0);

  return (
    <fieldset className="space-y-3 rounded-xl border p-4">
      <legend className="px-1 text-sm font-medium">{title}</legend>
      <p className="text-xs text-muted-foreground">
        {requiredGender === "FEMALE"
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
                value={firstName}
                onChange={(event) => {
                  setFirstName(event.target.value);
                  markEdited();
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
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
                value={lastName}
                onChange={(event) => {
                  setLastName(event.target.value);
                  markEdited();
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
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
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                markEdited();
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}Gender`}>Género</Label>
            {requiredGender ? (
              <input type="hidden" name={`${prefix}Gender`} value={requiredGender} />
            ) : null}
            <select
              id={`${prefix}Gender`}
              name={requiredGender ? undefined : `${prefix}Gender`}
              required={!requiredGender}
              disabled={Boolean(requiredGender)}
              className={SELECT_CLASS}
              value={requiredGender ?? gender}
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
      </div>
      {matched ? (
        <p className="text-xs text-muted-foreground">
          Ya está en el club. Completamos teléfono y género.
        </p>
      ) : null}
    </fieldset>
  );
}
