"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavActive, NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-dvh w-64 shrink-0 flex-col border-r border-edge bg-surface lg:sticky lg:top-0 lg:flex lg:self-start">
      <div className="flex h-16 items-center px-5">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent font-display text-lg text-accent-fg">
            B
          </span>
          <span className="font-display text-xl tracking-tight text-ink">
            BrainBo
          </span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-2" aria-label="Main">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                active
                  ? "bg-surface-2 text-ink"
                  : "text-muted hover:bg-surface-2/70 hover:text-ink",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-edge p-3">
        <ThemeToggle />
      </div>
    </aside>
  );
}
