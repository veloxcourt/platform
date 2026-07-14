/// Teléfonos para WhatsApp y alarmas. Se guarda en E.164 (+5491112345678).

export type PhoneCountry = {
  iso: string;
  name: string;
  dial: string;
  flag: string;
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: "AR", name: "Argentina", dial: "54", flag: "🇦🇷" },
  { iso: "UY", name: "Uruguay", dial: "598", flag: "🇺🇾" },
  { iso: "CL", name: "Chile", dial: "56", flag: "🇨🇱" },
  { iso: "PY", name: "Paraguay", dial: "595", flag: "🇵🇾" },
  { iso: "BR", name: "Brasil", dial: "55", flag: "🇧🇷" },
];

export const DEFAULT_PHONE_DIAL = "54";

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function isE164Phone(value: string | null | undefined): boolean {
  return !!value && /^\+\d{8,15}$/.test(value);
}

/// Convierte número local + código de país a E.164.
export function normalizeToE164(
  local: string,
  dialCode: string = DEFAULT_PHONE_DIAL,
): string | null {
  const trimmed = local.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("+")) {
    const digits = digitsOnly(trimmed);
    return digits.length >= 8 ? `+${digits}` : null;
  }

  const digits = digitsOnly(trimmed);
  if (!digits) return null;

  if (dialCode === "54") return normalizeArgentina(digits);

  let national = digits;
  if (national.startsWith(dialCode)) national = national.slice(dialCode.length);
  if (national.startsWith("0")) national = national.slice(1);
  if (national.length < 6) return null;
  return `+${dialCode}${national}`;
}

function normalizeArgentina(digits: string): string | null {
  let n = digits;

  if (n.startsWith("54")) {
    const rest = n.slice(2);
    if (rest.length >= 10) return `+54${rest}`;
  }

  if (n.startsWith("0")) n = n.slice(1);

  const legacyMobile = n.match(/^(\d{2,4})15(\d{6,8})$/);
  if (legacyMobile) {
    n = legacyMobile[1] + legacyMobile[2];
  }

  if (n.length === 10) n = `9${n}`;
  if (n.length === 11 && n.startsWith("9")) return `+54${n}`;
  if (n.length > 11 && n.startsWith("9")) return `+54${n}`;

  return null;
}

/// Separa un E.164 guardado para editar en el formulario (país + local).
export function splitPhoneForForm(
  stored: string | null | undefined,
): { dial: string; local: string } {
  if (!stored) return { dial: DEFAULT_PHONE_DIAL, local: "" };
  if (!stored.startsWith("+")) {
    return { dial: DEFAULT_PHONE_DIAL, local: stored };
  }

  const digits = stored.slice(1);
  const country = [...PHONE_COUNTRIES].sort(
    (a, b) => b.dial.length - a.dial.length,
  ).find((c) => digits.startsWith(c.dial));

  if (!country) return { dial: DEFAULT_PHONE_DIAL, local: digits };

  let local = digits.slice(country.dial.length);
  if (country.dial === "54" && local.startsWith("9")) {
    local = local.slice(1);
  }

  return { dial: country.dial, local: formatLocalDigits(local, country.dial) };
}

function formatLocalDigits(digits: string, dial: string): string {
  if (dial === "54" && digits.length === 10) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }
  return digits;
}

/// Formato legible para listas (sin +54, con espacios).
export function formatPhoneDisplay(
  stored: string | null | undefined,
): string {
  if (!stored) return "";
  if (!stored.startsWith("+")) return stored;

  const { dial, local } = splitPhoneForForm(stored);
  const country = PHONE_COUNTRIES.find((c) => c.dial === dial);
  const prefix = country ? `+${dial} ` : "";
  return `${prefix}${local}`.trim();
}

/// Dígitos para wa.me / API de WhatsApp (sin +).
export function whatsAppNumber(
  stored: string | null | undefined,
): string | null {
  if (!stored) return null;
  if (stored.startsWith("+")) {
    const digits = digitsOnly(stored);
    return digits || null;
  }
  const normalized = normalizeToE164(stored, DEFAULT_PHONE_DIAL);
  return normalized ? digitsOnly(normalized) : digitsOnly(stored) || null;
}

export function whatsAppUrl(
  stored: string | null | undefined,
  text?: string,
): string | null {
  const number = whatsAppNumber(stored);
  if (!number) return null;
  const base = `https://wa.me/${number}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
