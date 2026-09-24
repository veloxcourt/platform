import { redirect } from "next/navigation";

import { logoutAction } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/access";
import { isPasswordResetRequired } from "@/lib/auth/password-reset";

import { PasswordForm } from "./password-form";

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  const { from } = await searchParams;
  const isRecovery = from === "recovery" || (await isPasswordResetRequired());

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            {isRecovery ? "Nueva contraseña" : "Creá tu contraseña"}
          </CardTitle>
          <CardDescription>
            {isRecovery
              ? "Escribí la contraseña nueva dos veces. Hasta que la guardes no vas a poder entrar al club."
              : "La usarás para ingresar a VeloxCourt después de aceptar la invitación. Escribila dos veces."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PasswordForm />
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" className="w-full">
              Cancelar y volver al ingreso
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
