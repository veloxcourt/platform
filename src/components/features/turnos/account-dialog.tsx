"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatMoney, pesosToCents } from "@/lib/money";
import { QUANTITY_PRESETS, quantityEquals } from "@/lib/quantity";
import type { PlayerRef } from "@/modules/bookings/domain/types";
import type {
  PaymentMethod,
  PlayerAccount,
} from "@/modules/accounts/domain/types";
import { PAYMENT_METHOD_LABELS } from "@/modules/accounts/domain/types";
import type { SellableProduct } from "@/modules/catalog/domain/types";
import {
  addMovementAction,
  getPlayerAccountAction,
} from "@/app/(dashboard)/[clubSlug]/turnos/actions";
import {
  getSellableProductsAction,
  sellProductAction,
} from "@/app/(dashboard)/[clubSlug]/catalogo/actions";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type Mode = "CHARGE" | "PAYMENT";

export function AccountDialog({
  clubSlug,
  player,
  currency,
  open,
  onOpenChange,
  onChanged,
}: {
  clubSlug: string;
  player: PlayerRef | null;
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const [account, setAccount] = useState<PlayerAccount | null>(null);
  const [products, setProducts] = useState<SellableProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("CHARGE");
  const [chargeKind, setChargeKind] = useState<"product" | "manual">("product");

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !player) return;
    setLoading(true);
    Promise.all([
      getPlayerAccountAction(clubSlug, player.id),
      getSellableProductsAction(clubSlug),
    ])
      .then(([acc, prods]) => {
        setAccount(acc.ok ? acc.account : null);
        setProducts(prods);
        setChargeKind(prods.length > 0 ? "product" : "manual");
        setProductId(prods[0]?.id ?? "");
      })
      .finally(() => setLoading(false));
  }, [open, player, clubSlug]);

  function reload() {
    if (!player) return;
    getPlayerAccountAction(clubSlug, player.id).then((r) =>
      setAccount(r.ok ? r.account : null),
    );
  }

  function submit() {
    if (!player) return;

    // Compra desde el catálogo (venta de producto)
    if (mode === "CHARGE" && chargeKind === "product") {
      if (!productId) {
        toast.error("Elegí un producto");
        return;
      }
      if (!(quantity > 0)) {
        toast.error("Ingresá una cantidad válida");
        return;
      }
      startTransition(async () => {
        const result = await sellProductAction(
          clubSlug,
          player.id,
          productId,
          quantity,
        );
        if (result.ok) {
          toast.success("Producto cargado");
          setQuantity(1);
          reload();
          onChanged?.();
        } else {
          toast.error("No se pudo cargar", { description: result.error });
        }
      });
      return;
    }

    // Compra manual o pago
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Ingresá un monto válido");
      return;
    }
    startTransition(async () => {
      const result = await addMovementAction(clubSlug, player.id, {
        type: mode,
        amount: pesosToCents(value),
        concept: mode === "CHARGE" ? concept : "",
        method: mode === "PAYMENT" ? method : "",
      });
      if (result.ok) {
        toast.success(mode === "CHARGE" ? "Compra cargada" : "Pago cargado");
        setAmount("");
        setConcept("");
        reload();
        onChanged?.();
      } else {
        toast.error("No se pudo cargar", { description: result.error });
      }
    });
  }

  const balance = account?.balance ?? 0;
  const balanceLabel = balance > 0 ? "Debe" : balance < 0 ? "A favor" : "Al día";
  const selectedProduct = products.find((p) => p.id === productId);
  const productTotal = Math.round(
    (selectedProduct?.price ?? 0) * (quantity > 0 ? quantity : 0),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cuenta de {player?.name}</DialogTitle>
          <DialogDescription>
            Cuenta corriente del cliente en el club.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <span className="text-sm text-muted-foreground">Saldo</span>
          <span className="text-right">
            <span
              className={cn(
                "text-lg font-semibold",
                balance > 0 && "text-rose-600 dark:text-rose-400",
                balance < 0 && "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {formatMoney(Math.abs(balance), currency)}
            </span>
            <span className="ml-2 text-xs text-muted-foreground">
              {balanceLabel}
            </span>
          </span>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="inline-flex rounded-lg border p-0.5">
            <button
              type="button"
              onClick={() => setMode("CHARGE")}
              className={cn(
                "flex-1 rounded-md px-3 py-1 text-sm",
                mode === "CHARGE"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              Compra
            </button>
            <button
              type="button"
              onClick={() => setMode("PAYMENT")}
              className={cn(
                "flex-1 rounded-md px-3 py-1 text-sm",
                mode === "PAYMENT"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              Pago
            </button>
          </div>

          {mode === "CHARGE" && (
            <div className="flex gap-3 text-xs">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={chargeKind === "product"}
                  onChange={() => setChargeKind("product")}
                />
                Producto
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={chargeKind === "manual"}
                  onChange={() => setChargeKind("manual")}
                />
                Manual
              </label>
            </div>
          )}

          {mode === "CHARGE" && chargeKind === "product" ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <Label>Producto</Label>
                <select
                  className={SELECT_CLASS}
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                >
                  {products.length === 0 && (
                    <option value="">Sin productos</option>
                  )}
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatMoney(p.price, currency)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Cantidad</Label>
                <div className="flex flex-wrap items-center gap-1">
                  {QUANTITY_PRESETS.map((preset) => (
                    <Button
                      key={preset.label}
                      type="button"
                      size="sm"
                      variant={
                        quantityEquals(quantity, preset.value)
                          ? "default"
                          : "outline"
                      }
                      className="h-10 min-w-11 px-2.5 text-[1.6rem] leading-none"
                      onClick={() => setQuantity(preset.value)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                  <Input
                    type="number"
                    min={0}
                    step="0.25"
                    className="h-8 w-20"
                    aria-label="Otra cantidad"
                    placeholder="Otra"
                    value={Number(quantity.toFixed(3))}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Para compartir (ej. una gaseosa entre 4), usá ¼, ⅓ o ½.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Total: {formatMoney(productTotal, currency)}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label>Monto ($)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              {mode === "CHARGE" ? (
                <div className="flex flex-col gap-1.5">
                  <Label>Concepto</Label>
                  <Input
                    placeholder="Ej. varios..."
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Label>Método</Label>
                  <select
                    className={SELECT_CLASS}
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  >
                    {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map(
                      (m) => (
                        <option key={m} value={m}>
                          {PAYMENT_METHOD_LABELS[m]}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              )}
            </div>
          )}

          <Button onClick={submit} disabled={isPending} size="sm">
            {isPending
              ? "Guardando..."
              : mode === "CHARGE"
                ? "Cargar compra"
                : "Cargar pago"}
          </Button>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Últimos movimientos</p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : !account || account.movements.length === 0 ? (
            <p className="text-sm text-muted-foreground/60">Sin movimientos.</p>
          ) : (
            <div className="max-h-48 overflow-auto">
              {account.movements.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0"
                >
                  <div className="flex flex-col">
                    <span>
                      {m.type === "CHARGE"
                        ? m.concept || "Compra"
                        : `Pago${m.method ? ` · ${PAYMENT_METHOD_LABELS[m.method]}` : ""}`}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(m.createdAt), "d MMM HH:mm", {
                        locale: es,
                      })}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      m.type === "CHARGE"
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {m.type === "CHARGE" ? "+" : "−"}
                    {formatMoney(m.amount, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
