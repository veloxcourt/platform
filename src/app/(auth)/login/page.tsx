import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/access";
import { isPasswordResetRequired } from "@/lib/auth/password-reset";

import { LoginForm } from "./login-form";

function safeNextPath(raw: string | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const current = await getCurrentUser();
  const { next: nextRaw } = await searchParams;
  const next = safeNextPath(nextRaw);
  if (current) {
    if (await isPasswordResetRequired()) redirect("/set-password?from=recovery");
    redirect(next ?? "/");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <CalendarClock className="size-5" />
          </span>
          <CardTitle className="mt-2">Ingresar a VeloxCourt</CardTitle>
          <CardDescription>
            Staff del club o cuenta de jugador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={next} />
        </CardContent>
      </Card>
    </main>
  );
}
