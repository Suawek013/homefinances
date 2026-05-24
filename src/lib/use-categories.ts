import { useQuery } from "@tanstack/react-query";
import {
  ShoppingCart, Zap, Home, Fuel, Gamepad2, Joystick, Shirt,
  HeartPulse, Utensils, Repeat, Package, Coffee, Car, Plane,
  Gift, BookOpen, Baby, PawPrint, Wrench, Dumbbell, Music,
  Sparkles, type LucideIcon,
} from "lucide-react";
import { CATEGORIES } from "./categories";
import { listCustomCategories } from "./categories.functions";
import { useT } from "./i18n";

export const CUSTOM_ICONS: Record<string, LucideIcon> = {
  Package, ShoppingCart, Zap, Home, Fuel, Gamepad2, Joystick, Shirt,
  HeartPulse, Utensils, Repeat, Coffee, Car, Plane, Gift, BookOpen,
  Baby, PawPrint, Wrench, Dumbbell, Music, Sparkles,
};

export const CUSTOM_COLORS = [
  "oklch(0.7 0.15 130)", "oklch(0.75 0.15 80)", "oklch(0.55 0.11 200)",
  "oklch(0.6 0.18 25)", "oklch(0.65 0.18 290)", "oklch(0.6 0.2 320)",
  "oklch(0.7 0.16 30)", "oklch(0.65 0.18 10)", "oklch(0.7 0.15 50)",
  "oklch(0.6 0.13 250)", "oklch(0.6 0.03 200)",
];

export type UnifiedCategory = {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  custom: boolean;
};

export function useAllCategories(): {
  list: UnifiedCategory[];
  map: Record<string, UnifiedCategory>;
  resolve: (id: string) => UnifiedCategory;
} {
  const t = useT();
  const custom = useQuery({ queryKey: ["custom-cats"], queryFn: () => listCustomCategories() });
  const builtin: UnifiedCategory[] = CATEGORIES.map((c) => ({
    id: c.id,
    label: t(`cat.${c.id}`),
    icon: c.icon,
    color: c.color,
    custom: false,
  }));
  const customList: UnifiedCategory[] = (custom.data ?? []).map((c) => ({
    id: c.id,
    label: c.label,
    icon: CUSTOM_ICONS[c.icon] ?? Package,
    color: c.color,
    custom: true,
  }));
  const list = [...builtin, ...customList];
  const map = Object.fromEntries(list.map((c) => [c.id, c])) as Record<string, UnifiedCategory>;
  const resolve = (id: string): UnifiedCategory =>
    map[id] ?? { id, label: id, icon: Package, color: "oklch(0.6 0.03 200)", custom: false };
  return { list, map, resolve };
}