import { nextPowerOfTwo } from "./draw-by-pairs";
import {
  flattenFapRounds,
  type FapNode,
  type FapQualifier,
} from "./fap-llaves";

/// Orden oficial APA (Reglamento Amateur, confección de draws).
/// Misma lista para cada rango: en zona de 4 también pasan solo 2.
const APA_ORDER_BY_RANGE: { max: number; order: string[] }[] = [
  { max: 8, order: ["1A", "2B", "2A", "1B"] },
  { max: 11, order: ["1A", "2B", "2C", "1C", "2A", "1B"] },
  { max: 14, order: ["1A", "2C", "2B", "1D", "1C", "2A", "2D", "1B"] },
  { max: 17, order: ["1A", "2B", "2C", "1E", "1D", "1C", "2E", "2A", "2D", "1B"] },
  { max: 20, order: ["1A", "2F", "2C", "1E", "2B", "1D", "1C", "2A", "1F", "2E", "2D", "1B"] },
  { max: 23, order: ["1A", "2F", "2G", "1E", "2C", "2B", "1D", "1C", "2A", "2D", "1F", "1G", "2E", "1B"] },
  { max: 26, order: ["1A", "2B", "2G", "1H", "1E", "2F", "2C", "1D", "1C", "2D", "2E", "1F", "1G", "2H", "2A", "1B"] },
  { max: 29, order: ["1A", "2B", "2C", "1I", "1H", "1E", "2G", "2F", "1D", "1C", "2E", "2H", "1F", "1G", "2I", "2D", "2A", "1B"] },
  /// 30–32: 2º F / 1º D repetidos en el PDF se leen como 1º F y 1º J (faltaban en la lista).
  { max: 32, order: ["1A", "2C", "2F", "1I", "1H", "1E", "2J", "2G", "2B", "1D", "1C", "2A", "2H", "2I", "1F", "1G", "1J", "2E", "2D", "1B"] },
];

function officialOrder(pairCount: number): string[] | null {
  if (pairCount < 6) return null;
  const range = APA_ORDER_BY_RANGE.find((item) => pairCount <= item.max);
  return range?.order ?? null;
}

function qualifierFromCode(code: string): FapQualifier {
  const place = Number(code[0]) as 1 | 2 | 3;
  const zone = code.slice(1);
  return { place, zone, label: `${place}° ${zone}` };
}

function expandWithByes(order: string[]): string[] {
  const size = nextPowerOfTwo(order.length);
  const byesNeeded = size - order.length;
  if (byesNeeded === 0) return order;

  const firstIdx = order
    .map((code, index) => (code.startsWith("1") ? index : -1))
    .filter((index) => index >= 0);
  const secondIdx = order
    .map((code, index) => (code.startsWith("2") ? index : -1))
    .filter((index) => index >= 0);

  const recipients: number[] = [];
  let left = 0;
  let right = firstIdx.length - 1;
  while (recipients.length < Math.min(byesNeeded, firstIdx.length) && left <= right) {
    recipients.push(firstIdx[left++]);
    if (recipients.length < Math.min(byesNeeded, firstIdx.length) && left <= right) {
      recipients.push(firstIdx[right--]);
    }
  }

  let extra = byesNeeded - recipients.length;
  let secondLeft = 0;
  let secondRight = secondIdx.length - 1;
  while (extra > 0 && secondLeft <= secondRight) {
    recipients.push(secondIdx[secondRight--]);
    extra -= 1;
    if (extra > 0 && secondLeft <= secondRight) {
      recipients.push(secondIdx[secondLeft++]);
      extra -= 1;
    }
  }

  const byeAt = new Set(recipients);
  const slots: string[] = [];
  for (let index = 0; index < order.length; index++) {
    slots.push(order[index]);
    if (byeAt.has(index)) slots.push("Bye");
  }
  while (slots.length < size) slots.push("Bye");
  return slots.slice(0, size);
}

function leafNode(slot: string): FapNode {
  if (slot === "Bye") return { kind: "bye" };
  return { kind: "qualifier", qualifier: qualifierFromCode(slot) };
}

function buildTree(slots: FapNode[], nextId: { value: number }): FapNode {
  if (slots.length === 1) return slots[0];
  const next: FapNode[] = [];
  for (let index = 0; index < slots.length; index += 2) {
    next.push({
      kind: "match",
      id: nextId.value++,
      left: slots[index],
      right: slots[index + 1] ?? { kind: "bye" },
    });
  }
  return buildTree(next, nextId);
}

export function hasApaLlave(pairCount: number): boolean {
  return officialOrder(pairCount) !== null;
}

export function parseApaLlave(pairCount: number): FapNode | null {
  const order = officialOrder(pairCount);
  if (!order) return null;
  const slots = expandWithByes(order).map(leafNode);
  return buildTree(slots, { value: 1 });
}

export function flattenApaRounds(node: FapNode) {
  return flattenFapRounds(node);
}
