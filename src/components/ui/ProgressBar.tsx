import { cn } from "@/lib/cn";

type ProgressBarProps = {
  value: number;
  label?: string;
  className?: string;
  size?: "sm" | "md";
};

export function ProgressBar({
  value,
  label,
  className,
  size = "md",
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className={cn("w-full", className)}>
      {label ? (
        <div className="mb-1.5 flex items-center justify-between gap-3 text-xs text-muted">
          <span>{label}</span>
          <span className="tabular-nums text-ink">{clamped}%</span>
        </div>
      ) : null}
      <div
        className={cn(
          "overflow-hidden rounded-full bg-surface-2",
          size === "sm" ? "h-1.5" : "h-2",
        )}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
