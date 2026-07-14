"use client";

import { useEffect, useState, useTransition } from "react";
import { MessageCircle, Server } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { PlayerListItem } from "@/modules/bookings/domain/types";
import { formatPhoneDisplay } from "@/lib/phone";
import { buildTestMessage } from "@/lib/whatsapp/messages";
import {
  getWhatsAppStatusAction,
  sendWhatsAppTestAction,
} from "@/app/(dashboard)/[clubSlug]/turnos/whatsapp-actions";

export function WhatsAppTestPanel({
  clubSlug,
  clubName,
  players,
}: {
  clubSlug: string;
  clubName: string;
  players: PlayerListItem[];
}) {
  const [apiConfigured, setApiConfigured] = useState(false);
  const [playerId, setPlayerId] = useState("");
  const [isPending, startTransition] = useTransition();

  const withPhone = players.filter((p) => p.phone);
  const selected = withPhone.find((p) => p.id === playerId) ?? null;
  const preview = selected
    ? buildTestMessage(clubName, selected.fullName)
    : "";

  useEffect(() => {
    void getWhatsAppStatusAction().then((s) => setApiConfigured(s.apiConfigured));
  }, []);

  useEffect(() => {
    if (!playerId && withPhone[0]) setPlayerId(withPhone[0].id);
  }, [playerId, withPhone]);

  function run(forceApi: boolean) {
    if (!playerId) {
      toast.error("Elegí un jugador");
      return;
    }
    startTransition(async () => {
      const result = await sendWhatsAppTestAction(clubSlug, playerId, {
        forceApi,
      });
      if (!result.ok) {
        toast.error("No se pudo enviar", { description: result.error });
        return;
      }
      if (result.mode === "api") {
        toast.success("Mensaje enviado automáticamente por WhatsApp");
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
      toast.success("Se abrió WhatsApp", {
        description: "Confirmá el envío con el botón verde en la app.",
      });
    });
  }

  return (
    <section className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <MessageCircle className="size-4 text-green-600" />
            Alarmas WhatsApp
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Probá notificaciones a jugadores. El teléfono del club no envía solo
            desde el navegador: el envío automático corre en el servidor.
          </p>
        </div>
        <Badge variant={apiConfigured ? "default" : "secondary"}>
          {apiConfigured ? "API activa" : "Solo manual"}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 text-sm">
        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">¿Cómo funciona?</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>
              <strong>Abrir WhatsApp:</strong> abre la app con el mensaje listo;
              alguien del club confirma el envío (sirve para probar ya).
            </li>
            <li>
              <strong>Enviar automático:</strong> el servidor manda el mensaje
              sin tocar el celu (requiere API de Meta en .env).
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Jugador de prueba</Label>
          <select
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            disabled={withPhone.length === 0 || isPending}
          >
            {withPhone.length === 0 ? (
              <option value="">Sin jugadores con teléfono</option>
            ) : (
              withPhone.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} — {formatPhoneDisplay(p.phone)}
                </option>
              ))
            )}
          </select>
        </div>

        {preview && (
          <div className="flex flex-col gap-1.5">
            <Label>Vista previa</Label>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-xs">
              {preview}
            </pre>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!playerId || isPending}
            onClick={() => run(false)}
          >
            <MessageCircle className="size-4" />
            Abrir WhatsApp
          </Button>
          <Button
            type="button"
            disabled={!playerId || isPending}
            onClick={() => run(true)}
          >
            <Server className="size-4" />
            {isPending ? "Enviando..." : "Enviar automático"}
          </Button>
        </div>

        {!apiConfigured && (
          <p className="text-xs text-muted-foreground">
            Para envío automático: creá una app en Meta Business, activá WhatsApp
            Cloud API y agregá{" "}
            <code className="rounded bg-muted px-1">WHATSAPP_CLOUD_ACCESS_TOKEN</code>{" "}
            y{" "}
            <code className="rounded bg-muted px-1">
              WHATSAPP_CLOUD_PHONE_NUMBER_ID
            </code>{" "}
            en <code className="rounded bg-muted px-1">.env</code>.
          </p>
        )}
      </div>
    </section>
  );
}
