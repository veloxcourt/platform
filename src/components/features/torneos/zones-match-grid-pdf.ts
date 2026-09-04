import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

import {
  formatGridCourt,
  formatGridHorario,
  type ZonesMatchGridRow,
} from "./zones-match-grid-model";

export type GrillaPdfAction = "open" | "create-open" | "copy";

const DEFAULT_GROUP_COLUMN = "Zona";

function tableHead(groupColumnLabel: string) {
  return [
    "Índice",
    "Horario",
    "Cancha",
    "Categoría",
    groupColumnLabel,
    "Número",
    "Pareja 1",
    "Pareja 2",
    "Observación",
  ];
}

type BuiltPdf = {
  blob: Blob;
  filename: string;
};

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
  return `grilla-${slugifyName(name) || "torneo"}-${stamp}.pdf`;
}

function tableBody(rows: ZonesMatchGridRow[]) {
  return rows.map((row, index) => [
    String(index + 1),
    formatGridHorario(row),
    formatGridCourt(row),
    row.categoryLabel,
    row.zoneLetter,
    String(row.matchNumber),
    row.pair1,
    row.pair2,
    row.observation || "—",
  ]);
}

function buildGrillaPdf(
  tournamentName: string,
  rows: ZonesMatchGridRow[],
  groupColumnLabel: string,
): BuiltPdf {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(24, 24, 27);
  doc.text(tournamentName || "Grilla de partidos", 10, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(113, 113, 122);
  doc.text(
    `Orden de largada · ${rows.length} partido${rows.length === 1 ? "" : "s"} · a igual horario, Cancha 1 y después Cancha 2`,
    10,
    18,
  );

  autoTable(doc, {
    startY: 22,
    head: [tableHead(groupColumnLabel)],
    body: tableBody(rows),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 1.4,
      textColor: [24, 24, 27],
      lineColor: [228, 228, 231],
      lineWidth: 0.15,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [24, 24, 27],
      textColor: [250, 250, 250],
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
      valign: "middle",
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 28 },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: 22, halign: "center" },
      5: { cellWidth: 16, halign: "center" },
      6: { cellWidth: 48 },
      7: { cellWidth: 48 },
    },
    margin: { left: 10, right: 10, bottom: 10 },
    didDrawPage: (data) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(113, 113, 122);
      doc.text(
        `Grilla  ·  ${tournamentName}`,
        10,
        doc.internal.pageSize.getHeight() - 5,
      );
      doc.text(
        String(data.pageNumber),
        pageW - 10,
        doc.internal.pageSize.getHeight() - 5,
        { align: "right" },
      );
    },
  });

  return {
    blob: doc.output("blob"),
    filename: uniqueFilename(tournamentName),
  };
}

function openPdfBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
}

function downloadPdfBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
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

