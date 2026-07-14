import { whatsAppNumber } from "@/lib/phone";
import { getWhatsAppConfig } from "./config";

export type WhatsAppApiSendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

/// Envío automático vía WhatsApp Business Cloud API (Meta).
/// Requiere WHATSAPP_CLOUD_ACCESS_TOKEN y WHATSAPP_CLOUD_PHONE_NUMBER_ID en .env.
export async function sendWhatsAppViaApi(
  phoneE164: string,
  body: string,
): Promise<WhatsAppApiSendResult> {
  const config = getWhatsAppConfig();
  if (!config) {
    return {
      ok: false,
      error:
        "WhatsApp API no configurada. Agregá WHATSAPP_CLOUD_ACCESS_TOKEN y WHATSAPP_CLOUD_PHONE_NUMBER_ID en .env",
    };
  }

  const to = whatsAppNumber(phoneE164);
  if (!to) {
    return { ok: false, error: "Teléfono inválido para WhatsApp" };
  }

  const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });

  const data = (await res.json().catch(() => null)) as {
    messages?: { id: string }[];
    error?: { message?: string };
  } | null;

  if (!res.ok) {
    return {
      ok: false,
      error: data?.error?.message ?? `Error HTTP ${res.status}`,
    };
  }

  const messageId = data?.messages?.[0]?.id;
  if (!messageId) {
    return { ok: false, error: "WhatsApp no devolvió ID de mensaje" };
  }

  return { ok: true, messageId };
}
