import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type PersonId = "slawek" | "natalia";

export const PEOPLE: { id: PersonId; name: string }[] = [
  { id: "slawek", name: "Slawek" },
  { id: "natalia", name: "Natalia" },
];

const KEY = "budget.currentPerson";

type Ctx = { current: PersonId; setCurrent: (p: PersonId) => void };
const PersonContext = createContext<Ctx | null>(null);

export function PersonProvider({ children }: { children: ReactNode }) {
  const [current, setCurrentState] = useState<PersonId>("slawek");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    if (stored === "slawek" || stored === "natalia") setCurrentState(stored);
  }, []);

  const setCurrent = (p: PersonId) => {
    setCurrentState(p);
    if (typeof window !== "undefined") localStorage.setItem(KEY, p);
  };

  return <PersonContext.Provider value={{ current, setCurrent }}>{children}</PersonContext.Provider>;
}

export function usePerson() {
  const ctx = useContext(PersonContext);
  if (!ctx) throw new Error("usePerson must be used within PersonProvider");
  return ctx;
}

export function personColor(id: PersonId): string {
  return id === "slawek" ? "var(--person-slawek)" : "var(--person-natalia)";
}

export function personName(id: PersonId): string {
  return id === "slawek" ? "Slawek" : "Natalia";
}