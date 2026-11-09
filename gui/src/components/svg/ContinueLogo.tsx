interface ContinueLogoProps {
  height?: number;
  width?: number;
}

export default function ContinueLogo({
  height = 48,
  width = 180,
}: ContinueLogoProps) {
  return (
    <div className="flex items-center gap-2 select-none" style={{ height }}>
      {/* Spider-Man Mask Icon */}
      <svg
        width={height}
        height={height}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="filter drop-shadow-[0_0_8px_rgba(230,36,41,0.7)]"
      >
        <defs>
          <linearGradient id="spiderMaskGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff333a" />
            <stop offset="50%" stopColor="#e62429" />
            <stop offset="100%" stopColor="#7f090d" />
          </linearGradient>
        </defs>
        {/* Mask shape */}
        <path
          d="M50 6 C68 6, 86 26, 84 56 C82 76, 64 92, 50 96 C36 92, 18 76, 16 56 C14 26, 32 6, 50 6 Z"
          fill="url(#spiderMaskGrad)"
          stroke="#ff4d52"
          strokeWidth="2.5"
        />
        {/* Webbing Lines */}
        <path
          d="M50 6 L50 96 M16 56 Q50 62 84 56 M20 40 Q50 48 80 40 M26 72 Q50 78 74 72 M30 24 Q50 34 70 24 M35 14 L42 94 M65 14 L58 94"
          stroke="rgba(0, 0, 0, 0.4)"
          strokeWidth="1.2"
          fill="none"
        />
        {/* Left Eye */}
        <path
          d="M26 44 C34 44, 46 52, 46 56 C46 62, 38 68, 28 64 C24 58, 24 50, 26 44 Z"
          fill="#000000"
        />
        <path
          d="M28 46 C34 46, 44 53, 44 56 C44 60, 37 66, 30 62 C26 57, 26 51, 28 46 Z"
          fill="#ffffff"
        />
        {/* Right Eye */}
        <path
          d="M74 44 C66 44, 54 52, 54 56 C54 62, 62 68, 72 64 C76 58, 76 50, 74 44 Z"
          fill="#000000"
        />
        <path
          d="M72 46 C66 46, 56 53, 56 56 C56 60, 63 66, 70 62 C74 57, 74 51, 72 46 Z"
          fill="#ffffff"
        />
      </svg>
      {/* Brand Text */}
      <div className="flex flex-col">
        <span className="font-black text-xl tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-400 to-red-600 drop-shadow-[0_2px_8px_rgba(230,36,41,0.6)]">
          CODEMIND
        </span>
        <span className="text-[9px] tracking-widest text-red-300/80 font-mono uppercase">
          SPIDER-VIBE AI
        </span>
      </div>
    </div>
  );
}
