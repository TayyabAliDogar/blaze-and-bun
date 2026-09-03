'use client';

const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';

/* Official Apple logo glyph (bitten apple), 24x24 source artwork */
const APPLE_GLYPH =
  'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701';

/* Official Google Play colors */
const GPLAY_BLUE = '#00A0FF';
const GPLAY_GREEN = '#00E05A';
const GPLAY_YELLOW = '#FFBC00';
const GPLAY_RED = '#FF3A44';

/* Premium outer glow for hover + focus states */
const GLOW =
  'transition-[box-shadow,filter] duration-300 hover:shadow-[0_0_24px_rgba(242,179,61,0.35)] hover:brightness-110 focus-visible:shadow-[0_0_24px_rgba(242,179,61,0.45)] focus-visible:brightness-110';

const badgeShell =
  'group relative block h-11 select-none rounded-full bg-[#0B0B0B] border border-white/25 overflow-hidden inner-catchlight cursor-not-allowed outline-none transition-[border-color,transform,box-shadow,filter] duration-300 hover:border-white/40 hover:-translate-y-0.5 focus-visible:border-white/50';

const sheen = (id: string) => (
  <defs>
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.14" />
      <stop offset="0.42" stopColor="#FFFFFF" stopOpacity="0.05" />
      <stop offset="0.43" stopColor="#FFFFFF" stopOpacity="0.02" />
      <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
    </linearGradient>
    <linearGradient id={`${id}Edge`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.16" />
      <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.03" />
      <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.1" />
    </linearGradient>
  </defs>
);

/** Official-style App Store + Google Play badges (inline SVG, vector, crisp at 1:1 scale). */
export default function StoreBadges() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        role="button"
        tabIndex={0}
        aria-disabled="true"
        aria-label="Download on the App Store (coming soon)"
        title="Coming soon"
        className={`${badgeShell} w-[136px] ${GLOW}`}
      >
        <svg viewBox="0 0 136 44" className="w-full h-full" role="img" aria-hidden="true">
          {sheen('appSheen')}
          <rect width="136" height="44" rx="22" fill="#0B0B0B" />
          {/* subtle edge highlight to lift it off the page */}
          <rect x="1" y="1" width="134" height="42" rx="21" fill="none" stroke="url(#appSheenEdge)" strokeOpacity="0.5" />
          <rect width="136" height="19" rx="22" fill="url(#appSheen)" />
          <g transform="translate(8 10) scale(1.5)">
            <path d={APPLE_GLYPH} fill="#FFFFFF" />
          </g>
          <text
            x="43"
            y="18.5"
            fill="#FFFFFF"
            fillOpacity="0.85"
            fontSize="6.5"
            fontWeight="500"
            letterSpacing="0.2"
            style={{ fontFamily: FONT }}
          >
            Download on the
          </text>
          <text
            x="43"
            y="31.5"
            fill="#FFFFFF"
            fontSize="12.5"
            fontWeight="800"
            letterSpacing="0.1"
            style={{ fontFamily: FONT }}
          >
            App Store
          </text>
        </svg>
      </span>

      <span
        role="button"
        tabIndex={0}
        aria-disabled="true"
        aria-label="Get it on Google Play (coming soon)"
        title="Coming soon"
        className={`${badgeShell} w-[154px] ${GLOW}`}
      >
        <svg viewBox="0 0 154 44" className="w-full h-full" role="img" aria-hidden="true">
          {sheen('playSheen')}
          <rect width="154" height="44" rx="22" fill="#0B0B0B" />
          <rect x="1" y="1" width="152" height="42" rx="21" fill="none" stroke="url(#playSheenEdge)" strokeOpacity="0.5" />
          <rect width="154" height="19" rx="22" fill="url(#playSheen)" />
          {/* Official Google Play triangle: exact 4-color mark */}
          <g transform="translate(9 8)">
            <polygon points="3,15 18,1 18,15" fill={GPLAY_BLUE} />
            <polygon points="18,1 33,15 18,15" fill={GPLAY_GREEN} />
            <polygon points="3,15 18,15 18,29" fill={GPLAY_YELLOW} />
            <polygon points="18,15 33,15 18,29" fill={GPLAY_RED} />
            <polygon points="14.5,15 3,1 3,15" fill="#00A0FF" opacity="0" />
          </g>
          <text
            x="50"
            y="18.5"
            fill="#FFFFFF"
            fillOpacity="0.85"
            fontSize="6.5"
            fontWeight="500"
            letterSpacing="0.4"
            style={{ fontFamily: FONT }}
          >
            GET IT ON
          </text>
          <text
            x="50"
            y="31.5"
            fill="#FFFFFF"
            fontSize="12.5"
            fontWeight="800"
            letterSpacing="0.1"
            style={{ fontFamily: FONT }}
          >
            Google Play
          </text>
        </svg>
      </span>
    </div>
  );
}