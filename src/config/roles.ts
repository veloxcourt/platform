export const ROLES = [
  "OWNER",
  "CLUB_ADMIN",
  "RECEPTIONIST",
  "CASHIER",
  "PROFESSOR",
  "PLAYER",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Dueño",
  CLUB_ADMIN: "Administrador del club",
  RECEPTIONIST: "Recepcionista",
  CASHIER: "Cajero",
  PROFESSOR: "Profesor",
  PLAYER: "Jugador",
};

/// Roles con permiso para operar la agenda de turnos (crear/editar en nombre de otros).
export const STAFF_ROLES: Role[] = [
  "OWNER",
  "CLUB_ADMIN",
  "RECEPTIONIST",
  "CASHIER",
];
