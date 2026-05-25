import { formatMoney } from "@/lib/categories";
import type { UnifiedCategory } from "@/lib/use-categories";

type Slice = { id: string; label: string; color: string; amount: number };

export function CategoryDonut({
  data,
  resolve,
  budget,
  centerLabel,
  centerSub,
  size = 220,
}: {
  data: Record<string, number>;
  resolve: (id: string) => UnifiedCategory;
  budget?: number | null;
  centerLabel: string;
  centerSub?: string;
  size?: number;
}) {
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const slices: Slice[] = entries
    .map(([id, amount]) => {
      const c = resolve(id);
      return { id, label: c.label, color: c.color, amount };
    })
    .sort((a, b) => b.amount - a.amount);

  const remaining = budget != null ? budget - total : null;
  const denom = budget != null && budget > total ? budget : total;

  const r = size / 2 - 14;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = 22;
  const C = 2 * Math.PI * r;

  let offset = 0;
  const arcs = slices.map((s) => {
    const frac = denom > 0 ? s.amount / denom : 0;
    const len = C * frac;
    const node = (
      <circle
        key={s.id}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={s.color}
        strokeWidth={stroke}
        strokeDasharray={`${len} ${C - len}`}
        strokeDashoffset={-offset}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    );
    offset += len;
    return node;
  });

  const remainingFrac = remaining != null && remaining > 0 && denom > 0 ? remaining / denom : 0;
  const remainingLen = C * remainingFrac;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} opacity={0.4} />
          {arcs}
          {remainingLen > 0 && (
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={stroke}
              strokeDasharray={`${remainingLen} ${C - remainingLen}`}
              strokeDashoffset={-offset}
              opacity={0.25}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-xs text-muted-foreground">{centerLabel}</p>
          <p className="text-xl font-semibold tabular-nums">{formatMoney(total)}</p>
          {centerSub && <p className="mt-0.5 text-[11px] text-muted-foreground">{centerSub}</p>}
        </div>
      </div>
      {slices.length > 0 && (
        <ul className="grid w-full grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {slices.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              <span className="truncate">{s.label}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">
                {Math.round((s.amount / (total || 1)) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}