import type { BookingRepository } from "../application/booking-repository";
import { MockBookingRepository } from "./mock-booking-repository";
import { PrismaBookingRepository } from "./prisma-booking-repository";

// Punto único para obtener la implementación del repositorio.
// - Si hay DATABASE_URL configurada (Supabase/PostgreSQL) => Prisma (persistencia real).
// - Si no => repositorio en memoria (demo/desarrollo sin base de datos).
// Cambiar de una a otra no requiere tocar UI ni casos de uso.
let instance: BookingRepository | null = null;

export function getBookingRepository(): BookingRepository {
  if (!instance) {
    instance = process.env.DATABASE_URL
      ? new PrismaBookingRepository()
      : new MockBookingRepository();
  }
  return instance;
}
