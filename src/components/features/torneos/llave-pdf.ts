import { jsPDF } from "jspdf";

import { copyPdfToClipboard } from "@/lib/clipboard-pdf";
import {
  copyPngToClipboard,
  downloadPngBlob,
  openPngBlob,
} from "@/lib/clipboard-png";
import type { FinalPhaseStartRound } from "@/modules/tournaments/domain/config-schema";
import type { FapNode } from "@/modules/tournaments/domain/fap-llaves";
import { officialRoundPhase } from "@/modules/tournaments/domain/intermediate-phase";
import {
  formatBracketHorario,
  type BracketMatchSchedule,
} from "./official-bracket-diagram";
import type { GrillaPdfAction } from "./zones-match-grid-pdf";

export type LlavePdfClub = {
  name: string;
  logoUrl?: string | null;
  locality?: string | null;
  address?: string | null;
};

export type LlavePdfDraw = {
  categoryName: string;
  regulation: string;
  pairCount: number;
  tree: FapNode;
  showOfficialId: boolean;
  startsAtRound?: FinalPhaseStartRound;
  scheduleByOfficialId?: Map<number, BracketMatchSchedule>;
  resolveLabel?: (label: string) => string;
};

const ROUND_FROM_ROOT = [
  "Final",
  "Semifinal",
  "Cuartos",
  "Octavos",
  "16 avos",
  "32 avos",
] as const;

const LEAF_W = 36;
const LEAF_H = 6.2;
const MATCH_W = 34;
const MATCH_H = 12;
const CONN_W = 5;
const V_GAP = 1.3;

type Box = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "leaf" | "match";
  title: string;
  subtitle?: string;
  horario?: string;
  phase?: "intermediate" | "final" | null;
  bye?: boolean;
};

type Elbow = {
  xTop: number;
  xBottom: number;
  xSpine: number;
  top: number;
  bottom: number;
};

function leafLabel(node: FapNode, resolveLabel?: (label: string) => string): string {
  const seed =
    node.kind === "bye"
      ? "Bye"
      : node.kind === "qualifier"
        ? node.qualifier.label
        : `Ganador n° ${node.id}`;
  return resolveLabel?.(seed) ?? seed;
}

function layout(
  node: FapNode,
  x: number,
  y: number,
  depth: number,
  draw: LlavePdfDraw,
): { w: number; h: number; mid: number; boxes: Box[]; elbows: Elbow[] } {
  if (node.kind !== "match") {
    return {
      w: LEAF_W,
      h: LEAF_H,
      mid: y + LEAF_H / 2,
      boxes: [
        {
          x,
          y,
          w: LEAF_W,
          h: LEAF_H,
          kind: "leaf",
          title: leafLabel(node, draw.resolveLabel),
          bye: node.kind === "bye",
        },
      ],
      elbows: [],
    };
  }

  const left = layout(node.left, x, y, depth + 1, draw);
  const right = layout(node.right, x, y + left.h + V_GAP, depth + 1, draw);
  const childW = Math.max(left.w, right.w);
  const matchX = x + childW + CONN_W;
  const mid = (left.mid + right.mid) / 2;
  const label = ROUND_FROM_ROOT[depth] ?? "Ronda";
  const schedule = draw.scheduleByOfficialId?.get(node.id);

  return {
    w: matchX + MATCH_W - x,
    h: left.h + V_GAP + right.h,
    mid,
    boxes: [
      ...left.boxes,
      ...right.boxes,
      {
        x: matchX,
        y: mid - MATCH_H / 2,
        w: MATCH_W,
        h: MATCH_H,
        kind: "match",
        title: label,
        subtitle: draw.showOfficialId ? `n° ${node.id}` : "Ganador",
        horario: formatBracketHorario(schedule),
        phase: draw.startsAtRound
          ? officialRoundPhase(label, draw.startsAtRound)
          : null,
      },
    ],
    elbows: [
      ...left.elbows,
      ...right.elbows,
      {
        xTop: x + left.w,
        xBottom: x + right.w,
        xSpine: matchX,
        top: left.mid,
        bottom: right.mid,
      },
    ],
  };
}

function slugifyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function fitCentered(doc: jsPDF, text: string, maxWidth: number): string {
  if (!text) return "";
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && doc.getTextWidth(`${value}…`) > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}…`;
}

function fitCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (!text) return "";
  if (ctx.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}…`;
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
  return `llave-${slugifyName(name) || "torneo"}-${stamp}.${ext}`;
}

function fillFor(box: Box): [number, number, number] {
  if (box.kind === "leaf") return box.bye ? [250, 250, 250] : [255, 255, 255];
  if (box.phase === "intermediate") return [254, 243, 199];
  if (box.phase === "final") return [237, 233, 254];
  return [204, 251, 241];
}

function strokeFor(box: Box): [number, number, number] {
  if (box.kind === "leaf") return box.bye ? [161, 161, 170] : [212, 212, 216];
  if (box.phase === "intermediate") return [245, 158, 11];
  if (box.phase === "final") return [139, 92, 246];
  return [45, 212, 191];
}

type LogoImage = { data: string; format: "PNG" | "JPEG" };

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
    const format = blob.type.includes("png") ? "PNG" : "JPEG";
    return { data: dataUrl, format };
  } catch {
    return null;
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

function drawContainedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  box: number,
) {
  const ratio = image.naturalWidth / image.naturalHeight || 1;
  let width = box;
  let height = box;
  if (ratio > 1) height = box / ratio;
  else width = box * ratio;
  ctx.drawImage(image, x + (box - width) / 2, y + (box - height) / 2, width, height);
}

function drawCenteredLogo(
  doc: jsPDF,
  logo: LogoImage,
  pageW: number,
  size: number,
  y: number,
) {
  try {
    doc.addImage(logo.data, logo.format, pageW / 2 - size / 2, y, size, size);
  } catch {
    /* logo opcional */
  }
}

function clubAddressLines(club: LlavePdfClub): string[] {
  const locality = club.locality?.trim() ?? "";
  const address = club.address?.trim() ?? "";
  if (!address && !locality) return [];
  const lines = [`Dirección: ${address || locality}`];
  if (address && locality) lines.push(locality);
  return lines;
}

function drawComplejoBadge(
  doc: jsPDF,
  label: string,
  x: number,
  y: number,
  maxWidth: number,
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const text = fitCentered(doc, label, maxWidth - 7);
  const textW = doc.getTextWidth(text);
  const w = Math.min(maxWidth, textW + 7);
  const h = 8;
  doc.setFillColor(13, 148, 136);
  doc.setDrawColor(15, 118, 110);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 1.6, 1.6, "FD");
  doc.setTextColor(255, 255, 255);
  doc.text(text, x + w / 2, y + 5.3, { align: "center" });
}

function drawClubMeta(
  doc: jsPDF,
  club: LlavePdfClub,
  pageW: number,
  margin: number,
  maxWidth: number,
) {
  const lines = clubAddressLines(club);
  if (lines.length === 0) return;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(82, 82, 91);
  lines.forEach((line, index) => {
    doc.text(line, pageW - margin, 8 + index * 4, {
      align: "right",
      maxWidth,
    });
  });
}

