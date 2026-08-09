import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/access";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const current = await getCurrentUser();
  if (current) redirect("/");

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <CalendarClock className="size-5" />
          </span>
          <CardTitle className="mt-2">Ingresar a VeloxCourt</CardTitle>
          <CardDescription>
            Accedé con la cuenta asociada a tu club.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
