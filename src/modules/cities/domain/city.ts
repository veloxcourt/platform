import { z } from "zod";

export const CITY_NAME_MAX = 80;
export const PROVINCE_NAME_MAX = 80;

/// Texto comparable de una localidad: minúsculas, sin tildes, sin puntuación y
/// con los espacios colapsados. Es la clave con la que el catálogo decide si
/// dos formas de escribir ("S. Marcos Sud", "san marcos  sud") son la misma,
/// así que respalda las restricciones de unicidad: no cambiarla sin recalcular
/// `searchName` de las filas existentes.
export function normalizeCityName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/// Capitaliza lo que escribió la persona para guardarlo prolijo en el catálogo.
/// No toca las palabras cortas de unión ("de", "del", "la") salvo al principio.
/// Respeta los acentos que vengan: "MARCOS JUÁREZ" queda "Marcos Juárez".
const LOWERCASE_WORDS = new Set(["de", "del", "la", "las", "los", "y", "el"]);

export function toCanonicalCityName(value: string): string {
  const clean = value
    .trim()
    // Puntuación pegada a las puntas ("..Leones", "Leones-"). Adentro se deja,
    // porque hay nombres que la usan de verdad ("Roque Sáenz Peña").
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}.]+$/gu, "")
    .replace(/\s+/g, " ")
    .toLowerCase();

  return clean
    .split(" ")
    .map((word, index) => {
      if (index > 0 && LOWERCASE_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/// Entre varias formas de escribir lo mismo, elige la que más información
/// conserva: primero descarta las que están todas en mayúsculas (pierden los
/// acentos), después prefiere las que tienen acentos, y al final la más usada.
export function pickRichestVariant(variants: Map<string, number>): string {
  const entries = [...variants.entries()];
  if (entries.length === 0) return "";

  const hasLetters = (text: string) => /\p{L}/u.test(text);
  const isAllCaps = (text: string) =>
    hasLetters(text) && text === text.toUpperCase();
  const hasAccents = (text: string) =>
    text.normalize("NFD").replace(/\p{M}/gu, "") !== text;

  const mixedCase = entries.filter(([variant]) => !isAllCaps(variant));
  const pool = mixedCase.length > 0 ? mixedCase : entries;

  const accented = pool.filter(([variant]) => hasAccents(variant));
  const finalPool = accented.length > 0 ? accented : pool;

  finalPool.sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
  return finalPool[0]![0];
}

const cityNameField = z
  .string()
  .trim()
  .min(2, "La localidad necesita al menos 2 letras")
  .max(CITY_NAME_MAX, `Máximo ${CITY_NAME_MAX} caracteres`)
  .refine((value) => normalizeCityName(value).length >= 2, {
    message: "Escribí el nombre de la localidad",
  });

export const createCitySchema = z.object({
  name: cityNameField,
  provinceId: z.string().min(1, "Elegí la provincia"),
});

export type CreateCityValues = z.infer<typeof createCitySchema>;

export const renameCitySchema = z.object({
  cityId: z.string().min(1),
  name: cityNameField,
});

export const cityAliasSchema = z.object({
  cityId: z.string().min(1),
  label: cityNameField,
});

export const mergeCitiesSchema = z
  .object({
    /// La que desaparece del buscador; sus jugadores pasan a la otra.
    sourceId: z.string().min(1, "Elegí la localidad a fusionar"),
    /// La que queda como canónica.
    targetId: z.string().min(1, "Elegí la localidad que queda"),
  })
  .refine((data) => data.sourceId !== data.targetId, {
    message: "Son la misma localidad",
    path: ["targetId"],
  });

export const createProvinceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "La provincia necesita al menos 2 letras")
    .max(PROVINCE_NAME_MAX, `Máximo ${PROVINCE_NAME_MAX} caracteres`),
  country: z.string().trim().length(2).default("AR"),
});

/// Lo que necesita el buscador para filtrar sin ir al servidor en cada tecla.
export type CityOption = {
  id: string;
  name: string;
  provinceName: string;
  /// Nombre y alias, ya normalizados.
  terms: string[];
};

const DEFAULT_SEARCH_LIMIT = 10;

/// Ordena por qué tan al principio del nombre cae lo que se escribió: primero
/// las que arrancan con el texto, después las que lo contienen en el medio.
export function searchCityOptions(
  options: CityOption[],
  query: string,
  limit: number = DEFAULT_SEARCH_LIMIT,
): CityOption[] {
  const needle = normalizeCityName(query);
  if (!needle) return options.slice(0, limit);

  const scored: { option: CityOption; score: number }[] = [];
  for (const option of options) {
    let best = -1;
    for (const term of option.terms) {
      if (term.startsWith(needle)) {
        best = 0;
        break;
      }
      if (term.includes(needle)) best = 1;
    }
    if (best >= 0) scored.push({ option, score: best });
  }

  scored.sort(
    (a, b) =>
      a.score - b.score || a.option.name.localeCompare(b.option.name, "es"),
  );
  return scored.slice(0, limit).map((item) => item.option);
}

/// Provincias de Argentina. Es una lista cerrada y estable, así que se siembra
/// para que un club pueda encuadrar la localidad que necesita crear.
export const AR_PROVINCES = [
  "Buenos Aires",
  "Ciudad Autónoma de Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
] as const;
