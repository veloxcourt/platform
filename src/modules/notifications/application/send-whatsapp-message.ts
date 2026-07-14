import { whatsAppUrl } from "@/lib/phone";
import { isWhatsAppApiConfigured } from "@/lib/whatsapp/config";
import { sendWhatsAppViaApi } from "@/lib/whatsapp/send";

export type WhatsAppDeliveryMode = "api" | "manual";

export type WhatsAppSendResult =
  | {
      ok: true;
      mode: "api";
      messageId: string;
    }
  | {
      ok: true;
      mode: "manual";
      url: string;
      body: string;
    }
  | { ok: false; error: string };

/// Intenta envío automático por API; si no está configurada, devuelve link wa.me.
export async function sendWhatsAppMessage(
  phoneE164: string,
  body: string,
  options?: { forceApi?: boolean },
): Promise<WhatsAppSendResult> {
  if (!phoneE164?.startsWith("+")) {
    return { ok: false, error: "El jugador no tiene teléfono válido" };
  }

  if (isWhatsAppApiConfigured()) {
    const api = await sendWhatsAppViaApi(phoneE164, body);
    if (api.ok) {
      return { ok: true, mode: "api", messageId: api.messageId };
    }
    if (options?.forceApi) {
      return { ok: false, error: api.error };
    }
  } else if (options?.forceApi) {
    return {
      ok: false,
      error:
        "WhatsApp API no configurada en el servidor. Ver WHATSAPP_CLOUD_* en .env",
    };
  }

  const url = whatsAppUrl(phoneE164, body);
  if (!url) {
    return { ok: false, error: "No se pudo armar el link de WhatsApp" };
  }

  return { ok: true, mode: "manual", url, body };
}

export function getWhatsAppDeliveryLabel(mode: WhatsAppDeliveryMode): string {
  return mode === "api" ? "Enviado automáticamente" : "Abrir WhatsApp (confirmar envío)";
}
