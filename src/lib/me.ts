import { useQuery } from "@tanstack/react-query";
import { getMyContext, type Me } from "./household.functions";

export function useMe() {
  return useQuery<Me>({
    queryKey: ["me"],
    queryFn: () => getMyContext(),
    staleTime: 30_000,
  });
}

export function memberById(members: Me["members"], userId: string) {
  return members.find((m) => m.user_id === userId);
}

export function memberName(members: Me["members"], userId: string): string {
  return memberById(members, userId)?.display_name ?? "Someone";
}

export function memberColor(members: Me["members"], userId: string): string {
  return memberById(members, userId)?.color ?? "oklch(0.55 0.11 200)";
}
