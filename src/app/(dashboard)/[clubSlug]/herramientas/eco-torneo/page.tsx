import { EcoTorneoPlanilla } from "@/components/features/herramientas/eco-torneo-planilla";

export const metadata = {
  title: "Eco-Torneo · CourtFlow",
};

export default function EcoTorneoPage() {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-medium">Eco-Torneo</h2>
        <p className="text-sm text-muted-foreground">
          Planilla para estimar costos e ingresos al armar un torneo de pádel.
        </p>
      </div>

      <EcoTorneoPlanilla />
    </div>
  );
}
