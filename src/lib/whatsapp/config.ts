export type WhatsAppConfig = {
  accessToken: string;
  phoneNumberId: string;
};

export function getWhatsAppConfig(): WhatsAppConfig | null {
  const accessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID?.trim();
  if (!accessToken || !phoneNumberId) return null;
  return { accessToken, phoneNumberId };
}

export function isWhatsAppApiConfigured(): boolean {
  return getWhatsAppConfig() !== null;
}
