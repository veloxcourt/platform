import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/access";
import { isPasswordResetRequired } from "@/lib/auth/password-reset";

import { ForgotPasswordForm } from "./forgot-password-form";

export default async function ForgotPasswordPage() {
  const current = await getCurrentUser();
  if (current) {
    if (await isPasswordResetRequired()) redirect("/set-password?from=recovery");
    redirect("/");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <CalendarClock className="size-5" />
          </span>
          <CardTitle className="mt-2">Recuperar contraseña</CardTitle>
          <CardDescription>
            Te vamos a enviar un enlace al email para crear una contraseña nueva.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
