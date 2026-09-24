import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

import type { PlayerRef } from "@/modules/bookings/domain/types";
import type { PairListItem } from "@/modules/tournaments/domain/types";

export type InscriptionsPdfInput = {
  tournamentName: string;
  categoryName: string;
  pairs: PairListItem[];
  players: PlayerRef[];
};

type PdfRow = {
  number: string;
  name: string;
  city: string;
  paid: boolean;
};

function slugifyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function cityOf(players: PlayerRef[], playerId: string): string {
  return players.find((player) => player.id === playerId)?.city?.trim() ?? "";
}

function rowsForCategory(input: InscriptionsPdfInput): PdfRow[] {
  const rows: PdfRow[] = [];
  let pairNumber = 0;
  for (const pair of input.pairs) {
    if (pair.status === "CANCELLED") continue;
    pairNumber += 1;
    const label = String(pairNumber);
    rows.push({
      number: label,
      name: pair.player1.name,
      city: cityOf(input.players, pair.player1.id),
      paid: pair.player1PaymentStatus === "PAID",
    });
    if (pair.player2) {
      rows.push({
        number: label,
        name: pair.player2.name,
        city: cityOf(input.players, pair.player2.id),
        paid: pair.player2PaymentStatus === "PAID",
      });
    }
  }
  return rows;
}

function drawPaymentBox(
  doc: jsPDF,
  cell: { x: number; y: number; width: number; height: number },
  paid: boolean,
) {
  const size = 3.4;
  const x = cell.x + (cell.width - size) / 2;
  const y = cell.y + (cell.height - size) / 2;
  doc.setDrawColor(24, 24, 27);
  doc.setLineWidth(0.25);
  doc.rect(x, y, size, size);
  if (!paid) return;
  doc.setLineWidth(0.45);
  doc.line(x + 0.6, y + size * 0.52, x + size * 0.38, y + size - 0.55);
  doc.line(x + size * 0.38, y + size - 0.55, x + size - 0.45, y + 0.7);
}

export function downloadInscriptionsPdf(input: InscriptionsPdfInput) {
  const rows = rowsForCategory(input);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pairCount = new Set(rows.map((row) => row.number)).size;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(24, 24, 27);
  doc.text(input.tournamentName || "Torneo", 10, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(input.categoryName, 10, 18);

  doc.setFontSize(9);
  doc.setTextColor(113, 113, 122);
  doc.text(
    `${pairCount} pareja${pairCount === 1 ? "" : "s"} · ${rows.length} jugador${rows.length === 1 ? "" : "es"}`,
    10,
    23,
  );

  autoTable(doc, {
    startY: 27,
    head: [["#", "Nombre y apellido", "Localidad", "Pagó", "Forma de pago"]],
    body: rows.map((row) => [row.number, row.name, row.city, "", ""]),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2.2,
      textColor: [24, 24, 27],
      lineColor: [212, 212, 216],
      lineWidth: 0.2,
      overflow: "linebreak",
      valign: "middle",
      minCellHeight: 8,
    },
    headStyles: {
      fillColor: [24, 24, 27],
      textColor: [250, 250, 250],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 68 },
      2: { cellWidth: 42 },
      3: { cellWidth: 16, halign: "center" },
    },
    margin: { left: 10, right: 10, bottom: 12 },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const row = rows[data.row.index];
      if (!row) return;
      const pairIndex = Number(row.number);
      if (pairIndex % 2 === 0) {
        data.cell.styles.fillColor = [250, 250, 250];
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 3) return;
      const row = rows[data.row.index];
      if (!row) return;
      drawPaymentBox(doc, data.cell, row.paid);
    },
    didDrawPage: (data) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(113, 113, 122);
      doc.text(
        `${input.categoryName}  ·  ${input.tournamentName}`,
        10,
        doc.internal.pageSize.getHeight() - 6,
      );
      doc.text(
        String(data.pageNumber),
        pageW - 10,
        doc.internal.pageSize.getHeight() - 6,
        { align: "right" },
      );
    },
  });

  const filename = `parejas-${slugifyName(input.categoryName) || "categoria"}.pdf`;
  doc.save(filename);
}
