import { type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "lg" | "icon";
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "ui-button inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        size === "md" && "min-h-11 px-4 text-sm",
        size === "lg" && "min-h-12 px-5 text-base",
        size === "icon" && "h-11 w-11",
        variant === "primary" && "ui-button-primary bg-accent text-accent-fg hover:bg-accent-hover",
        variant === "secondary" &&
          "border border-edge bg-surface text-ink shadow-[0_1px_2px_color-mix(in_srgb,var(--shadow-color)_8%,transparent)] hover:border-edge-strong hover:bg-surface-2",
        variant === "ghost" && "text-ink hover:bg-surface-2",
        variant === "danger" &&
          "bg-danger text-white hover:bg-danger/90",
        className,
      )}
      {...props}
    />
  );
}
