import { jsPDF } from "jspdf";

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
};

const ROUND_FROM_ROOT = [
  "Final",
  "Semifinal",
  "Cuartos",
  "Octavos",
  "16 avos",
  "32 avos",
] as const;

const LEAF_W = 28;
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
  x: number;
  top: number;
  bottom: number;
  width: number;
};

function leafLabel(node: FapNode): string {
  if (node.kind === "bye") return "Bye";
  if (node.kind === "qualifier") return node.qualifier.label;
  return `Ganador n° ${node.id}`;
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
          title: leafLabel(node),
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
      { x: x + childW, top: left.mid, bottom: right.mid, width: CONN_W },
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
  return `llave-${slugifyName(name) || "torneo"}-${stamp}.pdf`;
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

function drawClubBlock(
  doc: jsPDF,
  club: LlavePdfClub,
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
  const headerH = 24;
  const laid = layout(draw.tree, 0, 0, 0, draw);
  const availW = pageW - margin * 2;
  const availH = pageH - margin - headerH - 8;
  const scale = Math.min(1, availW / Math.max(laid.w, 1), availH / Math.max(laid.h, 1));
  const originX = margin + (availW - laid.w * scale) / 2;
  const originY = headerH + (availH - laid.h * scale) / 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(24, 24, 27);
  doc.text(tournamentName || "Llave", margin, 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(113, 113, 122);
  doc.text(
    `${draw.categoryName} · ${draw.regulation} · ${draw.pairCount} pareja${draw.pairCount === 1 ? "" : "s"}`,
    margin,
    14.5,
  );

  doc.setFillColor(254, 243, 199);
  doc.rect(margin, 17.4, 3.2, 3.2, "F");
  doc.setFillColor(237, 233, 254);
  doc.rect(margin + 28, 17.4, 3.2, 3.2, "F");
  doc.setFontSize(7.5);
  doc.text("Intermedia", margin + 5, 20);
  doc.text("Final", margin + 33.2, 20);

  if (club) {
    drawClubBlock(doc, club, logo, pageW, margin);
  }

  for (const elbow of laid.elbows) {
    const x = originX + elbow.x * scale;
    const top = originY + elbow.top * scale;
    const bottom = originY + elbow.bottom * scale;
    const w = elbow.width * scale;
    doc.setDrawColor(161, 161, 170);
    doc.setLineWidth(0.25);
    doc.line(x, top, x + w, top);
    doc.line(x + w, top, x + w, bottom);
    doc.line(x, bottom, x + w, bottom);
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
      doc.text(box.title, x + 1.4, y + h / 2 + 0.8, {
        maxWidth: w - 2.4,
      });
      continue;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(Math.max(5.5, 6.5 * scale));
    doc.setTextColor(82, 82, 91);
    doc.text(box.title, x + 1.4, y + 3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Math.max(6, 7.5 * scale));
    doc.setTextColor(24, 24, 27);
    doc.text(box.subtitle ?? "", x + 1.4, y + 6.4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(Math.max(5.5, 6.4 * scale));
    doc.setTextColor(
      box.horario && box.horario !== "Sin horario" ? 24 : 113,
      box.horario && box.horario !== "Sin horario" ? 24 : 113,
      box.horario && box.horario !== "Sin horario" ? 27 : 122,
    );
    doc.text(box.horario ?? "Sin horario", x + 1.4, y + 9.6, {
      maxWidth: w - 2.4,
    });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(113, 113, 122);
  doc.text(`Llave  ·  ${tournamentName}`, margin, pageH - 5);
  doc.text(
    String(doc.getNumberOfPages()),
    pageW - margin,
    pageH - 5,
    { align: "right" },
  );
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

  const first = draws[0]?.categoryName ?? "";
  return {
    blob: doc.output("blob"),
    filename: uniqueFilename(`${tournamentName}-${first}`),
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

  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    throw new Error("clipboard-unsupported");
  }
  const pdfFile = new File([pdf.blob], pdf.filename, {
    type: "application/pdf",
  });
  await navigator.clipboard.write([
    new ClipboardItem({ "application/pdf": pdfFile }),
  ]);
}
