import { Card } from "./Card";

const TONE_CLASSES = {
  blue: "text-brand-blue bg-brand-blue-soft",
  turquoise: "text-brand-turquoise bg-brand-turquoise-soft",
  green: "text-brand-green bg-brand-green-soft",
  amber: "text-brand-amber bg-brand-amber-soft",
  red: "text-brand-red bg-brand-red-soft",
} as const;

export function KpiCard({
  label,
  value,
  tone = "blue",
  icon: Icon,
  subtitle,
}: {
  label: string;
  value: string | number;
  tone?: keyof typeof TONE_CLASSES;
  icon?: React.ComponentType<{ size?: number }>;
  subtitle?: string;
}) {
  return (
    <Card className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm text-foreground-subtle">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
        {subtitle && <p className="mt-1 text-xs text-foreground-subtle">{subtitle}</p>}
      </div>
      {Icon && (
        <div className={`rounded-xl p-2.5 ${TONE_CLASSES[tone]}`}>
          <Icon size={20} />
        </div>
      )}
    </Card>
  );
}
