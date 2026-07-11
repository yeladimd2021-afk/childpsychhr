/** Official logo — שיבא תל השומר, בית החולים לילדים אדמונד ולילי ספרא, האגף לפסיכיאטריה של
 * הילד והמתבגר. The source file (`/logo.png`) is the hospital's original artwork, used as-is —
 * never cropped or recolored. It always sits on its own white frame so it renders correctly
 * regardless of the surrounding surface, and is sized by width only (height:auto) so its
 * original aspect ratio is preserved at any breakpoint.
 *
 * `className` controls the width at each breakpoint (e.g. "w-[150px] sm:w-[190px] lg:w-[220px]")
 * — callers size the logo per-placement instead of this component guessing a fixed size.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center rounded-xl bg-white p-2 ring-1 ring-border ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="שיבא תל השומר — בית החולים לילדים אדמונד ולילי ספרא — האגף לפסיכיאטריה של הילד והמתבגר"
        className="h-auto w-full max-w-full object-contain"
      />
    </div>
  );
}
