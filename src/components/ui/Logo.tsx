/** Official logo — שיבא תל השומר, בית החולים לילדים אדמונד ולילי ספרא, האגף לפסיכיאטריה של
 * הילד והמתבגר. Always sits on its own white frame rather than being recolored, so its
 * original colors render correctly regardless of the surrounding surface.
 *
 * `variant="icon"` — the circular mark alone, square, for compact contexts (sidebar header,
 * login screen, favicon-adjacent placements).
 * `variant="full"` — the full horizontal lockup with text, for spacious contexts (About screen).
 */
export function Logo({
  size = 40,
  variant = "icon",
}: {
  size?: number;
  variant?: "icon" | "full";
}) {
  if (variant === "full") {
    return (
      <div
        className="inline-flex items-center rounded-xl bg-white px-3 ring-1 ring-border"
        style={{ height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-full.png"
          alt="שיבא תל השומר — בית החולים לילדים אדמונד ולילי ספרא — האגף לפסיכיאטריה של הילד והמתבגר"
          style={{ height: size * 0.62 }}
          className="w-auto"
        />
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl bg-white p-1.5 ring-1 ring-border"
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-icon.png"
        alt="שיבא תל השומר — האגף לפסיכיאטריה של הילד והמתבגר"
        className="h-full w-full object-contain"
      />
    </div>
  );
}
