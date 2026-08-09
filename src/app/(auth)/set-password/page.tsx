import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/access";

import { PasswordForm } from "./password-form";

export default async function SetPasswordPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Creá tu contraseña</CardTitle>
          <CardDescription>
            La usarás para ingresar a VeloxCourt después de aceptar la invitación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
