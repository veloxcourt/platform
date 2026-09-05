import { jsPDF } from "jspdf";

import { copyPdfToClipboard } from "@/lib/clipboard-pdf";
import {
  copyPngToClipboard,
  downloadPngBlob,
  openPngBlob,
} from "@/lib/clipboard-png";
import type { GrillaPdfAction } from "./zones-match-grid-pdf";

export type ZonesCardsPdfMatch = {
  number: number;
  day: string;
  time: string;
  court: string;
  pair1: string;
  pair2: string;
  scores: string[];
  note?: string;
  highlight?: boolean;
  review?: boolean;
};

export type ZonesCardsPdfZone = {
  label: string;
  subtitle: string;
  pairLabels: string[];
  badges?: string[];
  tone: "ok" | "review" | "conflict";
  matches: ZonesCardsPdfMatch[];
};

export type ZonesCardsPdfInput = {
  tournamentName: string;
  categoryName: string;
  dateRange?: string;
  formatLabel: string;
  scoreGroups: { group: string; count: number }[];
  zones: ZonesCardsPdfZone[];
};

type RGB = [number, number, number];

const TONE = {
  ok: {
    fill: [240, 253, 250] as RGB,
    border: [153, 246, 228] as RGB,
    badgeFill: [204, 251, 241] as RGB,
    badgeText: [17, 94, 89] as RGB,
  },
  review: {
    fill: [255, 251, 235] as RGB,
    border: [251, 191, 36] as RGB,
    badgeFill: [253, 230, 138] as RGB,
    badgeText: [69, 26, 3] as RGB,
  },
  conflict: {
    fill: [254, 242, 242] as RGB,
    border: [239, 68, 68] as RGB,
    badgeFill: [254, 202, 202] as RGB,
    badgeText: [127, 29, 29] as RGB,
  },
};

function slugifyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function uniqueFilename(
  name: string,
  categoryName: string,
  ext: "pdf" | "png" = "pdf",
): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
  ].join("");
  return `zonas-${slugifyName(name) || "torneo"}-${slugifyName(categoryName) || "cat"}-${stamp}.${ext}`;
}

