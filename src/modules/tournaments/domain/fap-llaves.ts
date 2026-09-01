/// Llaves oficiales FAP (Colegio de Fiscales, Armado de Torneo).
/// Secuencia inorder del cuadro impreso: clasificado (1A) o n° de partido (64).

export type FapQualifier = {
  place: 1 | 2 | 3;
  zone: string;
  label: string;
};

export type FapNode =
  | { kind: "qualifier"; qualifier: FapQualifier }
  | { kind: "bye" }
  | { kind: "match"; id: number; left: FapNode; right: FapNode };

export type FapCrossing = {
  id: number;
  left: string;
  right: string;
};

const FAP_INORDER: Record<number, string> = {
  6: "1A 61 2B 64 2A 62 1B",
  7: "1A 61 3A 58 2B 64 2A 62 1B",
  8: "1A 61 3A 58 2B 64 2A 59 3B 62 1B",
  9: "1A 61 2B 58 2C 64 1C 59 2A 62 1B",
  10: "1A 61 2B 58 2C 64 1C 59 2A 62 3A 60 1B",
  11: "1A 57 3B 61 2B 58 2C 64 1C 59 2A 62 3A 60 1B",
  12: "1A 57 2B 61 2C 58 1D 64 1C 59 2D 62 2A 60 1B",
  13: "1A 57 3A 50 2B 61 2C 58 1D 64 1C 59 2D 62 2A 60 1B",
  14: "1A 57 3A 50 2B 61 2C 58 1D 64 1C 59 2D 62 2A 55 3B 60 1B",
  15: "1A 57 2B 50 2C 61 1E 58 1D 64 1C 59 2E 62 2D 55 2A 60 1B",
  16: "1A 57 2B 50 2C 61 1E 58 1D 64 1C 59 3A 54 2E 62 2D 55 2A 60 1B",
  17: "1A 57 2B 50 2C 61 1E 51 3B 58 1D 64 1C 59 3A 54 2E 62 2D 55 2A 60 1B",
  18: "1A 57 2C 50 2F 61 1E 51 2B 58 1D 64 1C 59 2A 54 1F 62 2E 55 2D 60 1B",
  19: "1A 57 2C 50 2F 61 1E 51 2B 58 3A 52 1D 64 1C 59 2A 54 1F 62 2E 55 2D 60 1B",
  20: "1A 57 2C 50 2F 61 1E 51 2B 58 3A 52 1D 64 1C 53 3B 59 2A 54 1F 62 2E 55 2D 60 1B",
  21: "1A 57 2F 50 2G 61 1E 51 2C 58 2B 52 1D 64 1C 53 2A 59 2D 54 1F 62 1G 55 2E 60 1B",
  22: "1A 57 2F 50 2G 61 1E 51 2C 58 2B 52 1D 64 1C 53 2A 59 2D 54 1F 62 1G 55 2E 60 3A 56 1B",
  23: "1A 49 3B 57 2F 50 2G 61 1E 51 2C 58 2B 52 1D 64 1C 53 2A 59 2D 54 1F 62 1G 55 2E 60 3A 56 1B",
  24: "1A 49 2B 57 2G 50 1H 61 1E 51 2F 58 2C 52 1D 64 1C 53 2D 59 2E 54 1F 62 1G 55 2H 60 2A 56 1B",
  25: "1A 49 3A 34 2B 57 2G 50 1H 61 1E 51 2F 58 2C 52 1D 64 1C 53 2D 59 2E 54 1F 62 1G 55 2H 60 2A 56 1B",
  26: "1A 49 3A 34 2B 57 2G 50 1H 61 1E 51 2F 58 2C 52 1D 64 1C 53 2D 59 2E 54 1F 62 1G 55 2H 60 2A 47 3B 56 1B",
  27: "1A 49 2B 34 2C 57 1I 50 1H 61 1E 51 2G 58 2F 52 1D 64 1C 53 2E 59 2H 54 1F 62 1G 55 2I 60 2D 47 2A 56 1B",
  28: "1A 49 2B 34 2C 57 1I 50 1H 61 1E 51 2G 58 2F 52 1D 64 1C 53 3A 42 2E 59 2H 54 1F 62 1G 55 2I 60 2D 47 2A 56 1B",
  29: "1A 49 2B 34 2C 57 1I 50 1H 61 1E 51 2G 58 2F 39 3B 52 1D 64 1C 53 3A 42 2E 59 2H 54 1F 62 1G 55 2I 60 2D 47 2A 56 1B",
  30: "1A 49 2C 34 2F 57 1I 50 1H 61 1E 51 2J 58 2G 39 2B 52 1D 64 1C 53 2A 42 2H 59 2I 54 1F 62 1G 55 1J 60 2E 47 2D 56 1B",
  31: "1A 49 2C 34 2F 57 1I 50 1H 61 1E 51 2J 58 2G 39 2B 52 1D 64 1C 53 2A 42 2H 59 2I 43 3A 54 1F 62 1G 55 1J 60 2E 47 2D 56 1B",
  32: "1A 49 2C 34 2F 57 1I 50 1H 61 1E 51 3B 38 2J 58 2G 39 2B 52 1D 64 1C 53 2A 42 2H 59 2I 43 3A 54 1F 62 1G 55 1J 60 2E 47 2D 56 1B",
  33: "1A 49 2F 34 2G 57 1I 50 1H 61 1E 51 2B 38 2K 58 2J 39 2C 52 1D 64 1C 53 2D 42 2I 59 1K 43 2A 54 1F 62 1G 55 1J 60 2H 47 2E 56 1B",
  34: "1A 49 2F 34 2G 57 1I 50 1H 61 1E 51 2B 38 2K 58 2J 39 2C 52 1D 64 1C 53 2D 42 2I 59 1K 43 2A 54 1F 62 1G 55 3A 46 1J 60 2H 47 2E 56 1B",
  35: "1A 49 2F 34 2G 57 1I 35 3B 50 1H 61 1E 51 2B 38 2K 58 2J 39 2C 52 1D 64 1C 53 2D 42 2I 59 1K 43 2A 54 1F 62 1G 55 3A 46 1J 60 2H 47 2E 56 1B",
  36: "1A 49 2G 34 2J 57 1I 35 2B 50 1H 61 1E 51 2C 38 1L 58 2K 39 2F 52 1D 64 1C 53 2E 42 2L 59 1K 43 2D 54 1F 62 1G 55 2A 46 1J 60 2I 47 2H 56 1B",
};

