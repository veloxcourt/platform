import { createClient } from "@supabase/supabase-js";

/// Cliente de Supabase con service role (solo servidor). Bypasa RLS.
/// NO importar desde componentes cliente.
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export const PLAYER_PHOTOS_BUCKET =
  process.env.SUPABASE_PLAYER_PHOTOS_BUCKET ?? "player-photos";

export const PRODUCT_PHOTOS_BUCKET =
  process.env.SUPABASE_PRODUCT_PHOTOS_BUCKET ?? "product-photos";
