import { jsPDF } from "jspdf";

import type {
  CourtDayRule,
  CourtDaySlot,
  IntegralSimulationSummary,
} from "@/modules/tournaments/domain/court-day-slots";
import {
  breakdownCategorySimulation,
  formatSimulationDuration,
  type CategoryScheduleSimulation,
} from "@/modules/tournaments/domain/simulate-category-schedule";

type RGB = [number, number, number];

const PAGE = {
  margin: 10,
  footer: 8,
};

const COLOR = {
  text: [24, 24, 27] as RGB,
  muted: [113, 113, 122] as RGB,
  line: [228, 228, 231] as RGB,
  cardFill: [255, 251, 235] as RGB,
  cardBorder: [252, 211, 77] as RGB,
  tile: [255, 255, 255] as RGB,
  tileBorder: [228, 228, 231] as RGB,
  chip: [244, 244, 245] as RGB,
  okFill: [209, 250, 229] as RGB,
  okText: [6, 95, 70] as RGB,
  badFill: [255, 228, 230] as RGB,
  badText: [159, 18, 57] as RGB,
  dashed: [212, 212, 216] as RGB,
};

const SLOT: Record<string, { fill: RGB; border: RGB; text: RGB }> = {
  free: { fill: [236, 253, 245], border: [110, 231, 183], text: [6, 78, 59] },
  zones: { fill: [255, 237, 213], border: [251, 146, 60], text: [124, 45, 18] },
  knockout: { fill: [254, 243, 199], border: [251, 191, 36], text: [69, 26, 3] },
  final: { fill: [237, 233, 254], border: [167, 139, 250], text: [46, 16, 101] },
  blocked: { fill: [228, 228, 231], border: [212, 212, 216], text: [82, 82, 91] },
  reserved: { fill: [254, 226, 226], border: [252, 165, 165], text: [127, 29, 29] },
};

export type SimulationPdfCategory = {
  id: string;
  name: string;
  abbreviation: string | null;
  color: string;
  result: CategoryScheduleSimulation;
};

