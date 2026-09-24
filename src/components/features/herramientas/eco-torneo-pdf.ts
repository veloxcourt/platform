import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

import { copyPdfToClipboard } from "@/lib/clipboard-pdf";
import {
  copyPngToClipboard,
  downloadPngBlob,
  openPngBlob,
} from "@/lib/clipboard-png";
import { formatMoney } from "@/lib/money";
import {
  ECO_CATEGORY_DEFS,
  computeGroupSaldoCents,
  computePlanilla,
  type EcoGroup,
  type EcoItem,
} from "@/modules/herramientas/domain/eco-torneo";
import type { GrillaPdfAction } from "@/components/features/torneos/zones-match-grid-pdf";

export type EcoPdfSnapshot = {
  clubName: string;
  simulationName: string;
  currency: string;
  items: EcoItem[];
  groups: EcoGroup[];
};

let snapshot: EcoPdfSnapshot | null = null;

export function setEcoPdfSnapshot(next: EcoPdfSnapshot | null) {
  snapshot = next;
}

export function getEcoPdfSnapshot() {
  return snapshot;
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

function uniqueFilename(name: string, ext: "pdf" | "png" = "pdf"): string {
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
  return `eco-torneo-${slugifyName(name) || "planilla"}-${stamp}.${ext}`;
}

function formatValor(
  item: EcoItem,
  restoPct: number | null,
  currency: string,
): string {
  const def = ECO_CATEGORY_DEFS[item.category];
  if (def.formula === "pct_inscripciones") {
    return item.porcentaje == null ? "—" : `${item.porcentaje}%`;
  }
  if (def.formula === "resto_pct_inscripciones") {
    return `${restoPct ?? 0}%`;
  }
  if (def.formula === "cantidad_x_valor" || def.formula === "valor") {
    return item.valorCents == null
      ? "—"
      : formatMoney(item.valorCents, currency);
  }
  return "—";
}

function lastTableY(doc: jsPDF, fallback: number) {
  return (
    (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY ?? fallback
  );
}

function drawPageChrome(doc: jsPDF, title: string) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(113, 113, 122);
  doc.text(`Eco-Torneo  ·  ${title}`, 10, doc.internal.pageSize.getHeight() - 5);
  doc.text(
    String(doc.getNumberOfPages()),
    pageW - 10,
    doc.internal.pageSize.getHeight() - 5,
    { align: "right" },
  );
}

function drawGroupCards(
  doc: jsPDF,
  groups: EcoGroup[],
  planilla: ReturnType<typeof computePlanilla>,
  currency: string,
  startY: number,
  title: string,
) {
  if (groups.length === 0) return;

  const margin = 10;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const gap = 3;
  const cardW = 46;
  const cardH = 16;
  const perRow = Math.max(
    1,
    Math.floor((pageW - margin * 2 + gap) / (cardW + gap)),
  );

  let y = startY + 6;
  groups.forEach((group, index) => {
    const col = index % perRow;
    if (col === 0 && index > 0) y += cardH + gap;
    if (y + cardH > pageH - 12) {
      doc.addPage();
      drawPageChrome(doc, title);
      y = 12;
    }

    const x = margin + col * (cardW + gap);
    const saldo = computeGroupSaldoCents(group, planilla.lines);

    doc.setDrawColor(212, 212, 216);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(113, 113, 122);
    const label = doc.splitTextToSize(group.name, cardW - 5);
    doc.text(Array.isArray(label) ? label[0] : label, x + 2.5, y + 5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    if (saldo < 0) doc.setTextColor(185, 28, 28);
    else doc.setTextColor(24, 24, 27);
    doc.text(formatMoney(saldo, currency), x + 2.5, y + 12);
  });
}

function buildEcoTorneoPdf(data: EcoPdfSnapshot): BuiltPdf {
  const planilla = computePlanilla(data.items);
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  const title = data.simulationName || "Eco-Torneo";
  const money = (cents: number) => formatMoney(cents, data.currency);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(24, 24, 27);
  doc.text(title, 10, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(113, 113, 122);
  const subtitle = [data.clubName, "Eco-Torneo"].filter(Boolean).join(" · ");
  doc.text(subtitle, 10, 17);

  autoTable(doc, {
    startY: 21,
    head: [
      [
        "Saldo",
        "Categoría",
        "Observación",
        "Cant.",
        "Valor / %",
        "Debe",
        "Haber",
      ],
    ],
    body: planilla.lines.map(({ item, debeCents, haberCents, restoPct }) => {
      const def = ECO_CATEGORY_DEFS[item.category];
      return [
        item.enSaldo === false ? "No" : "Sí",
        `${def.label}\n${def.flow}`,
        item.observacion.trim() || "—",
        def.formula === "cantidad_x_valor"
          ? item.cantidad == null
            ? "—"
            : String(item.cantidad)
          : "—",
        formatValor(item, restoPct, data.currency),
        debeCents > 0 ? money(debeCents) : "—",
        haberCents > 0 ? money(haberCents) : "—",
      ];
    }),
    foot: [
      [
        "",
        { content: "Totales (ítems en saldo)", colSpan: 4 },
        money(planilla.totalDebeCents),
        money(planilla.totalHaberCents),
      ],
      [
        "",
        { content: "Saldo (Debe − Haber)", colSpan: 4 },
        "",
        money(planilla.saldoCents),
      ],
    ],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7,
      cellPadding: 1.2,
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
      fontSize: 6.5,
      halign: "center",
      valign: "middle",
    },
    footStyles: {
      fillColor: [244, 244, 245],
      textColor: [24, 24, 27],
      fontStyle: "bold",
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 34 },
      2: { cellWidth: 48 },
      3: { cellWidth: 16, halign: "right" },
      4: { cellWidth: 24, halign: "right" },
      5: { cellWidth: 28, halign: "right" },
      6: { cellWidth: 28, halign: "right" },
    },
    margin: { left: 10, right: 10, bottom: 10 },
    didParseCell: (hook) => {
      if (hook.section === "body") {
        const line = planilla.lines[hook.row.index];
        if (!line) return;
        hook.cell.styles.fillColor =
          line.item.enSaldo === false ? [254, 242, 242] : [236, 253, 245];
        return;
      }
      if (hook.section === "foot") {
        hook.cell.styles.halign =
          hook.column.index >= 5 ? "right" : "left";
      }
    },
    didDrawPage: () => {
      drawPageChrome(doc, title);
    },
  });

  drawGroupCards(
    doc,
    data.groups,
    planilla,
    data.currency,
    lastTableY(doc, 21),
    title,
  );

  return {
    blob: doc.output("blob"),
    filename: uniqueFilename(title),
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

export async function runEcoTorneoPdfAction(action: GrillaPdfAction) {
  const data = getEcoPdfSnapshot();
  if (!data) {
    throw new Error("No hay una planilla para exportar");
  }

  const pdf = buildEcoTorneoPdf(data);

  if (action === "open") {
    openPdfBlob(pdf.blob);
    return;
  }

  if (action === "create-open") {
    downloadPdfBlob(pdf.blob, pdf.filename);
    openPdfBlob(pdf.blob);
    return;
  }

  return copyPdfToClipboard(pdf.blob, pdf.filename);
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  let next = text;
  while (next.length > 1 && ctx.measureText(next).width > maxWidth) {
    next = `${next.slice(0, -2)}…`;
  }
  return next;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function renderEcoTorneoPng(data: EcoPdfSnapshot): Promise<Blob> {
  const planilla = computePlanilla(data.items);
  const money = (cents: number) => formatMoney(cents, data.currency);
  const cols = [
    { key: "saldo", label: "Saldo", width: 56, align: "center" },
    { key: "cat", label: "Categoría", width: 168, align: "left" },
    { key: "obs", label: "Observación", width: 220, align: "left" },
    { key: "cant", label: "Cant.", width: 64, align: "right" },
    { key: "valor", label: "Valor / %", width: 110, align: "right" },
    { key: "debe", label: "Debe", width: 120, align: "right" },
    { key: "haber", label: "Haber", width: 120, align: "right" },
  ] as const;
  const tableW = cols.reduce((sum, col) => sum + col.width, 0);
  const pad = 28;
  const titleH = 48;
  const headerH = 28;
  const rowH = 36;
  const footH = 28;
  const cardW = 188;
  const cardH = 58;
  const cardGap = 10;
  const cardsPerRow = Math.max(1, Math.floor((tableW + cardGap) / (cardW + cardGap)));
  const groupRows = Math.ceil(data.groups.length / cardsPerRow);
  const groupsH =
    data.groups.length === 0 ? 0 : 18 + groupRows * cardH + (groupRows - 1) * cardGap;
  const width = pad * 2 + tableW;
  const height =
    pad * 2 +
    titleH +
    headerH +
    planilla.lines.length * rowH +
    footH * 2 +
    groupsH;

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("no ctx"));

  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const title = data.simulationName || "Eco-Torneo";
  ctx.fillStyle = "#18181b";
  ctx.font = "bold 20px Helvetica, Arial, sans-serif";
  ctx.fillText(title, pad, pad + 18);
  ctx.fillStyle = "#71717a";
  ctx.font = "12px Helvetica, Arial, sans-serif";
  ctx.fillText(
    [data.clubName, "Eco-Torneo"].filter(Boolean).join(" · "),
    pad,
    pad + 38,
  );

  const tableX = pad;
  const tableY = pad + titleH;

  ctx.fillStyle = "#18181b";
  ctx.fillRect(tableX, tableY, tableW, headerH);
  ctx.fillStyle = "#fafafa";
  ctx.font = "bold 11px Helvetica, Arial, sans-serif";
  ctx.textBaseline = "middle";
  let headerX = tableX;
  for (const col of cols) {
    ctx.textAlign = col.align === "right" ? "right" : "center";
    const tx =
      col.align === "right" ? headerX + col.width - 8 : headerX + col.width / 2;
    ctx.fillText(col.label, tx, tableY + headerH / 2);
    headerX += col.width;
  }

  planilla.lines.forEach(({ item, debeCents, haberCents, restoPct }, index) => {
    const def = ECO_CATEGORY_DEFS[item.category];
    const y = tableY + headerH + index * rowH;
    ctx.fillStyle = item.enSaldo === false ? "#fef2f2" : "#ecfdf5";
    ctx.fillRect(tableX, y, tableW, rowH);
    ctx.strokeStyle = "#e4e4e7";
    ctx.lineWidth = 1;
    ctx.strokeRect(tableX, y, tableW, rowH);

    const values = [
      item.enSaldo === false ? "No" : "Sí",
      def.label,
      item.observacion.trim() || "—",
      def.formula === "cantidad_x_valor"
        ? item.cantidad == null
          ? "—"
          : String(item.cantidad)
        : "—",
      formatValor(item, restoPct, data.currency),
      debeCents > 0 ? money(debeCents) : "—",
      haberCents > 0 ? money(haberCents) : "—",
    ];

    let cellX = tableX;
    values.forEach((value, colIndex) => {
      const col = cols[colIndex]!;
      ctx.fillStyle = "#18181b";
      ctx.font =
        colIndex === 1
          ? "12px Helvetica, Arial, sans-serif"
          : "12px Helvetica, Arial, sans-serif";
      ctx.textAlign =
        col.align === "right"
          ? "right"
          : col.align === "center"
            ? "center"
            : "left";
      const text = fitText(ctx, value, col.width - 14);
      const tx =
        col.align === "right"
          ? cellX + col.width - 8
          : col.align === "center"
            ? cellX + col.width / 2
            : cellX + 8;
      if (colIndex === 1) {
        ctx.fillText(text, tx, y + 14);
        ctx.fillStyle = "#71717a";
        ctx.font = "10px Helvetica, Arial, sans-serif";
        ctx.fillText(def.flow, tx, y + 26);
      } else {
        ctx.fillText(text, tx, y + rowH / 2);
      }
      cellX += col.width;
    });
  });

  const footY = tableY + headerH + planilla.lines.length * rowH;
  const drawFoot = (
    y: number,
    label: string,
    debe: string,
    haber: string,
    haberColor = "#18181b",
  ) => {
    ctx.fillStyle = "#f4f4f5";
    ctx.fillRect(tableX, y, tableW, footH);
    ctx.strokeStyle = "#e4e4e7";
    ctx.strokeRect(tableX, y, tableW, footH);
    ctx.fillStyle = "#18181b";
    ctx.font = "bold 12px Helvetica, Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(label, tableX + cols[0].width + 8, y + footH / 2);
    ctx.textAlign = "right";
    ctx.fillText(debe, tableX + tableW - cols[6].width - 8, y + footH / 2);
    ctx.fillStyle = haberColor;
    ctx.fillText(haber, tableX + tableW - 8, y + footH / 2);
  };

  drawFoot(
    footY,
    "Totales (ítems en saldo)",
    money(planilla.totalDebeCents),
    money(planilla.totalHaberCents),
  );
  drawFoot(
    footY + footH,
    "Saldo (Debe − Haber)",
    "",
    money(planilla.saldoCents),
    planilla.saldoCents < 0 ? "#b91c1c" : "#18181b",
  );

  if (data.groups.length > 0) {
    let cardY = footY + footH * 2 + 18;
    data.groups.forEach((group, index) => {
      const col = index % cardsPerRow;
      if (col === 0 && index > 0) cardY += cardH + cardGap;
      const x = pad + col * (cardW + cardGap);
      const saldo = computeGroupSaldoCents(group, planilla.lines);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#d4d4d8";
      ctx.lineWidth = 1;
      roundRect(ctx, x, cardY, cardW, cardH, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#71717a";
      ctx.font = "12px Helvetica, Arial, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(fitText(ctx, group.name, cardW - 20), x + 12, cardY + 18);
      ctx.fillStyle = saldo < 0 ? "#b91c1c" : "#18181b";
      ctx.font = "bold 16px Helvetica, Arial, sans-serif";
      ctx.fillText(money(saldo), x + 12, cardY + 40);
    });
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      blob ? resolve(blob) : reject(new Error("no png"));
    }, "image/png");
  });
}

export async function runEcoTorneoPngAction(action: GrillaPdfAction) {
  const data = getEcoPdfSnapshot();
  if (!data) {
    throw new Error("No hay una planilla para exportar");
  }

  const blob = await renderEcoTorneoPng(data);
  const filename = uniqueFilename(data.simulationName || "planilla", "png");

  if (action === "open") {
    openPngBlob(blob);
    return;
  }
  if (action === "create-open") {
    downloadPngBlob(blob, filename);
    openPngBlob(blob);
    return;
  }
  await copyPngToClipboard(blob, filename);
}
