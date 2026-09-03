export default function MarqueeTicker() {
  const items = [
    'FIRE-GRILLED',
    'PRESSED FRESH',
    'DOUBLE SMASHED',
    'HAND-SPUN SHAKES',
    '24HR BRINED CHICKEN',
    'OPEN FLAME',
  ];

  const row = (
    <div className="animate-marquee">
      {[...items, ...items].map((item, i) => (
        <span key={i} className="flex items-center">
          <span className="px-6 font-mono text-sm md:text-base uppercase tracking-[0.2em] text-[#1C120C]">
            {item}
          </span>
          <span className="text-[#E8542A]">🔥</span>
        </span>
      ))}
    </div>
  );

  return (
    <div aria-hidden="true" className="relative bg-[#F2B33D] border-y-2 border-[#1C120C] overflow-hidden py-3.5">
      <div className="flex w-max focus-within:[&_*]:[animation-play-state:paused]">{row}</div>
    </div>
  );
}
