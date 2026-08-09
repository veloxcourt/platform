"use client";

import { useState, useTransition, type FormEvent } from "react";
import { MailPlus, RefreshCw, Save, UserX } from "lucide-react";
import { toast } from "sonner";

import {
  disableAdministratorAction,
  inviteAdministratorAction,
  resendAdministratorInviteAction,
  updateAdministratorTypeAction,
} from "@/app/(dashboard)/[clubSlug]/administradores/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type UserTypeOption = {
  id: string;
  name: string;
};

type AdministratorRow = {
  membershipId: string;
  fullName: string;
  email: string;
  userTypeId: string | null;
  userTypeName: string | null;
  status: "INVITED" | "ACTIVE" | "DISABLED";
};

export function AdminManagement({
  clubSlug,
  administrators,
  userTypes,
}: {
  clubSlug: string;
  administrators: AdministratorRow[];
  userTypes: UserTypeOption[];
}) {
  const [userTypeId, setUserTypeId] = useState(userTypes[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  const submitInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await inviteAdministratorAction(clubSlug, {
        fullName: formData.get("fullName"),
        email: formData.get("email"),
        userTypeId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      form.reset();
      toast.success(
        result.message ??
          (result.invited === false
            ? "Usuario agregado (ya tenía cuenta)."
            : "Invitación enviada."),
      );
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailPlus className="size-4" />
            Invitar usuario
          </CardTitle>
        </CardHeader>
        <CardContent>
          {userTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Primero creá un tipo de usuario en la solapa Tipos de usuario.
            </p>
          ) : (
            <form onSubmit={submitInvite} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="admin-name">Nombre</Label>
                  <Input id="admin-name" name="fullName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email</Label>
                  <Input id="admin-email" name="email" type="email" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-type">Tipo de usuario</Label>
                <select
                  id="admin-type"
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  value={userTypeId}
                  onChange={(event) => setUserTypeId(event.target.value)}
                  required
                >
                  {userTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={pending || !userTypeId}>
                {pending ? "Enviando…" : "Enviar invitación"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Usuarios cargados</h2>
        {administrators.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Todavía no hay usuarios invitados.
          </p>
        ) : (
          administrators.map((administrator) => (
            <AdministratorCard
              key={administrator.membershipId}
              clubSlug={clubSlug}
              administrator={administrator}
              userTypes={userTypes}
            />
          ))
        )}
      </section>
    </div>
  );
}

function AdministratorCard({
  clubSlug,
  administrator,
  userTypes,
}: {
  clubSlug: string;
  administrator: AdministratorRow;
  userTypes: UserTypeOption[];
}) {
  const [selectedTypeId, setSelectedTypeId] = useState(
    administrator.userTypeId ?? userTypes[0]?.id ?? "",
  );
  const [pending, startTransition] = useTransition();
  const disabled = administrator.status === "DISABLED";
  const statusLabel = {
    INVITED: "Invitación pendiente",
    ACTIVE: "Activo",
    DISABLED: "Acceso revocado",
  }[administrator.status];

  const run = (
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    message: string,
  ) => {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error);
      else toast.success(message);
    });
  };

  return (
    <Card size="sm" className={disabled ? "opacity-65" : undefined}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>{administrator.fullName}</CardTitle>
            <p className="text-sm text-muted-foreground">{administrator.email}</p>
          </div>
          <Badge
            variant={
              administrator.status === "ACTIVE"
                ? "secondary"
                : administrator.status === "DISABLED"
                  ? "destructive"
                  : "outline"
            }
          >
            {statusLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Tipo de usuario</Label>
          <select
            className="h-9 w-full max-w-sm rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={selectedTypeId}
            disabled={disabled || pending || userTypes.length === 0}
            onChange={(event) => setSelectedTypeId(event.target.value)}
          >
            {userTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {!disabled ? (
            <>
              <Button
                size="sm"
                disabled={pending || !selectedTypeId}
                onClick={() =>
                  run(
                    () =>
                      updateAdministratorTypeAction(clubSlug, {
                        membershipId: administrator.membershipId,
                        userTypeId: selectedTypeId,
                      }),
                    "Tipo actualizado.",
                  )
                }
              >
                <Save className="size-4" />
                Guardar tipo
              </Button>
              {administrator.status === "INVITED" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () =>
                        resendAdministratorInviteAction(
                          clubSlug,
                          administrator.membershipId,
                        ),
                      "Invitación reenviada.",
                    )
                  }
                >
                  <RefreshCw className="size-4" />
                  Reenviar
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      disableAdministratorAction(
                        clubSlug,
                        administrator.membershipId,
                      ),
                    "Acceso revocado.",
                  )
                }
              >
                <UserX className="size-4" />
                Revocar acceso
              </Button>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
