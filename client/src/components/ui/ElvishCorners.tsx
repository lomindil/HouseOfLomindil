/**
 * Decorative elvish archway corner ornaments.
 * Positioned fixed so they overlay any full-page layout.
 * Pass position="relative-container" for in-element use.
 */

interface Props {
  opacity?: number;
  size?: number;
  fixed?: boolean;
}

function CornerSVG({ flip, size }: { flip: string; size: number }) {
  const s = size;
  return (
    <svg
      width={s} height={s}
      viewBox="0 0 90 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ transform: flip, display: 'block' }}
    >
      {/* Outer L-arc */}
      <path
        d="M 4 80 L 4 22 C 4 12 12 4 22 4 L 80 4"
        stroke="#c9a227" strokeWidth="1.4" strokeLinecap="round"
      />
      {/* Inner parallel L-arc */}
      <path
        d="M 12 80 L 12 26 C 12 18 18 12 26 12 L 80 12"
        stroke="#c9a227" strokeWidth="0.6" strokeOpacity="0.45" strokeLinecap="round"
      />
      {/* Corner diamond */}
      <path d="M 4 4 L 10 10 L 4 16 L -2 10 Z" fill="#c9a227" fillOpacity="0.85" />

      {/* Tick marks — horizontal arm */}
      <line x1="35" y1="4"  x2="35" y2="10"  stroke="#c9a227" strokeWidth="0.9" strokeOpacity="0.55" />
      <line x1="50" y1="4"  x2="50" y2="10"  stroke="#c9a227" strokeWidth="0.9" strokeOpacity="0.55" />
      <line x1="65" y1="4"  x2="65" y2="10"  stroke="#c9a227" strokeWidth="0.9" strokeOpacity="0.55" />

      {/* Tick marks — vertical arm */}
      <line x1="4"  y1="35" x2="10" y2="35"  stroke="#c9a227" strokeWidth="0.9" strokeOpacity="0.55" />
      <line x1="4"  y1="50" x2="10" y2="50"  stroke="#c9a227" strokeWidth="0.9" strokeOpacity="0.55" />
      <line x1="4"  y1="65" x2="10" y2="65"  stroke="#c9a227" strokeWidth="0.9" strokeOpacity="0.55" />

      {/* Leaf flourish on horizontal arm */}
      <path d="M 42 4 Q 47 0 52 4 Q 47 8 42 4 Z" fill="#c9a227" fillOpacity="0.5" />

      {/* Leaf flourish on vertical arm */}
      <path d="M 4 42 Q 0 47 4 52 Q 8 47 4 42 Z" fill="#c9a227" fillOpacity="0.5" />

      {/* Inner corner arc accent */}
      <path
        d="M 20 12 C 14 14 12 18 12 26"
        stroke="#c9a227" strokeWidth="0.7" strokeOpacity="0.5" fill="none"
      />
    </svg>
  );
}

export default function ElvishCorners({ opacity = 0.55, size = 90, fixed = true }: Props) {
  const pos = fixed ? 'fixed' : 'absolute';

  return (
    <div className="pointer-events-none select-none z-10" aria-hidden="true">
      {/* Top-left */}
      <div style={{ position: pos, top: 12, left: 12, opacity }}>
        <CornerSVG flip="none" size={size} />
      </div>
      {/* Top-right */}
      <div style={{ position: pos, top: 12, right: 12, opacity }}>
        <CornerSVG flip="scale(-1,1)" size={size} />
      </div>
      {/* Bottom-left */}
      <div style={{ position: pos, bottom: 12, left: 12, opacity }}>
        <CornerSVG flip="scale(1,-1)" size={size} />
      </div>
      {/* Bottom-right */}
      <div style={{ position: pos, bottom: 12, right: 12, opacity }}>
        <CornerSVG flip="scale(-1,-1)" size={size} />
      </div>
    </div>
  );
}