function ellipsize(doc: jsPDF, text: string, maxWidth: number): string {
  if (!text) return "—";
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && doc.getTextWidth(`${value}…`) > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}…`;
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

function setFill(doc: jsPDF, color: RGB) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function setDraw(doc: jsPDF, color: RGB) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function setText(doc: jsPDF, color: RGB) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function scoreColCount(input: ZonesCardsPdfInput): number {
  return Math.max(
    1,
    input.scoreGroups.reduce((sum, group) => sum + group.count, 0),
  );
}

function layout(input: ZonesCardsPdfInput) {
  const scoreCols = scoreColCount(input);
  const margin = 12;
  const contentW = 210 - margin * 2;
  const scoreW = Math.min(48, scoreCols * 7);
  const rest = contentW - scoreW;
  return {
    margin,
    contentW,
    col: {
      num: rest * 0.06,
      day: rest * 0.16,
      time: rest * 0.1,
      court: rest * 0.09,
      pair1: rest * 0.295,
      pair2: rest * 0.295,
      score: scoreW,
    },
    scoreCols,
    rowH: 10.4,
    headH: 10,
    cardPad: 3.5,
  };
}

function zoneHeight(
  zone: ZonesCardsPdfZone,
  lay: ReturnType<typeof layout>,
): number {
  const pairRows = Math.ceil(Math.max(1, zone.pairLabels.length) / 3);
  return (
    lay.cardPad * 2 +
    11 +
    pairRows * 6 +
    2 +
    lay.headH +
    zone.matches.length * lay.rowH
  );
}

function drawScoreHeader(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  input: ZonesCardsPdfInput,
  lay: ReturnType<typeof layout>,
) {
  const colW = w / lay.scoreCols;
  let cursor = x;
  setText(doc, [113, 113, 122]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  for (const group of input.scoreGroups) {
    const groupW = colW * group.count;
    doc.text(group.group, cursor + groupW / 2, y + 2.6, { align: "center" });
    const subW = groupW / group.count;
    for (let i = 0; i < group.count; i += 1) {
      doc.text(i === 0 ? "P1" : "P2", cursor + subW * i + subW / 2, y + 6.4, {
        align: "center",
      });
    }
    cursor += groupW;
  }
}

function drawZoneCard(
  doc: jsPDF,
  zone: ZonesCardsPdfZone,
  x: number,
  y: number,
  input: ZonesCardsPdfInput,
  lay: ReturnType<typeof layout>,
): number {
  const h = zoneHeight(zone, lay);
  const tone = TONE[zone.tone];
  const w = lay.contentW;

  setFill(doc, tone.fill);
  setDraw(doc, tone.border);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, w, h, 2.2, 2.2, "FD");

  let cursorY = y + lay.cardPad + 4;
  setText(doc, [24, 24, 27]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(zone.label, x + lay.cardPad, cursorY);

  let badgeX = x + lay.cardPad + doc.getTextWidth(zone.label) + 2.5;
  for (const raw of zone.badges ?? []) {
    const badge = raw.toUpperCase();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    const badgeW = doc.getTextWidth(badge) + 4;
    setFill(doc, tone.badgeFill);
    setDraw(doc, tone.border);
    doc.setLineWidth(0.25);
    doc.roundedRect(badgeX, cursorY - 3.2, badgeW, 4.4, 1, 1, "FD");
    setText(doc, tone.badgeText);
    doc.text(badge, badgeX + badgeW / 2, cursorY, { align: "center" });
    badgeX += badgeW + 1.4;
  }

  const chipY = cursorY - 2.4;
  let chipX = x + w - lay.cardPad;
  const chipMinX = badgeX + 3;
  let chipRows = 1;
  doc.setFontSize(6.5);
  [...zone.pairLabels].reverse().forEach((label) => {
    const text = ellipsize(doc, label, 42);
    const chipW = Math.min(46, doc.getTextWidth(text) + 3.2);
    if (chipX - chipW < chipMinX && chipX < x + w - lay.cardPad) {
      chipRows += 1;
      chipX = x + w - lay.cardPad;
    }
    chipX -= chipW;
    setFill(doc, [255, 255, 255]);
    setDraw(doc, tone.border);
    doc.setLineWidth(0.25);
    doc.roundedRect(
      chipX,
      chipY + (chipRows - 1) * 6,
      chipW,
      5.2,
      1,
      1,
      "FD",
    );
    setText(doc, [24, 24, 27]);
    doc.text(text, chipX + chipW / 2, chipY + (chipRows - 1) * 6 + 3.5, {
      align: "center",
    });
    chipX -= 1.4;
  });

  setText(doc, [113, 113, 122]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(
    ellipsize(doc, zone.subtitle, w - lay.cardPad * 2),
    x + lay.cardPad,
    cursorY + 4.4 + (chipRows > 1 ? (chipRows - 1) * 6 : 0),
  );

  const tableY = cursorY + 8 + (chipRows > 1 ? (chipRows - 1) * 6 : 0);
  const tableX = x + lay.cardPad;
  const tableW = w - lay.cardPad * 2;
  const cols = lay.col;
  const headers = ["#", "Día", "Horario", "Cancha", "Pareja 1", "Pareja 2"];
  const widths = [cols.num, cols.day, cols.time, cols.court, cols.pair1, cols.pair2];

  setFill(doc, [255, 255, 255]);
  doc.rect(tableX, tableY, tableW, lay.headH, "F");
  setText(doc, [113, 113, 122]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  let hx = tableX;
  headers.forEach((header, index) => {
    const align = index <= 3 ? "center" : "left";
    doc.text(
      header,
      align === "center" ? hx + widths[index]! / 2 : hx + 1,
      tableY + 6.2,
      { align },
    );
    hx += widths[index]!;
  });
  drawScoreHeader(doc, tableX + (tableW - cols.score), tableY + 0.6, cols.score, input, lay);

  zone.matches.forEach((match, index) => {
    const rowY = tableY + lay.headH + index * lay.rowH;
    if (match.highlight) {
      setFill(doc, [254, 202, 202]);
    } else if (match.review) {
      setFill(doc, [253, 230, 138]);
    } else {
      setFill(doc, [255, 255, 255]);
    }
    doc.rect(tableX, rowY, tableW, lay.rowH, "F");
    setDraw(doc, [212, 212, 216]);
    doc.setLineWidth(0.18);
    doc.setLineDashPattern([0.8, 0.7], 0);
    doc.line(tableX, rowY + lay.rowH, tableX + tableW, rowY + lay.rowH);
    doc.setLineDashPattern([], 0);

    const values = [
      String(match.number),
      match.day || "—",
      match.time || "—",
      match.court || "—",
      match.pair1 || "—",
      match.pair2 || "—",
    ];
    const boxY = rowY + 1.8;
    const boxH = 6.2;
    setText(doc, [24, 24, 27]);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    let cx = tableX;
    values.forEach((value, colIndex) => {
      const width = widths[colIndex]!;
      if (colIndex === 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        setText(doc, [113, 113, 122]);
        doc.text(value, cx + width / 2, rowY + (match.note ? 3.6 : 6.2), {
          align: "center",
        });
        if (match.note) {
          setText(
            doc,
            match.highlight
              ? [127, 29, 29]
              : match.review
                ? [120, 53, 15]
                : [113, 113, 122],
          );
          doc.setFontSize(5.2);
          doc.text(ellipsize(doc, match.note, width + 8), cx + width / 2, rowY + 8.2, {
            align: "center",
          });
        }
      } else {
        const inset = 0.5;
        setFill(doc, [255, 255, 255]);
        setDraw(doc, match.highlight ? [239, 68, 68] : [228, 228, 231]);
        doc.setLineWidth(0.22);
        doc.roundedRect(cx + inset, boxY, width - inset * 2, boxH, 0.9, 0.9, "FD");
        setText(doc, [24, 24, 27]);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.6);
        const text = ellipsize(doc, value, width - 2.4);
        const align = colIndex <= 3 ? "center" : "left";
        doc.text(
          text,
          align === "center" ? cx + width / 2 : cx + 1.6,
          boxY + 4.2,
          { align },
        );
      }
      cx += width;
    });

    const scoreX = tableX + tableW - cols.score;
    const cellW = cols.score / lay.scoreCols;
    match.scores.forEach((score, scoreIndex) => {
      const boxX = scoreX + scoreIndex * cellW + 0.35;
      setFill(doc, [255, 255, 255]);
      setDraw(doc, [212, 212, 216]);
      doc.setLineWidth(0.2);
      doc.roundedRect(boxX, boxY, cellW - 0.7, boxH, 0.8, 0.8, "FD");
      setText(doc, [24, 24, 27]);
      doc.setFontSize(7);
      doc.text(score || "", boxX + (cellW - 0.7) / 2, boxY + 4.2, {
        align: "center",
      });
    });
  });

  return h;
}

export function buildZonesCardsPdf(input: ZonesCardsPdfInput) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const lay = layout(input);
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  const footerY = pageH - 7;

  const drawChrome = (page: number) => {
    setText(doc, [24, 24, 27]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(input.tournamentName || "Zonas", lay.margin, 12);
    setText(doc, [113, 113, 122]);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const subtitle = [input.dateRange, input.categoryName, input.formatLabel]
      .filter(Boolean)
      .join("  ·  ");
    doc.text(subtitle, lay.margin, 17.5);
    doc.setFontSize(8);
    doc.text(`Zonas  ·  ${input.categoryName || input.tournamentName}`, lay.margin, footerY);
    doc.text(String(page), pageW - lay.margin, footerY, { align: "right" });
  };

  drawChrome(1);
  let y = 23;
  input.zones.forEach((zone) => {
    const needed = zoneHeight(zone, lay) + 3;
    if (y + needed > footerY - 4) {
      doc.addPage();
      drawChrome(doc.getNumberOfPages());
      y = 23;
    }
    y += drawZoneCard(doc, zone, lay.margin, y, input, lay) + 3.5;
  });

  return {
    blob: doc.output("blob"),
    filename: uniqueFilename(input.tournamentName, input.categoryName),
  };
}


export async function runZonesCardsPdfAction({
  action,
  input,
}: {
  action: GrillaPdfAction;
  input: ZonesCardsPdfInput;
}) {
  if (input.zones.length === 0) {
    throw new Error("No hay zonas para exportar");
  }
  const pdf = buildZonesCardsPdf(input);
  if (action === "open") {
    openPdfBlob(pdf.blob);
    return;
  }
  if (action === "create-open") {
    downloadPdfBlob(pdf.blob, pdf.filename);
    openPdfBlob(pdf.blob);
    return;
  }
  await copyPdfToClipboard(pdf.blob, pdf.filename);
}

function buildZonesCardsPng(input: ZonesCardsPdfInput): Promise<{
  blob: Blob;
  filename: string;
}> {
  const scale = 2;
  const width = 794;
  const rowH = 28;
  const pad = 28;
  const height =
    pad * 2 +
    56 +
    input.zones.reduce(
      (sum, zone) => sum + 52 + zone.matches.length * rowH + 28,
      0,
    );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(Math.max(height, 200) * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("No se pudo crear la imagen"));
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, Math.max(height, 200));
  ctx.fillStyle = "#18181b";
  ctx.font = "bold 22px Helvetica, Arial, sans-serif";
  ctx.fillText(input.tournamentName || "Zonas", pad, pad + 18);
  ctx.fillStyle = "#71717a";
  ctx.font = "13px Helvetica, Arial, sans-serif";
  ctx.fillText(
    [input.dateRange, input.categoryName, input.formatLabel]
      .filter(Boolean)
      .join(" · "),
    pad,
    pad + 38,
  );
  let y = pad + 56;
  for (const zone of input.zones) {
    const h = 44 + zone.matches.length * rowH + 16;
    ctx.fillStyle =
      zone.tone === "conflict"
        ? "#fef2f2"
        : zone.tone === "review"
          ? "#fffbeb"
          : "#f0fdfa";
    ctx.strokeStyle =
      zone.tone === "conflict"
        ? "#ef4444"
        : zone.tone === "review"
          ? "#fbbf24"
          : "#5eead4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(pad, y, width - pad * 2, h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#18181b";
    ctx.font = "bold 16px Helvetica, Arial, sans-serif";
    ctx.fillText(zone.label, pad + 12, y + 22);
    ctx.fillStyle = "#71717a";
    ctx.font = "12px Helvetica, Arial, sans-serif";
    ctx.fillText(zone.subtitle, pad + 12, y + 38);
    zone.matches.forEach((match, index) => {
      const rowY = y + 50 + index * rowH;
      ctx.fillStyle = match.highlight
        ? "#fecaca"
        : index % 2 === 0
          ? "#ffffff"
          : "#f8fafc";
      ctx.fillRect(pad + 10, rowY, width - pad * 2 - 20, rowH - 2);
      ctx.fillStyle = "#18181b";
      ctx.font = "12px Helvetica, Arial, sans-serif";
      ctx.fillText(
        `${match.number}  ${match.day}  ${match.time}  C${match.court}   ${match.pair1}  vs  ${match.pair2}   ${match.scores.filter(Boolean).join(" ")}`,
        pad + 16,
        rowY + 18,
      );
    });
    y += h + 14;
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      blob
        ? resolve({
            blob,
            filename: uniqueFilename(
              input.tournamentName,
              input.categoryName,
              "png",
            ),
          })
        : reject(new Error("No se pudo crear la imagen"));
    }, "image/png");
  });
}

export async function runZonesCardsPngAction({
  action,
  input,
}: {
  action: GrillaPdfAction;
  input: ZonesCardsPdfInput;
}) {
  if (input.zones.length === 0) {
    throw new Error("No hay zonas para exportar");
  }
  const png = await buildZonesCardsPng(input);
  if (action === "open") {
    openPngBlob(png.blob);
    return;
  }
  if (action === "create-open") {
    downloadPngBlob(png.blob, png.filename);
    openPngBlob(png.blob);
    return;
  }
  await copyPngToClipboard(png.blob, png.filename);
}
