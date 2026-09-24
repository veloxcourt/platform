"use client";

import { useEffect, useState } from "react";
import { Copy, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function MenuShareButton({
  pathname,
  buttonLabel,
  title,
  description,
}: {
  pathname: string;
  buttonLabel: string;
  title: string;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const url = `${window.location.origin}${pathname}`;
    setHref(url);
    let cancelled = false;
    void QRCode.toDataURL(url, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: "M",
    }).then((next) => {
      if (!cancelled) setDataUrl(next);
    });
    return () => {
      cancelled = true;
    };
  }, [open, pathname]);

  async function copy() {
    if (!href) return;
    try {
      await navigator.clipboard.writeText(href);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <QrCode className="size-4" />
        {buttonLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            {dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dataUrl}
                alt={`Código QR de ${title}`}
                className="size-56 rounded-md border bg-white p-2"
              />
            ) : (
              <div className="grid size-56 place-items-center rounded-md border text-sm text-muted-foreground">
                Generando QR…
              </div>
            )}
            <p className="w-full break-all text-center text-xs text-muted-foreground">
              {href}
            </p>
            <div className="flex w-full gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => void copy()}
              >
                <Copy className="size-4" />
                Copiar enlace
              </Button>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants(), "flex-1")}
                >
                  Abrir menú
                </a>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ClientMenuQrButton({ clubSlug }: { clubSlug: string }) {
  return (
    <MenuShareButton
      pathname={`/menu/${clubSlug}`}
      buttonLabel="Menú clientes"
      title="Menú para clientes"
      description="El cliente escanea este código y ve los productos marcados en la columna Cliente. No hace falta iniciar sesión."
    />
  );
}

export function PriceMenuLinkButton({ clubSlug }: { clubSlug: string }) {
  return (
    <MenuShareButton
      pathname={`/menu-precios/${clubSlug}`}
      buttonLabel="Enlace menú de precios"
      title="Menú de precios"
      description="Quien abre el enlace tiene que iniciar sesión. Ve solo el menú de precios, sin las pestañas del panel."
    />
  );
}
