import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  ChartNoAxesColumn,
  House,
  Library,
  CircleUserRound,
  Settings,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/library", label: "Library", icon: Library },
  { href: "/study", label: "Study", icon: BookOpen },
  { href: "/progress", label: "Progress", icon: ChartNoAxesColumn },
  { href: "/profile", label: "Profile", icon: CircleUserRound },
  { href: "/settings", label: "Settings", icon: Settings },
];
export const MOBILE_NAV_ITEMS = NAV_ITEMS.filter(item => item.href !== "/settings");

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
