import { redirect } from "next/navigation";
import { VeloxCourtLogo } from "@/components/brand/veloxcourt-logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/access";

import { RegisterForm } from "./register-form";

export const metadata = {
  title: "Crear cuenta · VeloxCourt",
};

function safeNextPath(raw: string | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const current = await getCurrentUser();
  const { next: nextRaw } = await searchParams;
  const next = safeNextPath(nextRaw);
  if (current) redirect(next ?? "/cuenta");

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <VeloxCourtLogo className="mx-auto h-10" />
          <CardTitle className="mt-2">Crear cuenta de jugador</CardTitle>
          <CardDescription>
            Una cuenta en VeloxCourt para ver tus torneos y gestionar
            inscripciones. No reemplaza la ficha del club.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm next={next} />
        </CardContent>
      </Card>
    </main>
  );
}
