'use client';

interface SectionTransitionProps {
  /* Color of the section ABOVE, which flows down in a soft curve into this section */
  from: string;
}

/*
 * Decorative curved seam: renders the previous section's color as a soft wave
 * that dips into the TOP edge of this section, replacing the hard horizontal
 * cut with a smooth, premium curve. Absolutely positioned & pointer-events-free
 * so it never changes any layout, sizing, or padding.
 */
export default function SectionTransition({ from }: SectionTransitionProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 left-0 right-0 w-full overflow-hidden -mt-px z-[1]"
    >
      <svg
        viewBox="0 0 1440 64"
        preserveAspectRatio="none"
        className="block w-full h-12 md:h-16"
      >
        <path
          d="M0,0 H1440 V30 C1220,54 980,10 720,18 C460,26 240,56 0,24 Z"
          fill={from}
        />
      </svg>
    </div>
  );
}
