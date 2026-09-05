import { jsPDF } from "jspdf";

import { copyPdfToClipboard } from "@/lib/clipboard-pdf";
import {
  copyPngToClipboard,
  downloadPngBlob,
  openPngBlob,
} from "@/lib/clipboard-png";
import {
  DAILY_PHASE_LABELS,
  type DailyMatchCard,
  type DailyMatchPhase,
} from "./daily-matches-model";
import type { LlavePdfClub } from "./llave-pdf";
import type { GrillaPdfAction } from "./zones-match-grid-pdf";

export type DailyMatchesClub = LlavePdfClub;

type RGB = [number, number, number];
type LogoImage = { data: string; format: "PNG" | "JPEG" };

const PHASE_TONE: Record<DailyMatchPhase, { fill: RGB; border: RGB; badge: RGB }> =
  {
    zonas: {
      fill: [240, 253, 250],
      border: [153, 246, 228],
      badge: [204, 251, 241],
    },
    intermedia: {
      fill: [255, 251, 235],
      border: [251, 191, 36],
      badge: [253, 230, 138],
    },
    final: {
      fill: [245, 243, 255],
      border: [167, 139, 250],
      badge: [221, 214, 254],
    },
  };

function slugifyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function uniqueFilename(
  tournamentName: string,
  dayLabel: string,
  ext: "pdf" | "png",
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
  return `partidos-${slugifyName(tournamentName) || "torneo"}-${slugifyName(dayLabel) || "dia"}-${stamp}.${ext}`;
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
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
}

function courtLabel(card: DailyMatchCard): string {
  return card.courtIndex == null ? "Sin cancha" : `Cancha ${card.courtIndex + 1}`;
}

function timeLabel(card: DailyMatchCard): string {
  return card.startTime.trim() || "Sin horario";
}

async function loadLogoData(url: string): Promise<LogoImage | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return { data: dataUrl, format: blob.type.includes("png") ? "PNG" : "JPEG" };
  } catch {
    return null;
  }
}

function drawClubBlock(
  doc: jsPDF,
  club: DailyMatchesClub,
  logo: LogoImage | null,
  pageW: number,
  margin: number,
) {
  const right = pageW - margin;
  const logoSize = 16;
  let textRight = right;
  if (logo) {
    try {
      doc.addImage(logo.data, logo.format, right - logoSize, 5, logoSize, logoSize);
      textRight = right - logoSize - 2.5;
    } catch {
      textRight = right;
    }
  }

  const name = club.name.trim();
  const locality = club.locality?.trim() ?? "";
  const address = club.address?.trim() ?? "";
  if (name) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(24, 24, 27);
    doc.text(name, textRight, 9.2, { align: "right", maxWidth: 78 });
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(113, 113, 122);
  if (locality) {
    doc.text(locality, textRight, 13.6, { align: "right", maxWidth: 78 });
  }
  if (address) {
    doc.text(address, textRight, locality ? 17.4 : 13.6, {
      align: "right",
      maxWidth: 78,
    });
  }
}

async function loadLogoImage(url: string): Promise<HTMLImageElement | null> {
  const logo = await loadLogoData(url);
  if (!logo) return null;
  const img = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("No se pudo leer el logo"));
      img.src = logo.data;
    });
    return img;
  } catch {
    return null;
  }
}

function drawClubOnCanvas(
  ctx: CanvasRenderingContext2D,
  club: DailyMatchesClub,
  logo: HTMLImageElement | null,
  width: number,
  margin: number,
  pageTop = 0,
) {
  const right = width - margin;
  const logoSize = 44;
  let textRight = right;
  if (logo) {
    ctx.drawImage(logo, right - logoSize, pageTop + margin - 2, logoSize, logoSize);
    textRight = right - logoSize - 10;
  }
  const name = club.name.trim();
  const locality = club.locality?.trim() ?? "";
  const address = club.address?.trim() ?? "";
  ctx.textAlign = "right";
  if (name) {
    ctx.fillStyle = "#18181b";
    ctx.font = "bold 16px Helvetica, Arial, sans-serif";
    ctx.fillText(name, textRight, pageTop + margin + 14, 220);
  }
  ctx.fillStyle = "#71717a";
  ctx.font = "12px Helvetica, Arial, sans-serif";
  if (locality) ctx.fillText(locality, textRight, pageTop + margin + 32, 220);
  if (address) {
    ctx.fillText(address, textRight, pageTop + margin + (locality ? 48 : 32), 220);
  }
  ctx.textAlign = "left";
}

