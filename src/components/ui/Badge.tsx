const TONE_CLASSES = {
  blue: "text-brand-blue bg-brand-blue-soft",
  turquoise: "text-brand-turquoise bg-brand-turquoise-soft",
  green: "text-brand-green bg-brand-green-soft",
  amber: "text-brand-amber bg-brand-amber-soft",
  red: "text-brand-red bg-brand-red-soft",
  neutral: "text-foreground-subtle bg-background",
} as const;

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONE_CLASSES;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
