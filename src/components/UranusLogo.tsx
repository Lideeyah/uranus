'use client';

interface Props {
  size?: number;
  className?: string;
}

/**
 * Uranus mark — a tilted orbital ring around an inner core with a
 * precision center point. Pure monochrome zinc.
 *   • Outer ring  : lighter zinc (#FAFAFA-alpha) at ~-22° tilt
 *   • Inner body  : solid dark disc for contrast on dark backgrounds
 *   • Core dot    : bright zinc pixel indicating the "signed" origin
 */
export default function UranusLogo({ size = 28, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Uranus"
      role="img"
    >
      {/* Outer orbital ring (tilted ellipse) */}
      <g transform="rotate(-22 20 20)">
        <ellipse
          cx="20"
          cy="20"
          rx="17"
          ry="6.2"
          stroke="#FAFAFA"
          strokeOpacity="0.85"
          strokeWidth="1.25"
        />
        {/* Secondary hairline ring for depth */}
        <ellipse
          cx="20"
          cy="20"
          rx="15"
          ry="5.4"
          stroke="#FAFAFA"
          strokeOpacity="0.28"
          strokeWidth="0.6"
        />
      </g>

      {/* Inner planetary body */}
      <circle cx="20" cy="20" r="6.4" fill="#09090B" stroke="#FAFAFA" strokeWidth="1.25" />

      {/* Meridian hairline */}
      <line
        x1="20"
        y1="14.2"
        x2="20"
        y2="25.8"
        stroke="#FAFAFA"
        strokeOpacity="0.22"
        strokeWidth="0.75"
      />

      {/* Signed core dot */}
      <circle cx="20" cy="20" r="1.6" fill="#FAFAFA" />

      {/* Precision tick — subtle geometric anchor */}
      <circle cx="20" cy="20" r="9" stroke="#71717A" strokeOpacity="0.35" strokeWidth="0.5" />
    </svg>
  );
}
