"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
};

export function SearchBar({
  value,
  onChange,
  placeholder = "Search decks",
  className,
  id = "search",
}: SearchBarProps) {
  return (
    <label className={cn("relative block", className)} htmlFor={id}>
      <span className="sr-only">{placeholder}</span>
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="h-12 w-full rounded-xl border border-edge bg-surface pr-4 pl-11 text-base text-ink shadow-[0_1px_2px_color-mix(in_srgb,var(--shadow-color)_8%,transparent)] outline-none placeholder:text-muted/75 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20"
      />
    </label>
  );
}
