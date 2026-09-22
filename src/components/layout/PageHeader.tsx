import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-semibold tracking-[.16em] text-accent uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="break-words font-display text-3xl tracking-tight text-ink sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl whitespace-pre-wrap break-words text-base leading-7 text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex min-w-0 shrink-0 flex-wrap gap-2 sm:max-w-[55%]">{actions}</div> : null}
    </header>
  );
}
