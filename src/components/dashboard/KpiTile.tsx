import { Sparkline } from "./Sparkline";

const TONES = {
  gold: { edge: "from-[#d4a017] to-[#f5d26b]", spark: "#f5d26b", note: "text-gold" },
  cyan: { edge: "from-cyan to-violet", spark: "#00e5ff", note: "text-cyan" },
  red: { edge: "from-red-500 to-red-400", spark: "#f87171", note: "text-red-300" },
} as const;

interface Props {
  label: string;
  value: number | string;
  note: string;
  tone: keyof typeof TONES;
  trend?: number[];
}

export function KpiTile({ label, value, note, tone, trend }: Props) {
  const t = TONES[tone];
  return (
    <div className="glass relative overflow-hidden rounded-xl p-4 transition-shadow hover:shadow-elevated">
      <span className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${t.edge}`} aria-hidden />
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-numeric text-3xl font-light tabular-nums">{value}</p>
      <p className={`mt-0.5 text-xs ${t.note}`}>{note}</p>
      {trend && (
        <div className="absolute bottom-3 right-3">
          <Sparkline values={trend} color={t.spark} />
        </div>
      )}
    </div>
  );
}
