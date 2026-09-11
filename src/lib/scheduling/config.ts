import type { BusinessHours, Service, Professional, WeekdaySchedule } from "./types";

/**
 * Sample configuration used by the public scheduling screen until persistence
 * and the establishment dashboard are implemented.
 *
 * Keeping this data outside the route makes the scheduling UI configuration-
 * driven and gives the future backend a stable shape to replace.
 */
export const demoBusiness = {
  id: "demo-barbershop",
  name: "Barbearia Marca Minha Vez",
  type: "barbearia",
  description:
    "Escolha seu serviço, profissional e melhor horário. A agenda calcula a disponibilidade automaticamente.",
  services: [
    { id: "corte", name: "Corte", duration: 30, price: 35 },
    { id: "barba", name: "Barba", duration: 30, price: 25 },
    { id: "combo", name: "Corte + Barba", duration: 60, price: 55 },
    { id: "platinado", name: "Platinado", duration: 120, price: 120 },
  ] satisfies Service[],
  professionals: [
    { id: "joao", name: "João" },
    { id: "carlos", name: "Carlos" },
  ] satisfies Professional[],
  weeklySchedule: {
    0: [],
    1: [{ start: "09:00", end: "18:00", breaks: [{ start: "12:00", end: "13:00" }] }],
    2: [{ start: "09:00", end: "18:00", breaks: [{ start: "12:00", end: "13:00" }] }],
    3: [{ start: "09:00", end: "18:00", breaks: [{ start: "12:00", end: "13:00" }] }],
    4: [{ start: "09:00", end: "18:00", breaks: [{ start: "12:00", end: "13:00" }] }],
    5: [{ start: "09:00", end: "18:00", breaks: [{ start: "12:00", end: "13:00" }] }],
    6: [{ start: "09:00", end: "14:00", breaks: [] }],
  } satisfies WeekdaySchedule,
  slotIntervalMinutes: 30,
} as const;

export type DemoBusiness = typeof demoBusiness;
