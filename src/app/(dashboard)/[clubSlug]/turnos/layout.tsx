import { redirect } from "next/navigation";

import { enforceClubModulePage, getClubAccess } from "@/lib/auth/access";

export default async function BookingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const access = await getClubAccess(clubSlug);
  if (!access) redirect(`/login?next=/${clubSlug}/turnos`);

  const canEnter =
    access.allowedModules.includes("turnos") ||
    access.allowedModules.includes("turnos-config");
  if (!canEnter) {
    await enforceClubModulePage(clubSlug, "turnos");
  }

  return children;
}
