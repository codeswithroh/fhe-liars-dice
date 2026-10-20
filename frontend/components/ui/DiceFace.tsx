// Classic 3x3 pip layout per face value, so a die reads instantly without counting dots
// one by one -- same convention as a real die.
const PIP_LAYOUT: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** A single die face as a flat 2D icon (3x3 pip grid), not a 3D render -- for the sidebar
 *  "Your hand" readout, where the point is glanceable legibility, not the tactile cup
 *  scene. Face 1 doubles as the wild face in this game's rules, called out with a ring. */
export function DiceFace({ value, wild = false }: { value: number; wild?: boolean }) {
  const active = PIP_LAYOUT[value] ?? [];
  return (
    <div
      className={`grid h-10 w-10 shrink-0 grid-cols-3 grid-rows-3 gap-[3px] rounded-lg border bg-slate-100 p-1.5 shadow-sm ${
        wild ? "border-cyan-400 ring-2 ring-cyan-400/50" : "border-slate-300"
      }`}
      role="img"
      aria-label={`die showing ${value}${wild ? ", wild" : ""}`}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={`rounded-full ${active.includes(i) ? "bg-slate-900" : "bg-transparent"}`} />
      ))}
    </div>
  );
}

/** A player's full hand as a row of DiceFace icons, face-1 highlighted since it's wild in
 *  this game's bidding rules. */
export function DiceHandRow({ values }: { values: number[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((v, i) => (
        <DiceFace key={i} value={v} wild={v === 1} />
      ))}
    </div>
  );
}
