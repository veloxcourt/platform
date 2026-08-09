"use client";

import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

export type ClubSwitcherItem = {
  slug: string;
  name: string;
  href: string;
};

export function ClubSwitcher({
  currentSlug,
  clubs,
}: {
  currentSlug: string;
  clubs: ClubSwitcherItem[];
}) {
  const router = useRouter();

  if (clubs.length <= 1) {
    const only = clubs[0];
    return (
      <span className="truncate text-sm text-muted-foreground">
        / {only?.name ?? currentSlug}
      </span>
    );
  }

  return (
    <label className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
      <span>/</span>
      <select
        className={cn(
          "max-w-[14rem] truncate rounded-md border-0 bg-transparent py-1 pr-6 font-medium text-foreground outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring/50",
        )}
        value={currentSlug}
        aria-label="Cambiar de club"
        onChange={(event) => {
          const next = clubs.find((club) => club.slug === event.target.value);
          if (next) router.push(next.href);
        }}
      >
        {clubs.map((club) => (
          <option key={club.slug} value={club.slug}>
            {club.name}
          </option>
        ))}
      </select>
    </label>
  );
}
