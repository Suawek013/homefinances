import {
  ShoppingCart, Zap, Home, Fuel, Gamepad2, Joystick,
  Shirt, HeartPulse, Utensils, Repeat, Package,
  type LucideIcon,
} from "lucide-react";

export type Category =
  | "food" | "utilities" | "rent" | "fuel" | "hobbies" | "gaming"
  | "clothing" | "health" | "restaurants" | "subscriptions" | "other";

export const CATEGORIES: { id: Category; label: string; icon: LucideIcon; color: string }[] = [
  { id: "food", label: "Food & Groceries", icon: ShoppingCart, color: "oklch(0.7 0.15 130)" },
  { id: "utilities", label: "Utilities", icon: Zap, color: "oklch(0.75 0.15 80)" },
  { id: "rent", label: "Rent", icon: Home, color: "oklch(0.55 0.11 200)" },
  { id: "fuel", label: "Fuel", icon: Fuel, color: "oklch(0.6 0.18 25)" },
  { id: "hobbies", label: "Hobbies", icon: Joystick, color: "oklch(0.65 0.18 290)" },
  { id: "gaming", label: "Gaming", icon: Gamepad2, color: "oklch(0.6 0.2 320)" },
  { id: "clothing", label: "Clothing", icon: Shirt, color: "oklch(0.7 0.16 30)" },
  { id: "health", label: "Health", icon: HeartPulse, color: "oklch(0.65 0.18 10)" },
  { id: "restaurants", label: "Restaurants", icon: Utensils, color: "oklch(0.7 0.15 50)" },
  { id: "subscriptions", label: "Subscriptions", icon: Repeat, color: "oklch(0.6 0.13 250)" },
  { id: "other", label: "Other", icon: Package, color: "oklch(0.6 0.03 200)" },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  Category,
  (typeof CATEGORIES)[number]
>;

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(n);
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}