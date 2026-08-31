'use client';

interface Props {
  size?: number;
  className?: string;
}

/**
 * Uranus mark — renders the astrological glyph ♅ (U+2645) directly as text,
 * so the mark visually IS the character. Font stack falls back through
 * system symbol fonts that reliably ship the glyph.
 */
export default function UranusLogo({ size = 28, className = '' }: Props) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        fontSize: Math.round(size * 1.05),
        lineHeight: 1,
        color: '#FAFAFA',
        fontFamily:
          '"Segoe UI Symbol", "Apple Symbols", "Noto Sans Symbols2", "STIX Two Math", "Symbola", system-ui, sans-serif',
        userSelect: 'none',
        letterSpacing: 0,
      }}
      aria-label="Uranus"
      role="img"
    >
      ♅
    </span>
  );
}
