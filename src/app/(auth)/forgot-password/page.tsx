import { redirect } from "next/navigation";
import { VeloxCourtLogo } from "@/components/brand/veloxcourt-logo";
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
          <VeloxCourtLogo className="mx-auto h-10" />
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