export function downloadSimulationPdf({
  tournamentName,
  courtCount,
  playDayCount,
  rows,
  summary,
  rules,
}: {
  tournamentName: string;
  courtCount: number;
  playDayCount: number;
  rows: SimulationPdfCategory[];
  summary: IntegralSimulationSummary;
  rules: CourtDayRule[];
}) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - PAGE.margin * 2;
  let y = PAGE.margin + 5;

  const ensure = (need: number) => {
    if (y + need <= pageH - PAGE.footer) return;
    doc.addPage();
    y = PAGE.margin;
    drawPageChrome(doc, pageW, tournamentName);
    y = PAGE.margin + 8;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setText(doc, COLOR.text);
  doc.text(tournamentName || "Simulación de torneo", PAGE.margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(doc, COLOR.muted);
  doc.text(
    "Cada categoría con sus confirmadas, zonas y llave. Abajo, la grilla integral de canchas.",
    PAGE.margin,
    y,
  );
  y += 7;

  for (const row of rows) {
    const stats = categoryStats(row);
    const cardH = categoryCardHeight(contentW, stats.length);
    ensure(cardH + 3);
    drawCategoryCard(doc, PAGE.margin, y, contentW, row, stats);
    y += cardH + 3;
  }

  y += 2;
  ensure(28);

  const sectionTop = y;
  doc.setDrawColor(...COLOR.dashed);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.setFillColor(252, 252, 253);
  doc.roundedRect(PAGE.margin, y, contentW, 22, 2, 2, "FD");
  doc.setLineDashPattern([], 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setText(doc, COLOR.text);
  doc.text("Simulación integral", PAGE.margin + 4, sectionTop + 7);

  const badge = summary.fits
    ? { label: "El tiempo alcanza", fill: COLOR.okFill, text: COLOR.okText }
    : { label: "No alcanza el tiempo", fill: COLOR.badFill, text: COLOR.badText };
  const badgeW = doc.getTextWidth(badge.label) + 8;
  drawPill(
    doc,
    PAGE.margin + contentW - badgeW - 4,
    sectionTop + 3.2,
    badgeW,
    5.6,
    badge.fill,
    badge.text,
    badge.label,
  );

  const summaryLine = [
    `${rows.length} categoría${rows.length === 1 ? "" : "s"}`,
    `${summary.matchCount} partidos`,
    `${courtCount} cancha${courtCount === 1 ? "" : "s"}`,
    `${playDayCount} día${playDayCount === 1 ? "" : "s"} de juego`,
    `${summary.usedCells}/${summary.totalCells} slots ocupados`,
    `necesario ${formatSimulationDuration(summary.minutesNeeded)}`,
    summary.surplusMinutes >= 0
      ? `sobra ${formatSimulationDuration(summary.surplusMinutes)}`
      : `falta ${formatSimulationDuration(Math.abs(summary.surplusMinutes))}`,
  ].join("  ·  ");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setText(doc, COLOR.muted);
  const summaryLines = doc.splitTextToSize(summaryLine, contentW - 8);
  doc.text(summaryLines, PAGE.margin + 4, sectionTop + 14);
  y = sectionTop + 22 + Math.max(0, (summaryLines.length - 1) * 3.6) + 4;

  const miniW = (contentW - 6) / 3;
  ensure(16);
  drawMiniStat(
    doc,
    PAGE.margin,
    y,
    miniW,
    "Total necesario",
    formatSimulationDuration(summary.minutesNeeded),
  );
  drawMiniStat(
    doc,
    PAGE.margin + miniW + 3,
    y,
    miniW,
    "Total disponible",
    formatSimulationDuration(summary.minutesAvailable),
  );
  drawMiniStat(
    doc,
    PAGE.margin + (miniW + 3) * 2,
    y,
    miniW,
    summary.surplusMinutes >= 0 ? "Sobra (según regla)" : "Falta (según regla)",
    formatSimulationDuration(Math.abs(summary.surplusMinutes)),
    summary.surplusMinutes >= 0 ? COLOR.okText : COLOR.badText,
  );
  y += 18;

  ensure(28);
  y = drawPhaseTable(doc, PAGE.margin, y, contentW, summary) + 5;

  ensure(10);
  y = drawLegend(doc, PAGE.margin, y, rows) + 5;

  const colorById = new Map(rows.map((row) => [row.id, parseColor(row.color)]));

  for (const day of rules) {
    const dayBlock = dayGridHeight(day, contentW);
    ensure(Math.min(dayBlock, 40));
    y = drawDayGrid(doc, PAGE.margin, y, contentW, day, colorById, ensure);
    y += 5;
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setText(doc, COLOR.muted);
    doc.text(
      `VeloxCourt  ·  ${i} / ${pages}`,
      pageW / 2,
      pageH - 4,
      { align: "center" },
    );
  }

  savePdfWithoutLocking(doc, tournamentName);
}

function categoryStats(row: SimulationPdfCategory) {
  const breakdown = breakdownCategorySimulation(row.result);
  const stats: { label: string; value: string }[] = [
    { label: "Confirmadas (simulación)", value: String(row.result.confirmedPairs) },
    { label: "Partidos totales", value: String(breakdown.totalMatches) },
    { label: "Zonas de 3", value: String(breakdown.zonesOf3) },
    { label: "Zonas de 4", value: String(breakdown.zonesOf4) },
  ];
  if (breakdown.zonesOf2 > 0) {
    stats.push({ label: "Zonas de 2", value: String(breakdown.zonesOf2) });
  }
  stats.push({ label: "Partidos zona", value: String(breakdown.zoneMatches) });
  for (const round of breakdown.knockoutRounds) {
    stats.push({ label: round.label, value: String(round.matches) });
  }
  return stats;
}

function tilesPerRow(contentW: number) {
  return Math.max(4, Math.min(8, Math.floor((contentW - 6) / 32)));
}

function categoryCardHeight(contentW: number, statCount: number) {
  const cols = tilesPerRow(contentW);
  const rows = Math.ceil(statCount / cols);
  return 8 + rows * 13.2 + 4;
}

function drawCategoryCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  row: SimulationPdfCategory,
  stats: { label: string; value: string }[],
) {
  const h = categoryCardHeight(w, stats.length);
  doc.setFillColor(...COLOR.cardFill);
  doc.setDrawColor(...COLOR.cardBorder);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y, w, h, 2.2, 2.2, "FD");

  const color = parseColor(row.color);
  doc.setFillColor(...color);
  doc.circle(x + 5.2, y + 5.2, 1.7, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setText(doc, COLOR.text);
  const name = ellipsize(doc, row.name, w - 40);
  doc.text(name, x + 8.6, y + 6.2);

  if (row.abbreviation) {
    const chip = row.abbreviation;
    const chipW = doc.getTextWidth(chip) + 4;
    doc.setFillColor(...COLOR.chip);
    doc.setDrawColor(...COLOR.tileBorder);
    doc.setLineWidth(0.15);
    const chipX = x + 10 + doc.getTextWidth(name);
    doc.roundedRect(chipX, y + 2.6, chipW, 4.4, 1, 1, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setText(doc, COLOR.muted);
    doc.text(chip, chipX + 2, y + 5.7);
  }

  const cols = tilesPerRow(w);
  const gap = 2;
  const tileW = (w - 6 - gap * (cols - 1)) / cols;
  const tileH = 11.4;
  stats.forEach((stat, index) => {
    const col = index % cols;
    const rowIndex = Math.floor(index / cols);
    const tx = x + 3 + col * (tileW + gap);
    const ty = y + 9.2 + rowIndex * (tileH + 1.8);
    doc.setFillColor(...COLOR.tile);
    doc.setDrawColor(...COLOR.tileBorder);
    doc.setLineWidth(0.2);
    doc.roundedRect(tx, ty, tileW, tileH, 1.2, 1.2, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    setText(doc, COLOR.muted);
    doc.text(ellipsize(doc, stat.label, tileW - 3), tx + 1.6, ty + 3.4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    setText(doc, COLOR.text);
    doc.text(stat.value, tx + 1.6, ty + 9);
  });
}

function drawMiniStat(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  valueColor: RGB = COLOR.text,
) {
  doc.setFillColor(...COLOR.tile);
  doc.setDrawColor(...COLOR.tileBorder);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, 14, 1.6, 1.6, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setText(doc, COLOR.muted);
  doc.text(label, x + 3, y + 4.6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setText(doc, valueColor);
  doc.text(value, x + 3, y + 10.4);
}

function drawPhaseTable(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  summary: IntegralSimulationSummary,
): number {
  const cols = [0.22, 0.12, 0.14, 0.18, 0.18, 0.16];
  const widths = cols.map((part) => part * w);
  const rowH = 6.2;
  const headers = ["Fase", "Partidos", "Días", "Necesario", "Disponible", "Balance"];

  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(...COLOR.line);
  doc.rect(x, y, w, rowH, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setText(doc, COLOR.muted);
  let cx = x;
  headers.forEach((header, i) => {
    doc.text(header, cx + 2, y + 4.2);
    cx += widths[i]!;
  });
  y += rowH;

  for (const phase of summary.phases) {
    const days = phase.missingPlayDates ? "Sin asignar" : String(phase.dayCount);
    const matches =
      phase.packedCount < phase.matchCount
        ? `${phase.packedCount}/${phase.matchCount}`
        : String(phase.matchCount);
    const balance =
      phase.matchCount === 0
        ? "—"
        : phase.missingPlayDates
          ? "Sin días"
          : `${phase.surplusMinutes >= 0 ? "Sobra" : "Falta"} ${formatSimulationDuration(Math.abs(phase.surplusMinutes))}`;
    const values = [
      phase.label,
      matches,
      days,
      formatSimulationDuration(phase.minutesNeeded),
      formatSimulationDuration(phase.minutesAvailable),
      balance,
    ];
    doc.setDrawColor(...COLOR.line);
    doc.setLineWidth(0.15);
    doc.line(x, y + rowH, x + w, y + rowH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    cx = x;
    values.forEach((value, i) => {
      if (i === 0) doc.setFont("helvetica", "bold");
      else doc.setFont("helvetica", "normal");
      if (i === 5 && phase.matchCount > 0) {
        setText(doc, phase.fits ? COLOR.okText : COLOR.badText);
      } else {
        setText(doc, COLOR.text);
      }
      doc.text(value, cx + 2, y + 4.3);
      cx += widths[i]!;
    });
    y += rowH;
  }
  return y;
}

function drawLegend(
  doc: jsPDF,
  x: number,
  y: number,
  rows: SimulationPdfCategory[],
): number {
  const items: { fill: RGB; border: RGB; label: string }[] = [
    { ...SLOT.free, label: "Libre" },
    { ...SLOT.zones, label: "Zonas" },
    { ...SLOT.knockout, label: "Intermedia" },
    { ...SLOT.final, label: "Final" },
  ];
  let cx = x;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  for (const item of items) {
    doc.setFillColor(...item.fill);
    doc.setDrawColor(...item.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, y, 4.2, 3.4, 0.6, 0.6, "FD");
    setText(doc, COLOR.muted);
    doc.text(item.label, cx + 5.2, y + 2.6);
    cx += 8 + doc.getTextWidth(item.label) + 4;
  }
  y += 6;
  cx = x;
  const maxX = doc.internal.pageSize.getWidth() - PAGE.margin;
  for (const row of rows) {
    const color = parseColor(row.color);
    const label = row.abbreviation || row.name;
    const itemW = 7 + doc.getTextWidth(label) + 4;
    if (cx + itemW > maxX) {
      y += 5;
      cx = x;
    }
    doc.setFillColor(...color);
    doc.circle(cx + 1.6, y + 1.5, 1.6, "F");
    setText(doc, COLOR.muted);
    doc.text(label, cx + 4.2, y + 2.4);
    cx += itemW;
  }
  return y + 3;
}

function dayGridHeight(day: CourtDayRule, contentW: number) {
  const layout = slotLayout(day, contentW);
  return 8 + day.courts.length * (layout.rowCount * (layout.slotH + layout.gap) + 2);
}

function slotLayout(day: CourtDayRule, contentW: number) {
  const slotCount = day.courts[0]?.slots.length ?? 0;
  const courtLabelW = 20;
  const gap = 1.5;
  const available = Math.max(20, contentW - courtLabelW);
  const minW = 11;
  if (slotCount === 0) {
    return {
      courtLabelW,
      gap,
      slotW: available,
      slotH: 16,
      fontSize: 9,
      dotR: 1.8,
      slotsPerRow: 1,
      rowCount: 1,
    };
  }
  let slotsPerRow = slotCount;
  let slotW = (available - (slotCount - 1) * gap) / slotCount;
  if (slotW < minW) {
    slotsPerRow = Math.max(1, Math.floor((available + gap) / (minW + gap)));
    slotW = (available - (slotsPerRow - 1) * gap) / slotsPerRow;
  }
  const slotH = Math.min(18, Math.max(13, slotW * 0.58));
  const fontSize = Math.min(10, Math.max(7.2, slotW * 0.34));
  const dotR = Math.min(2.3, Math.max(1.5, slotW * 0.075));
  return {
    courtLabelW,
    gap,
    slotW,
    slotH,
    fontSize,
    dotR,
    slotsPerRow,
    rowCount: Math.ceil(slotCount / slotsPerRow),
  };
}

function drawDayGrid(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  day: CourtDayRule,
  colorById: Map<string, RGB>,
  ensure: (need: number) => void,
): number {
  const title = [
    day.dayLabel,
    day.playDate,
    `${day.startTime}–${day.endTime}`,
    day.slotMinutes ? `slots de ${day.slotMinutes} min` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setText(doc, COLOR.text);
  doc.text(title, x, y + 4);
  y += 7;

  const layout = slotLayout(day, w);
  const { slotH, fontSize, dotR } = layout;

  for (const court of day.courts) {
    const courtH = layout.rowCount * (slotH + layout.gap);
    ensure(courtH + 2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setText(doc, COLOR.muted);
    doc.text(court.courtLabel, x, y + slotH / 2 + 1.2);

    court.slots.forEach((slot, index) => {
      const col = index % layout.slotsPerRow;
      const row = Math.floor(index / layout.slotsPerRow);
      const sx = x + layout.courtLabelW + col * (layout.slotW + layout.gap);
      const sy = y + row * (slotH + layout.gap);
      drawSlot(doc, sx, sy, layout.slotW, slotH, slot, colorById, fontSize, dotR);
    });
    y += courtH + 2.2;
  }
  return y;
}

function drawSlot(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  slot: CourtDaySlot,
  colorById: Map<string, RGB>,
  fontSize: number,
  dotR: number,
) {
  const style = slotStyle(slot);
  doc.setFillColor(...style.fill);
  doc.setDrawColor(...style.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 1.4, 1.4, "FD");

  const hasDot = Boolean(slot.projectedCategoryId);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  setText(doc, style.text);
  doc.text(slot.startTime, x + w / 2, y + (hasDot ? h * 0.42 : h / 2 + fontSize * 0.12), {
    align: "center",
  });

  if (hasDot) {
    const color = colorById.get(slot.projectedCategoryId!) ?? [148, 163, 184];
    doc.setFillColor(...color);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.15);
    doc.circle(x + w / 2, y + h - dotR - 1.6, dotR, "FD");
  }
}

function slotStyle(slot: CourtDaySlot) {
  if (slot.status === "free") return SLOT.free;
  if (slot.status === "blocked") return SLOT.blocked;
  if (slot.status === "reserved") return SLOT.reserved;
  if (slot.status === "projected") {
    if (slot.projectedPhase === "knockout") return SLOT.knockout;
    if (slot.projectedPhase === "final") return SLOT.final;
    return SLOT.zones;
  }
  return SLOT.free;
}

function drawPill(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: RGB,
  text: RGB,
  label: string,
) {
  doc.setFillColor(...fill);
  doc.setDrawColor(...fill);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setText(doc, text);
  doc.text(label, x + w / 2, y + h / 2 + 1.1, { align: "center" });
}

function drawPageChrome(doc: jsPDF, pageW: number, tournamentName: string) {
  if (doc.getCurrentPageInfo().pageNumber === 1) return;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setText(doc, COLOR.muted);
  doc.text(
    ellipsize(doc, `Simulación  ·  ${tournamentName}`, pageW - PAGE.margin * 2),
    PAGE.margin,
    PAGE.margin + 2,
  );
  doc.setDrawColor(...COLOR.line);
  doc.setLineWidth(0.2);
  doc.line(PAGE.margin, PAGE.margin + 4, pageW - PAGE.margin, PAGE.margin + 4);
}

function setText(doc: jsPDF, color: RGB) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function parseColor(value: string): RGB {
  const hex = value.trim();
  const raw = hex.startsWith("#") ? hex.slice(1) : hex;
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return [
      Number.parseInt(raw[0]! + raw[0], 16),
      Number.parseInt(raw[1]! + raw[1], 16),
      Number.parseInt(raw[2]! + raw[2], 16),
    ];
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    return [
      Number.parseInt(raw.slice(0, 2), 16),
      Number.parseInt(raw.slice(2, 4), 16),
      Number.parseInt(raw.slice(4, 6), 16),
    ];
  }
  const rgb = hex.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    return [
      Number.parseInt(rgb[1]!, 10),
      Number.parseInt(rgb[2]!, 10),
      Number.parseInt(rgb[3]!, 10),
    ];
  }
  return [148, 163, 184];
}

function ellipsize(doc: jsPDF, text: string, maxWidth: number) {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(`${cut}…`) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

function slugifyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function uniqueFilename(name: string): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  return `simulacion-${slugifyName(name) || "torneo"}-${stamp}.pdf`;
}

function savePdfWithoutLocking(doc: jsPDF, tournamentName: string) {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const filename = uniqueFilename(tournamentName);

  window.open(url, "_blank", "noopener,noreferrer");

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
}