async function buildDailyMatchesPdf(
  tournamentName: string,
  dayLabel: string,
  cards: DailyMatchCard[],
  club?: DailyMatchesClub,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 12;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const gap = 3.5;
  const cols = 2;
  const cardW = (pageW - margin * 2 - gap) / cols;
  const cardH = 42;
  const footerY = pageH - 7;
  const logo = club?.logoUrl ? await loadLogoData(club.logoUrl) : null;

  const drawChrome = (page: number) => {
    doc.setTextColor(24, 24, 27);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(tournamentName || "Partidos del día", margin, 12, {
      maxWidth: pageW - margin * 2 - 82,
    });
    doc.setTextColor(113, 113, 122);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `Partidos del día · ${dayLabel} · ${cards.length} enfrentamiento${cards.length === 1 ? "" : "s"}`,
      margin,
      17.5,
      { maxWidth: pageW - margin * 2 - 82 },
    );
    if (club) drawClubBlock(doc, club, logo, pageW, margin);
    doc.setFontSize(8);
    doc.setTextColor(113, 113, 122);
    doc.setFont("helvetica", "normal");
    doc.text(dayLabel, margin, footerY);
    doc.text(String(page), pageW - margin, footerY, { align: "right" });
  };

  drawChrome(1);
  let y = 24;
  cards.forEach((card, index) => {
    const col = index % cols;
    if (col === 0 && index > 0) y += cardH + gap;
    if (y + cardH > footerY - 4) {
      doc.addPage();
      drawChrome(doc.getNumberOfPages());
      y = 24;
    }
    const x = margin + col * (cardW + gap);
    const tone = PHASE_TONE[card.phase];
    doc.setFillColor(...tone.fill);
    doc.setDrawColor(...tone.border);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, "FD");

    doc.setTextColor(24, 24, 27);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(
      ellipsize(doc, `${timeLabel(card)} · ${courtLabel(card)}`, cardW - 28),
      x + 3,
      y + 6,
    );

    const badge = DAILY_PHASE_LABELS[card.phase].toUpperCase();
    doc.setFontSize(6);
    const badgeW = doc.getTextWidth(badge) + 3.2;
    doc.setFillColor(...tone.badge);
    doc.roundedRect(x + cardW - badgeW - 2.5, y + 2.4, badgeW, 4.4, 1, 1, "FD");
    doc.setTextColor(24, 24, 27);
    doc.text(badge, x + cardW - badgeW / 2 - 2.5, y + 5.5, { align: "center" });

    doc.setTextColor(113, 113, 122);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(
      ellipsize(
        doc,
        `${card.categoryLabel} · ${card.groupLabel}${card.matchNumber ? ` · n° ${card.matchNumber}` : ""}`,
        cardW - 6,
      ),
      x + 3,
      y + 11.5,
    );

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...tone.border);
    doc.setLineWidth(0.25);
    doc.roundedRect(x + 3, y + 15, cardW - 6, 8, 1, 1, "FD");
    doc.roundedRect(x + 3, y + 27.5, cardW - 6, 8, 1, 1, "FD");
    doc.setTextColor(24, 24, 27);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(ellipsize(doc, card.pair1 || "—", cardW - 10), x + 5, y + 20.2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(113, 113, 122);
    doc.text("vs", x + cardW / 2, y + 26, { align: "center" });
    doc.setTextColor(24, 24, 27);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(ellipsize(doc, card.pair2 || "—", cardW - 10), x + 5, y + 32.7);

    if (card.observation) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2);
      doc.setTextColor(113, 113, 122);
      doc.text(ellipsize(doc, card.observation, cardW - 6), x + 3, y + 39.2);
    }
  });

  return {
    blob: doc.output("blob"),
    filename: uniqueFilename(tournamentName, dayLabel, "pdf"),
  };
}