function renderGrillaPng(
  tournamentName: string,
  rows: ZonesMatchGridRow[],
  groupColumnLabel: string,
): Promise<Blob> {
  const scale = 2;
  const cols = [
    { key: "index", label: "Índice", width: 56 },
    { key: "horario", label: "Horario", width: 150 },
    { key: "cancha", label: "Cancha", width: 70 },
    { key: "categoria", label: "Categoría", width: 90 },
    { key: "zona", label: groupColumnLabel, width: 88 },
    { key: "numero", label: "Número", width: 70 },
    { key: "pair1", label: "Pareja 1", width: 220 },
    { key: "pair2", label: "Pareja 2", width: 220 },
    { key: "obs", label: "Observación", width: 220 },
  ] as const;
  const tableW = cols.reduce((sum, col) => sum + col.width, 0);
  const pad = 28;
  const titleH = 44;
  const rowH = 26;
  const headerH = 28;
  const width = pad * 2 + tableW;
  const height = pad * 2 + titleH + headerH + rows.length * rowH;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("no ctx"));

  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#18181b";
  ctx.font = "bold 20px Helvetica, Arial, sans-serif";
  ctx.fillText(tournamentName || "Grilla de partidos", pad, pad + 18);

  ctx.fillStyle = "#71717a";
  ctx.font = "12px Helvetica, Arial, sans-serif";
  ctx.fillText(
    `Orden de largada · ${rows.length} partido${rows.length === 1 ? "" : "s"}`,
    pad,
    pad + 36,
  );

  const tableX = pad;
  const tableY = pad + titleH;

  ctx.fillStyle = "#18181b";
  ctx.fillRect(tableX, tableY, tableW, headerH);
  ctx.fillStyle = "#fafafa";
  ctx.font = "bold 11px Helvetica, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let x = tableX;
  for (const col of cols) {
    ctx.fillText(col.label, x + col.width / 2, tableY + headerH / 2);
    x += col.width;
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  rows.forEach((row, index) => {
    const y = tableY + headerH + index * rowH;
    ctx.fillStyle = index % 2 === 0 ? "#ffffff" : "#f4f4f5";
    ctx.fillRect(tableX, y, tableW, rowH);
    ctx.strokeStyle = "#e4e4e7";
    ctx.lineWidth = 1;
    ctx.strokeRect(tableX, y, tableW, rowH);

    const values = [
      String(index + 1),
      formatGridHorario(row),
      formatGridCourt(row),
      row.categoryLabel,
      row.zoneLetter,
      String(row.matchNumber),
      row.pair1,
      row.pair2,
      row.observation || "—",
    ];
    ctx.fillStyle = "#18181b";
    ctx.font = "12px Helvetica, Arial, sans-serif";
    let cellX = tableX;
    const centeredCols = new Set([0, 2, 3, 4, 5]);
    values.forEach((value, colIndex) => {
      const col = cols[colIndex]!;
      const max = col.width - 14;
      let text = value;
      while (text.length > 1 && ctx.measureText(text).width > max) {
        text = `${text.slice(0, -2)}…`;
      }
      if (centeredCols.has(colIndex)) {
        ctx.textAlign = "center";
        ctx.fillText(text, cellX + col.width / 2, y + 17);
        ctx.textAlign = "left";
      } else {
        ctx.fillText(text, cellX + 8, y + 17);
      }
      cellX += col.width;
    });
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      blob ? resolve(blob) : reject(new Error("no png"));
    }, "image/png");
  });
}

async function copyForWhatsApp(
  pdf: BuiltPdf,
  rows: ZonesMatchGridRow[],
  tournamentName: string,
  groupColumnLabel: string,
) {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    throw new Error("clipboard-unsupported");
  }

  const png = await renderGrillaPng(tournamentName, rows, groupColumnLabel);
  const pdfFile = new File([pdf.blob], pdf.filename, {
    type: "application/pdf",
  });

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "application/pdf": pdfFile,
        "image/png": png,
      }),
    ]);
    return;
  } catch {
    // WhatsApp Web pega imagen; el PDF no siempre entra al portapapeles.
  }

  try {
    await navigator.clipboard.write([
      new ClipboardItem({ "application/pdf": pdfFile }),
    ]);
    return;
  } catch {
    // Seguir con PNG.
  }

  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": png }),
  ]);
}

export async function runGrillaPdfAction({
  action,
  tournamentName,
  rows,
  groupColumnLabel = DEFAULT_GROUP_COLUMN,
}: {
  action: GrillaPdfAction;
  tournamentName: string;
  rows: ZonesMatchGridRow[];
  groupColumnLabel?: string;
}) {
  if (rows.length === 0) {
    throw new Error("No hay partidos para exportar");
  }

  const pdf = buildGrillaPdf(tournamentName, rows, groupColumnLabel);

  if (action === "open") {
    openPdfBlob(pdf.blob);
    return;
  }

  if (action === "create-open") {
    downloadPdfBlob(pdf.blob, pdf.filename);
    openPdfBlob(pdf.blob);
    return;
  }

  await copyForWhatsApp(pdf, rows, tournamentName, groupColumnLabel);
}
