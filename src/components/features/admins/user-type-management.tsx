"use client";

import { useState, useTransition, type FormEvent } from "react";
import { List, Pencil, Plus, Trash2 } from "lucide-react";
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
import { StableTabButton } from "@/components/ui/stable-tab-button";

const NEW_TYPE_TAB = "nuevo" as const;
const CREATED_TYPES_TAB = "creados" as const;
const DEFAULT_PRIVILEGES: AdminModuleKey[] = ["jugadores", "turnos"];

type UserTypeSubTab = typeof NEW_TYPE_TAB | typeof CREATED_TYPES_TAB;

export type UserTypeRow = {
  id: string;
  name: string;
  description: string | null;
  privileges: AdminModuleKey[];
  active: boolean;
  membersCount: number;
};

function UserTypeFormFields({
  idPrefix,
  name,
  description,
  privileges,
  onNameChange,
  onDescriptionChange,
  onPrivilegesChange,
}: {
  idPrefix: string;
  name: string;
  description: string;
  privileges: AdminModuleKey[];
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onPrivilegesChange: (value: AdminModuleKey[]) => void;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-name`}>Nombre</Label>
          <Input
            id={`${idPrefix}-name`}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Ej: Organizador Torneos"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-description`}>Descripción</Label>
          <Input
            id={`${idPrefix}-description`}
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Opcional"
          />
        </div>
      </div>
      <div className="space-y-3">
        <Label>Privilegios por solapa</Label>
        <PrivilegeGroups value={privileges} onChange={onPrivilegesChange} />
      </div>
    </>
  );
}

export function UserTypeManagement({
  clubSlug,
  userTypes,
}: {
  clubSlug: string;
  userTypes: UserTypeRow[];
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privileges, setPrivileges] = useState<AdminModuleKey[]>(DEFAULT_PRIVILEGES);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<UserTypeRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrivileges, setEditPrivileges] = useState<AdminModuleKey[]>(
    DEFAULT_PRIVILEGES,
  );
  const [subTab, setSubTab] = useState<UserTypeSubTab>(NEW_TYPE_TAB);

  const resetCreateForm = () => {
    setName("");
    setDescription("");
    setPrivileges(DEFAULT_PRIVILEGES);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditName("");
    setEditDescription("");
    setEditPrivileges(DEFAULT_PRIVILEGES);
  };

  const startEdit = (type: UserTypeRow) => {
    setEditing(type);
    setEditName(type.name);
    setEditDescription(type.description ?? "");
    setEditPrivileges(type.privileges);
  };

  const submitCreate = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await createUserTypeAction(clubSlug, {
        name,
        description,
        privileges,
        active: true,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Tipo creado.");
      resetCreateForm();
      setSubTab(CREATED_TYPES_TAB);
    });
  };

  const submitEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    startTransition(async () => {
      const result = await updateUserTypeAction(clubSlug, editing.id, {
        name: editName,
        description: editDescription,
        privileges: editPrivileges,
        active: editing.active,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Tipo actualizado.");
      cancelEdit();
    });
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div
        className="flex w-full min-w-0 items-center gap-2 overflow-x-auto"
        role="tablist"
        aria-label="Secciones de tipo de usuario"
      >
        <StableTabButton
          active={subTab === NEW_TYPE_TAB}
          onSelect={() => setSubTab(NEW_TYPE_TAB)}
        >
          <Plus />
          Nuevo Tipo
        </StableTabButton>
        <StableTabButton
          active={subTab === CREATED_TYPES_TAB}
          onSelect={() => setSubTab(CREATED_TYPES_TAB)}
        >
          <List />
          Tipos Creados
        </StableTabButton>
      </div>

      {subTab === NEW_TYPE_TAB ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="size-4" />
              Nuevo tipo de usuario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitCreate} className="space-y-5">
              <UserTypeFormFields
                idPrefix="new-type"
                name={name}
                description={description}
                privileges={privileges}
                onNameChange={setName}
                onDescriptionChange={setDescription}
                onPrivilegesChange={setPrivileges}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={pending || privileges.length === 0}>
                  {pending ? "Guardando…" : "Crear tipo"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : userTypes.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Todavía no hay tipos definidos.
        </p>
      ) : (
        <div className="space-y-3">
          {userTypes.map((type) => {
            const isEditing = editing?.id === type.id;

            return (
              <Card key={type.id} size="sm">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-[1.3125rem] font-bold">
                        {isEditing ? editName || type.name : type.name}
                      </CardTitle>
                      {!isEditing && type.description ? (
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
                  {isEditing ? (
                    <form onSubmit={submitEdit} className="space-y-5">
                      <UserTypeFormFields
                        idPrefix={`edit-${type.id}`}
                        name={editName}
                        description={editDescription}
                        privileges={editPrivileges}
                        onNameChange={setEditName}
                        onDescriptionChange={setEditDescription}
                        onPrivilegesChange={setEditPrivileges}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="submit"
                          disabled={pending || editPrivileges.length === 0}
                        >
                          {pending ? "Guardando…" : "Guardar cambios"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={pending}
                          onClick={cancelEdit}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <>
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
                              if (editing?.id === type.id) cancelEdit();
                            })
                          }
                        >
                          <Trash2 className="size-4" />
                          Eliminar
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
