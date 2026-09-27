"use client";

import { useEffect, useState } from "react";
import { Link2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { publicPlayerSignupPath } from "@/modules/players/domain/public-signup-schema";

export function PlayerSignupLinkButton({
  clubSlug,
  clubName,
}: {
  clubSlug: string;
  clubName: string;
}) {
  const [open, setOpen] = useState(false);
  const path = publicPlayerSignupPath(clubSlug);
  const [signupUrl, setSignupUrl] = useState(path);

  useEffect(() => {
    setSignupUrl(`${window.location.origin}${path}`);
  }, [path]);

  function message() {
    return `Hola, completá este link para darte de alta como jugador de ${clubName}:\n${signupUrl}`;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(signupUrl);
      toast.success("Link copiado");
    } catch {
      toast.error("No se pudo copiar el link");
    }
  }

  function openWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(message())}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Link2 className="size-4" />
        Link de alta
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link de alta</DialogTitle>
            <DialogDescription>
              Mandalo por WhatsApp. Quien lo abra se carga solo en jugadores de{" "}
              {clubName}, sin ranking ni puntos.
            </DialogDescription>
          </DialogHeader>
          <p className="break-all rounded-md bg-muted px-2 py-1.5 font-mono text-xs">
            {signupUrl}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void copyLink()}>
              <Link2 className="size-4" />
              Copiar link
            </Button>
            <Button type="button" onClick={openWhatsApp}>
              <MessageCircle className="size-4" />
              Enviar por WhatsApp
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