function canvasEllipsize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (!text) return "—";
  if (ctx.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}…`;
}

async function buildDailyMatchesPng(
  tournamentName: string,
  dayLabel: string,
  cards: DailyMatchCard[],
  club?: DailyMatchesClub,
): Promise<{ blob: Blob; filename: string }> {
  /// Misma hoja A4 vertical y 2 columnas que el PDF.
  const pageW = 794;
  const pageH = 1123;
  const margin = 45;
  const gap = 13;
  const cols = 2;
  const cardW = (pageW - margin * 2 - gap) / cols;
  const cardH = 159;
  const headerY = 90;
  const footerY = pageH - 26;
  const rowsPerPage = Math.max(
    1,
    Math.floor((footerY - 16 - headerY + gap) / (cardH + gap)),
  );
  const cardsPerPage = rowsPerPage * cols;
  const pages = Math.max(1, Math.ceil(cards.length / cardsPerPage));
  const logo = club?.logoUrl ? await loadLogoImage(club.logoUrl) : null;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(pageW * scale);
  canvas.height = Math.round(pageH * pages * scale);
  const rawCtx = canvas.getContext("2d");
  if (!rawCtx) return Promise.reject(new Error("No se pudo crear la imagen"));
  const ctx: CanvasRenderingContext2D = rawCtx;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, pageW, pageH * pages);

  const fill: Record<DailyMatchPhase, string> = {
    zonas: "#f0fdfa",
    intermedia: "#fffbeb",
    final: "#f5f3ff",
  };
  const border: Record<DailyMatchPhase, string> = {
    zonas: "#99f6e4",
    intermedia: "#fbbf24",
    final: "#a78bfa",
  };
  const badgeFill: Record<DailyMatchPhase, string> = {
    zonas: "#ccfbf1",
    intermedia: "#fde68a",
    final: "#ddd6fe",
  };

  function drawChrome(pageTop: number, page: number) {
    ctx.fillStyle = "#18181b";
    ctx.font = "bold 22px Helvetica, Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      canvasEllipsize(ctx, tournamentName || "Partidos del día", pageW - margin * 2 - 260),
      margin,
      pageTop + 36,
    );
    ctx.fillStyle = "#71717a";
    ctx.font = "13px Helvetica, Arial, sans-serif";
    ctx.fillText(
      `Partidos del día · ${dayLabel} · ${cards.length} enfrentamiento${cards.length === 1 ? "" : "s"}`,
      margin,
      pageTop + 56,
    );
    if (club) drawClubOnCanvas(ctx, club, logo, pageW, margin, pageTop);
    ctx.fillStyle = "#71717a";
    ctx.font = "12px Helvetica, Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(dayLabel, margin, pageTop + footerY);
    ctx.textAlign = "right";
    ctx.fillText(String(page), pageW - margin, pageTop + footerY);
    ctx.textAlign = "left";
    if (page > 1) {
      ctx.strokeStyle = "#e4e4e7";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, pageTop);
      ctx.lineTo(pageW, pageTop);
      ctx.stroke();
    }
  }

  for (let page = 0; page < pages; page += 1) {
    const pageTop = page * pageH;
    drawChrome(pageTop, page + 1);
    const pageCards = cards.slice(page * cardsPerPage, (page + 1) * cardsPerPage);
    pageCards.forEach((card, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = margin + col * (cardW + gap);
      const y = pageTop + headerY + row * (cardH + gap);
      ctx.fillStyle = fill[card.phase];
      ctx.strokeStyle = border[card.phase];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#18181b";
      ctx.font = "bold 15px Helvetica, Arial, sans-serif";
      ctx.fillText(
        canvasEllipsize(ctx, `${timeLabel(card)} · ${courtLabel(card)}`, cardW - 96),
        x + 12,
        y + 24,
      );

      const badge = DAILY_PHASE_LABELS[card.phase].toUpperCase();
      ctx.font = "bold 10px Helvetica, Arial, sans-serif";
      const badgeW = ctx.measureText(badge).width + 14;
      ctx.fillStyle = badgeFill[card.phase];
      ctx.beginPath();
      ctx.roundRect(x + cardW - badgeW - 10, y + 10, badgeW, 18, 4);
      ctx.fill();
      ctx.fillStyle = "#18181b";
      ctx.textAlign = "center";
      ctx.fillText(badge, x + cardW - badgeW / 2 - 10, y + 23);
      ctx.textAlign = "left";

      ctx.fillStyle = "#71717a";
      ctx.font = "12px Helvetica, Arial, sans-serif";
      ctx.fillText(
        canvasEllipsize(
          ctx,
          `${card.categoryLabel} · ${card.groupLabel}${card.matchNumber ? ` · n° ${card.matchNumber}` : ""}`,
          cardW - 24,
        ),
        x + 12,
        y + 44,
      );

      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = border[card.phase];
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x + 12, y + 56, cardW - 24, 30, 5);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(x + 12, y + 104, cardW - 24, 30, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#18181b";
      ctx.font = "bold 13px Helvetica, Arial, sans-serif";
      ctx.fillText(canvasEllipsize(ctx, card.pair1 || "—", cardW - 40), x + 20, y + 76);
      ctx.fillStyle = "#71717a";
      ctx.font = "11px Helvetica, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("vs", x + cardW / 2, y + 96);
      ctx.textAlign = "left";
      ctx.fillStyle = "#18181b";
      ctx.font = "bold 13px Helvetica, Arial, sans-serif";
      ctx.fillText(canvasEllipsize(ctx, card.pair2 || "—", cardW - 40), x + 20, y + 124);

      if (card.observation) {
        ctx.fillStyle = "#71717a";
        ctx.font = "11px Helvetica, Arial, sans-serif";
        ctx.fillText(
          canvasEllipsize(ctx, card.observation, cardW - 24),
          x + 12,
          y + 148,
        );
      }
    });
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      blob
        ? resolve({
            blob,
            filename: uniqueFilename(tournamentName, dayLabel, "png"),
          })
        : reject(new Error("No se pudo crear la imagen"));
    }, "image/png");
  });
}

export async function runDailyMatchesPdfAction({
  action,
  tournamentName,
  dayLabel,
  cards,
  club,
}: {
  action: GrillaPdfAction;
  tournamentName: string;
  dayLabel: string;
  cards: DailyMatchCard[];
  club?: DailyMatchesClub;
}) {
  if (cards.length === 0) throw new Error("No hay partidos para exportar");
  const pdf = await buildDailyMatchesPdf(tournamentName, dayLabel, cards, club);
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

export async function runDailyMatchesPngAction({
  action,
  tournamentName,
  dayLabel,
  cards,
  club,
}: {
  action: GrillaPdfAction;
  tournamentName: string;
  dayLabel: string;
  cards: DailyMatchCard[];
  club?: DailyMatchesClub;
}) {
  if (cards.length === 0) throw new Error("No hay partidos para exportar");
  const png = await buildDailyMatchesPng(tournamentName, dayLabel, cards, club);
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
