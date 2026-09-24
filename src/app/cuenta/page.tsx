import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/access";
import { listUserActivePairs } from "@/modules/tournaments/application/find-public-pair";

import { PlayerAccountView } from "./player-account-view";

export const metadata = {
  title: "Mi cuenta · VeloxCourt",
};

export default async function PlayerAccountPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login?next=/cuenta");

  const pairs = await listUserActivePairs(current.user.id);

  return (
    <main className="min-h-screen bg-muted/30">
      <PlayerAccountView
        fullName={current.user.fullName}
        email={current.user.email}
        pairs={pairs}
      />
    </main>
  );
}