function drawPage(
  doc: jsPDF,
  tournamentName: string,
  draw: LlavePdfDraw,
  club: LlavePdfClub | undefined,
  logo: LogoImage | null,
  pageW: number,
  pageH: number,
) {
  const margin = 10;
  const clubName = club?.name.trim() ?? "";
  const logoSize = logo ? 16 : 0;
  const headerH = logo ? 36 : 24;
  const footerH = 8;
  const laid = layout(draw.tree, 0, 0, 0, draw);
  const availW = pageW - margin * 2;
  const availH = pageH - margin - headerH - footerH;
  const scale = Math.min(1, availW / Math.max(laid.w, 1), availH / Math.max(laid.h, 1));
  const originX = margin + (availW - laid.w * scale) / 2;
  const originY = headerH + (availH - laid.h * scale) / 2;
  const colW = pageW / 2 - logoSize / 2 - margin - 3;

  if (logo) {
    drawCenteredLogo(doc, logo, pageW, logoSize, 4);
  }

  if (clubName) {
    drawComplejoBadge(doc, `Complejo: ${clubName}`, margin, 5.2, colW);
  }

  if (club) {
    drawClubMeta(doc, club, pageW, margin, colW);
  }

  const titleY = logo ? 26 : 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(24, 24, 27);
  doc.text(draw.categoryName || "Llave", pageW / 2, titleY, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(113, 113, 122);
  doc.text(
    `${draw.regulation} · ${draw.pairCount} pareja${draw.pairCount === 1 ? "" : "s"}`,
    pageW / 2,
    titleY + 5,
    { align: "center" },
  );

  for (const elbow of laid.elbows) {
    const xTop = originX + elbow.xTop * scale;
    const xBottom = originX + elbow.xBottom * scale;
    const xSpine = originX + elbow.xSpine * scale;
    const top = originY + elbow.top * scale;
    const bottom = originY + elbow.bottom * scale;
    doc.setDrawColor(161, 161, 170);
    doc.setLineWidth(0.25);
    doc.line(xTop, top, xSpine, top);
    doc.line(xSpine, top, xSpine, bottom);
    doc.line(xBottom, bottom, xSpine, bottom);
  }

  for (const box of laid.boxes) {
    const x = originX + box.x * scale;
    const y = originY + box.y * scale;
    const w = box.w * scale;
    const h = box.h * scale;
    doc.setFillColor(...fillFor(box));
    doc.setDrawColor(...strokeFor(box));
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, w, h, 0.8, 0.8, "FD");
    doc.setTextColor(24, 24, 27);
    if (box.kind === "leaf") {
      doc.setFont("helvetica", box.bye ? "normal" : "bold");
      doc.setFontSize(Math.max(6, 8 * scale));
      doc.text(fitCentered(doc, box.title, w - 2.8), x + w / 2, y + h / 2 + 0.8, {
        align: "center",
      });
      continue;
    }
    const number = box.subtitle ?? "";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Math.max(5.5, 6.4 * scale));
    doc.setTextColor(24, 24, 27);
    if (number) {
      doc.text(number, x + w - 1.4, y + 3, { align: "right" });
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(Math.max(5.5, 6.5 * scale));
    doc.setTextColor(82, 82, 91);
    doc.text(fitCentered(doc, box.title, w - 2.8), x + w / 2, y + 5.4, {
      align: "center",
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(Math.max(5.5, 6.4 * scale));
    doc.setTextColor(
      box.horario && box.horario !== "Sin horario" ? 24 : 113,
      box.horario && box.horario !== "Sin horario" ? 24 : 113,
      box.horario && box.horario !== "Sin horario" ? 27 : 122,
    );
    doc.text(fitCentered(doc, box.horario ?? "Sin horario", w - 2.4), x + w / 2, y + 8.8, {
      align: "center",
    });
  }

  const footerMid = pageH - footerH / 2 + 1.1;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(161, 161, 170);
  doc.text(tournamentName || "Llave", pageW / 2, footerMid, { align: "center" });
  doc.text(String(doc.getNumberOfPages()), pageW - margin, footerMid, {
    align: "right",
  });
}

async function buildLlavePdf(
  tournamentName: string,
  draws: LlavePdfDraw[],
  club?: LlavePdfClub,
) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const logo = club?.logoUrl ? await loadLogoData(club.logoUrl) : null;

  draws.forEach((draw, index) => {
    if (index > 0) doc.addPage();
    drawPage(doc, tournamentName, draw, club, logo, pageW, pageH);
  });

  const fileLabel =
    draws.length > 1
      ? `${tournamentName}-llaves`
      : `${tournamentName}-${draws[0]?.categoryName ?? ""}`;
  return {
    blob: doc.output("blob"),
    filename: uniqueFilename(fileLabel),
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

export async function runLlavePdfAction({
  action,
  tournamentName,
  draws,
  club,
}: {
  action: GrillaPdfAction;
  tournamentName: string;
  draws: LlavePdfDraw[];
  club?: LlavePdfClub;
}) {
  if (draws.length === 0) {
    throw new Error("No hay llave para exportar");
  }

  const pdf = await buildLlavePdf(tournamentName, draws, club);

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

function rgb(color: [number, number, number]): string {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

async function buildLlavePng(
  tournamentName: string,
  draws: LlavePdfDraw[],
  club?: LlavePdfClub,
): Promise<{ blob: Blob; filename: string }> {
  const px = 5;
  const pad = 28;
  const clubName = club?.name.trim() ?? "";
  const logo = club?.logoUrl ? await loadLogoImage(club.logoUrl) : null;
  const logoSize = logo ? 52 : 0;
  const footerH = 22;
  const gap = 22;
  const sectionTitleH = 44;
  const laidDraws = draws
    .filter((draw) => draw.tree)
    .map((draw) => ({
      draw,
      laid: layout(draw.tree, 0, 0, 0, draw),
    }));
  if (laidDraws.length === 0) {
    return Promise.reject(new Error("No hay llave para exportar"));
  }
  const multi = laidDraws.length > 1;
  const headerH = multi ? (logo ? 72 : 36) : logo ? 110 : 64;
  const contentW = Math.max(...laidDraws.map((item) => item.laid.w), 40);
  const contentH = laidDraws.reduce(
    (sum, item) =>
      sum + item.laid.h + gap + (multi ? sectionTitleH : 0),
    0,
  );
  const width = pad * 2 + contentW * px;
  const height = pad * 2 + headerH + contentH * px + footerH;
  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("No se pudo crear la imagen"));
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  const first = laidDraws[0]!.draw;
  const colW = logo ? width / 2 - logoSize / 2 - 20 : width / 2 - pad;
  if (logo) {
    drawContainedImage(ctx, logo, width / 2 - logoSize / 2, pad, logoSize);
  }
  if (clubName) {
    const label = `Complejo: ${clubName}`;
    ctx.font = "bold 17px Helvetica, Arial, sans-serif";
    const textW = Math.min(ctx.measureText(label).width, colW - 24);
    const badgeW = textW + 28;
    const badgeH = 36;
    const badgeY = pad + 4;
    ctx.beginPath();
    ctx.roundRect(pad, badgeY, badgeW, badgeH, 9);
    ctx.fillStyle = "#0d9488";
    ctx.strokeStyle = "#0f766e";
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(fitCanvas(ctx, label, colW - 24), pad + badgeW / 2, badgeY + badgeH / 2);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
  }
  ctx.fillStyle = "#52525b";
  ctx.font = "13px Helvetica, Arial, sans-serif";
  const addressLines = club ? clubAddressLines(club) : [];
  if (addressLines.length > 0) {
    ctx.textAlign = "right";
    addressLines.forEach((line, index) => {
      ctx.fillText(line, width - pad, pad + 22 + index * 16, colW);
    });
  }
  ctx.textAlign = "left";
  if (!multi) {
    const titleY = pad + logoSize + (logo ? 28 : 20);
    ctx.textAlign = "center";
    ctx.fillStyle = "#18181b";
    ctx.font = "bold 26px Helvetica, Arial, sans-serif";
    ctx.fillText(first.categoryName || "Llave", width / 2, titleY);
    ctx.fillStyle = "#71717a";
    ctx.font = "13px Helvetica, Arial, sans-serif";
    ctx.fillText(
      `${first.regulation} · ${first.pairCount} pareja${first.pairCount === 1 ? "" : "s"}`,
      width / 2,
      titleY + 20,
    );
    ctx.textAlign = "left";
  }

  let originY = pad + headerH;
  const originX = pad;
  for (const item of laidDraws) {
    if (multi) {
      ctx.fillStyle = "#18181b";
      ctx.font = "bold 22px Helvetica, Arial, sans-serif";
      ctx.fillText(item.draw.categoryName || "Llave", originX, originY + 16);
      ctx.fillStyle = "#71717a";
      ctx.font = "12px Helvetica, Arial, sans-serif";
      ctx.fillText(
        `${item.draw.regulation} · ${item.draw.pairCount} pareja${item.draw.pairCount === 1 ? "" : "s"}`,
        originX,
        originY + 34,
      );
      originY += sectionTitleH;
    }
    ctx.strokeStyle = "#a1a1aa";
    ctx.lineWidth = 1;
    for (const elbow of item.laid.elbows) {
      const xTop = originX + elbow.xTop * px;
      const xBottom = originX + elbow.xBottom * px;
      const xSpine = originX + elbow.xSpine * px;
      const top = originY + elbow.top * px;
      const bottom = originY + elbow.bottom * px;
      ctx.beginPath();
      ctx.moveTo(xTop, top);
      ctx.lineTo(xSpine, top);
      ctx.lineTo(xSpine, bottom);
      ctx.lineTo(xBottom, bottom);
      ctx.stroke();
    }
    for (const box of item.laid.boxes) {
      const x = originX + box.x * px;
      const y = originY + box.y * px;
      const w = box.w * px;
      const h = box.h * px;
      const radius = 4;
      ctx.fillStyle = rgb(fillFor(box));
      ctx.strokeStyle = rgb(strokeFor(box));
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#18181b";
      ctx.textAlign = "center";
      if (box.kind === "leaf") {
        ctx.font = `${box.bye ? "normal" : "bold"} 11px Helvetica, Arial, sans-serif`;
        ctx.fillText(fitCanvas(ctx, box.title, w - 10), x + w / 2, y + h / 2 + 4);
        ctx.textAlign = "left";
        continue;
      }
      const number = box.subtitle ?? "";
      ctx.font = "bold 11px Helvetica, Arial, sans-serif";
      ctx.fillStyle = "#18181b";
      ctx.textAlign = "right";
      if (number) ctx.fillText(number, x + w - 6, y + 14, w - 10);
      ctx.textAlign = "center";
      ctx.font = "10px Helvetica, Arial, sans-serif";
      ctx.fillStyle = "#52525b";
      ctx.fillText(box.title, x + w / 2, y + 28, w - 12);
      ctx.font = "10px Helvetica, Arial, sans-serif";
      ctx.fillStyle =
        box.horario && box.horario !== "Sin horario" ? "#18181b" : "#71717a";
      ctx.fillText(box.horario ?? "Sin horario", x + w / 2, y + 44, w - 10);
      ctx.textAlign = "left";
    }
    originY += item.laid.h * px + gap;
  }

  ctx.fillStyle = "#a1a1aa";
  ctx.font = "11px Helvetica, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tournamentName || "Llave", width / 2, height - (pad + footerH) / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      blob
        ? resolve({
            blob,
            filename: uniqueFilename(
              laidDraws.length > 1
                ? `${tournamentName}-llaves`
                : `${tournamentName}-${first.categoryName}`,
              "png",
            ),
          })
        : reject(new Error("No se pudo crear la imagen"));
    }, "image/png");
  });
}

export async function runLlavePngAction({
  action,
  tournamentName,
  draws,
  club,
}: {
  action: GrillaPdfAction;
  tournamentName: string;
  draws: LlavePdfDraw[];
  club?: LlavePdfClub;
}) {
  if (draws.length === 0) {
    throw new Error("No hay llave para exportar");
  }
  const png = await buildLlavePng(tournamentName, draws, club);
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
