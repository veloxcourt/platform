"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";

import {
  createClubAction,
  rejectClubRequestAction,
} from "@/app/superadmin/actions";
import { slugifyClubName } from "@/modules/platform/domain/create-club-schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ClubRequestRow = {
  id: string;
  clubName: string;
  contactName: string;
  email: string;
  phone: string;
  locality: string;
  message: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
};

type ClubRow = {
  id: string;
  name: string;
  slug: string;
};

export function SuperadminPanel({
  requests,
  clubs,
}: {
  requests: ClubRequestRow[];
  clubs: ClubRow[];
}) {
  const pending = requests.filter((request) => request.status === "PENDING");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    pending[0]?.id ?? null,
  );
  const selected = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) ?? null,
    [requests, selectedRequestId],
  );

  const [name, setName] = useState(selected?.clubName ?? "");
  const [slug, setSlug] = useState(
    selected ? slugifyClubName(selected.clubName) : "",
  );
  const [ownerName, setOwnerName] = useState(selected?.contactName ?? "");
  const [ownerEmail, setOwnerEmail] = useState(selected?.email ?? "");
  const [isPending, startTransition] = useTransition();

  const loadRequest = (request: ClubRequestRow) => {
    setSelectedRequestId(request.id);
    setName(request.clubName);
    setSlug(slugifyClubName(request.clubName));
    setOwnerName(request.contactName);
    setOwnerEmail(request.email);
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Superadmin</h1>
          <p className="text-sm text-muted-foreground">
            Solicitudes de clubes y alta manual.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Solicitudes pendientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay solicitudes pendientes.
              </p>
            ) : (
              pending.map((request) => (
                <div
                  key={request.id}
                  className="rounded-lg border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{request.clubName}</p>
                      <p className="text-muted-foreground">
                        {request.contactName} · {request.locality}
                      </p>
                      <p className="text-muted-foreground">
                        {request.email} · {request.phone}
                      </p>
                      {request.message ? (
                        <p className="mt-2">{request.message}</p>
                      ) : null}
                    </div>
                    <Badge variant="outline">Pendiente</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => loadRequest(request)}>
                      Preparar alta
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await rejectClubRequestAction(
                            request.id,
                          );
                          if (!result.ok) toast.error(result.error);
                          else toast.success("Solicitud rechazada.");
                        })
                      }
                    >
                      Rechazar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clubes existentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {clubs.map((club) => (
              <div
                key={club.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{club.name}</p>
                  <p className="text-muted-foreground">/{club.slug}</p>
                </div>
                <Link
                  href={`/${club.slug}/turnos`}
                  className="text-sm underline-offset-4 hover:underline"
                >
                  Abrir
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Crear club</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="club-name">Nombre del club</Label>
            <Input
              id="club-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSlug(slugifyClubName(event.target.value));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="club-slug">Slug</Label>
            <Input
              id="club-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value.toLowerCase())}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="owner-name">Nombre del dueño</Label>
            <Input
              id="owner-name"
              value={ownerName}
              onChange={(event) => setOwnerName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="owner-email">Email del dueño</Label>
            <Input
              id="owner-email"
              type="email"
              value={ownerEmail}
              onChange={(event) => setOwnerEmail(event.target.value)}
            />
          </div>
          <Button
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await createClubAction({
                  name,
                  slug,
                  ownerName,
                  ownerEmail,
                  requestId: selectedRequestId ?? undefined,
                });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success(`Club creado: /${result.slug}`);
              })
            }
          >
            {isPending ? "Creando…" : "Crear club"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
