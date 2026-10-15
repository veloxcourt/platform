import { cn } from "@/lib/utils";

export function VeloxCourtLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/veloxcourt-logo.svg"
      alt="VeloxCourt"
      className={cn("h-8 w-auto", className)}
    />
  );
}
