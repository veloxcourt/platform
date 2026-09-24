import type { Gender } from "@/modules/bookings/domain/new-player-schema";
import type { RegistrationStatus } from "./types";
import type { PairPreferenceSlotValues } from "./slot-reservation-schema";
import type { ZonesDayPreference } from "./zones-day-preference";

export type PublicManagedPair = {
  id: string;
  status: RegistrationStatus;
  categoryId: string;
  categoryName: string;
  zonesDayPreference: ZonesDayPreference;
  player1Name: string;
  player2Name: string | null;
  tournamentName: string;
  clubName: string;
  publicSlug: string;
  manageToken: string;
};

export type PublicManagedPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  gender: Gender | null;
  city: string | null;
};

export type PublicManagedPairDetails = PublicManagedPair & {
  player1: PublicManagedPlayer;
  player2: PublicManagedPlayer | null;
  slots: PairPreferenceSlotValues[];
};

export function pairManagePath(publicSlug: string, manageToken: string): string {
  return `/inscripcion/${publicSlug}/gestionar/${manageToken}`;
}
