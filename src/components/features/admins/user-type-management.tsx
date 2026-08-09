"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createUserTypeAction,
  deleteUserTypeAction,
  updateUserTypeAction,
} from "@/app/(dashboard)/[clubSlug]/tipos-usuario/actions";
import {
  ADMIN_MODULE_LABELS,
  type AdminModuleKey,
} from "@/config/modules";
import { PrivilegeGroups } from "@/components/features/admins/privilege-groups";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type UserTypeRow = {
  id: string;
  name: string;
  description: string | null;
  privileges: AdminModuleKey[];
  active: boolean;
  membersCount: number;
};

export function UserTypeManagement({
  clubSlug,
  userTypes,
}: {
  clubSlug: string;
  userTypes: UserTypeRow[];
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privileges, setPrivileges] = useState<AdminModuleKey[]>([
    "jugadores",
    "turnos",
  ]);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<UserTypeRow | null>(null);

  const resetForm = () => {
    setName("");
    setDescription("");
    setPrivileges(["jugadores", "turnos"]);
    setEditing(null);
  };

  const startEdit = (type: UserTypeRow) => {
    setEditing(type);
    setName(type.name);
    setDescription(type.description ?? "");
    setPrivileges(type.privileges);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const payload = {
        name,
        description,
        privileges,
        active: editing?.active ?? true,
      };
      const result = editing
        ? await updateUserTypeAction(clubSlug, editing.id, payload)
        : await createUserTypeAction(clubSlug, payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(editing ? "Tipo actualizado." : "Tipo creado.");
      resetForm();
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="size-4" />
            {editing ? `Editar: ${editing.name}` : "Nuevo tipo de usuario"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type-name">Nombre</Label>
                <Input
                  id="type-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ej: Organizador Torneos"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type-description">Descripción</Label>
                <Input
                  id="type-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label>Privilegios por solapa</Label>
              <PrivilegeGroups value={privileges} onChange={setPrivileges} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending || privileges.length === 0}>
                {pending ? "Guardando…" : editing ? "Guardar cambios" : "Crear tipo"}
              </Button>
              {editing ? (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tipos cargados</h2>
        {userTypes.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Todavía no hay tipos definidos.
          </p>
        ) : (
          userTypes.map((type) => (
            <Card key={type.id} size="sm">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle>{type.name}</CardTitle>
                    {type.description ? (
                      <p className="text-sm text-muted-foreground">
                        {type.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={type.active ? "secondary" : "outline"}>
                      {type.active ? "Activo" : "Inactivo"}
                    </Badge>
                    <Badge variant="outline">
                      {type.membersCount} usuario
                      {type.membersCount === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {type.privileges.map((privilege) => (
                    <Badge key={privilege} variant="outline">
                      {ADMIN_MODULE_LABELS[privilege]}
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => startEdit(type)}
                  >
                    <Pencil className="size-4" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={pending || type.membersCount > 0}
                    title={
                      type.membersCount > 0
                        ? "Reasigná los usuarios antes de eliminar"
                        : undefined
                    }
                    onClick={() =>
                      startTransition(async () => {
                        const result = await deleteUserTypeAction(
                          clubSlug,
                          type.id,
                        );
                        if (!result.ok) toast.error(result.error);
                        else toast.success("Tipo eliminado.");
                        if (editing?.id === type.id) resetForm();
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                    Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