type Token =
  | { kind: "q"; place: 1 | 2 | 3; zone: string }
  | { kind: "m"; id: number };

function parseTokens(source: string): Token[] {
  return source.split(/\s+/).filter(Boolean).map((raw) => {
    const qualifier = raw.match(/^([123])([A-L])$/);
    if (qualifier) {
      return {
        kind: "q" as const,
        place: Number(qualifier[1]) as 1 | 2 | 3,
        zone: qualifier[2],
      };
    }
    const id = Number(raw);
    if (!Number.isInteger(id)) {
      throw new Error(`Token FAP inválido: ${raw}`);
    }
    return { kind: "m" as const, id };
  });
}

function qualifierFrom(token: Extract<Token, { kind: "q" }>): FapQualifier {
  return {
    place: token.place,
    zone: token.zone,
    label: `${token.place}° ${token.zone}`,
  };
}

function parseSide(tokens: Token[]): FapNode {
  if (tokens.length === 0) return { kind: "bye" };
  if (tokens.length === 1 && tokens[0].kind === "q") {
    return { kind: "qualifier", qualifier: qualifierFrom(tokens[0]) };
  }
  return parseInorder(tokens);
}

function parseInorder(tokens: Token[]): FapNode {
  const matchIndexes = tokens
    .map((token, index) => (token.kind === "m" ? { index, id: token.id } : null))
    .filter((item): item is { index: number; id: number } => item !== null);
  if (matchIndexes.length === 0) {
    if (tokens.length === 1 && tokens[0].kind === "q") {
      return { kind: "qualifier", qualifier: qualifierFrom(tokens[0]) };
    }
    throw new Error("Secuencia FAP sin partido");
  }
  const root = matchIndexes.reduce((best, item) =>
    item.id > best.id ? item : best,
  );
  return {
    kind: "match",
    id: root.id,
    left: parseSide(tokens.slice(0, root.index)),
    right: parseSide(tokens.slice(root.index + 1)),
  };
}

