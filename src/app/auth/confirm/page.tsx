import { redirect } from "next/navigation";

import ConfirmLinkPage from "./confirm-client";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ConfirmInvitationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = firstParam(params.error);
  const code = firstParam(params.code);
  const tokenHash = firstParam(params.token_hash);

  if (!error && (code || tokenHash)) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      const item = firstParam(value);
      if (item) query.set(key, item);
    }
    redirect(`/auth/callback?${query.toString()}`);
  }

  return (
    <ConfirmLinkPage
      from={firstParam(params.from)}
      error={error}
    />
  );
}