function sideLabel(node: FapNode): string {
  if (node.kind === "bye") return "Bye";
  if (node.kind === "qualifier") return node.qualifier.label;
  return `Ganador`;
}

function collectLeaves(node: FapNode, out: FapQualifier[] = []): FapQualifier[] {
  if (node.kind === "qualifier") {
    out.push(node.qualifier);
    return out;
  }
  if (node.kind === "match") {
    collectLeaves(node.left, out);
    collectLeaves(node.right, out);
  }
  return out;
}

function collectFirstRound(node: FapNode, out: FapCrossing[] = []): FapCrossing[] {
  if (node.kind !== "match") return out;
  const leftLeaf = node.left.kind !== "match";
  const rightLeaf = node.right.kind !== "match";
  if (leftLeaf && rightLeaf) {
    out.push({
      id: node.id,
      left: sideLabel(node.left),
      right: sideLabel(node.right),
    });
    return out;
  }
  if (!leftLeaf) collectFirstRound(node.left, out);
  else {
    out.push({
      id: node.id,
      left: sideLabel(node.left),
      right: "Ganador",
    });
  }
  if (!rightLeaf) collectFirstRound(node.right, out);
  else if (leftLeaf) {
    // already recorded as this match
  } else {
    out.push({
      id: node.id,
      left: "Ganador",
      right: sideLabel(node.right),
    });
  }
  return out;
}

export function hasFapLlave(pairCount: number): boolean {
  return pairCount in FAP_INORDER;
}

export function parseFapLlave(pairCount: number): FapNode | null {
  const source = FAP_INORDER[pairCount];
  if (!source) return null;
  return parseInorder(parseTokens(source));
}

export function fapFirstRoundCrossings(pairCount: number): FapCrossing[] {
  const tree = parseFapLlave(pairCount);
  if (!tree) return [];
  return collectFirstRound(tree);
}

export function fapQualifiers(pairCount: number): FapQualifier[] {
  const tree = parseFapLlave(pairCount);
  if (!tree) return [];
  return collectLeaves(tree);
}

export function flattenFapRounds(node: FapNode): { label: string; crossings: FapCrossing[] }[] {
  const byDepth = new Map<number, FapCrossing[]>();

  function walk(current: FapNode, depth: number) {
    if (current.kind !== "match") return;
    const list = byDepth.get(depth) ?? [];
    list.push({
      id: current.id,
      left:
        current.left.kind === "match"
          ? `Ganador n° ${current.left.id}`
          : sideLabel(current.left),
      right:
        current.right.kind === "match"
          ? `Ganador n° ${current.right.id}`
          : sideLabel(current.right),
    });
    byDepth.set(depth, list);
    walk(current.left, depth + 1);
    walk(current.right, depth + 1);
  }

  walk(node, 0);
  const depths = [...byDepth.keys()].sort((a, b) => b - a);
  const labels = ["Final", "Semifinal", "Cuartos", "Octavos", "16 avos", "32 avos"];
  return depths.map((depth, index) => ({
    label: labels[depths.length - 1 - index] ?? `Ronda ${depth}`,
    crossings: byDepth.get(depth) ?? [],
  }));
}
