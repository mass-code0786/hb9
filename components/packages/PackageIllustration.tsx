"use client";

export type PackageIllustrationType = "starter" | "growth" | "creator" | "whatsapp" | "ai_ads" | "enterprise";

type PackageIllustrationProps = {
  type: PackageIllustrationType;
};

type Palette = {
  cyan: string;
  blue: string;
  gold: string;
  green?: string;
};

const palettes: Record<PackageIllustrationProps["type"], Palette> = {
  starter: { cyan: "#22d3ee", blue: "#2563eb", gold: "#facc15" },
  growth: { cyan: "#38bdf8", blue: "#0f766e", gold: "#facc15" },
  creator: { cyan: "#60a5fa", blue: "#0891b2", gold: "#facc15" },
  whatsapp: { cyan: "#22d3ee", blue: "#0ea5e9", gold: "#facc15", green: "#22c55e" },
  ai_ads: { cyan: "#38bdf8", blue: "#2563eb", gold: "#facc15" },
  enterprise: { cyan: "#7dd3fc", blue: "#2563eb", gold: "#facc15" }
};

export function packageIllustrationTypeForAmount(amount: string | number): PackageIllustrationType {
  const normalized = Number(amount);
  if (normalized === 4) return "starter";
  if (normalized === 20) return "growth";
  if (normalized === 100) return "creator";
  if (normalized === 500) return "whatsapp";
  if (normalized === 2500) return "ai_ads";
  if (normalized === 12500) return "enterprise";
  return "starter";
}

export function PackageIllustration({ type }: PackageIllustrationProps) {
  const p = palettes[type];
  const ids = {
    scene: `pkg3d-${type}-scene`,
    cyan: `pkg3d-${type}-cyan`,
    gold: `pkg3d-${type}-gold`,
    dark: `pkg3d-${type}-dark`,
    glow: `pkg3d-${type}-glow`,
    soft: `pkg3d-${type}-soft`,
    shadow: `pkg3d-${type}-shadow`
  };

  return (
    <svg className="package-illustration" viewBox="0 0 210 160" role="img" aria-label={`${type.replace("_", " ")} package product illustration`}>
      <defs>
        <radialGradient id={ids.scene} cx="50%" cy="44%" r="70%">
          <stop stopColor={p.cyan} stopOpacity="0.3" />
          <stop offset="0.52" stopColor={p.blue} stopOpacity="0.16" />
          <stop offset="1" stopColor="#020617" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ids.cyan} x1="38" x2="172" y1="20" y2="138" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ecfeff" />
          <stop offset="0.42" stopColor={p.cyan} />
          <stop offset="1" stopColor={p.blue} />
        </linearGradient>
        <linearGradient id={ids.gold} x1="44" x2="160" y1="28" y2="132" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fef9c3" />
          <stop offset="0.48" stopColor={p.gold} />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id={ids.dark} x1="20" x2="188" y1="20" y2="152" gradientUnits="userSpaceOnUse">
          <stop stopColor="#164e63" />
          <stop offset="0.45" stopColor="#0f172a" />
          <stop offset="1" stopColor="#020617" />
        </linearGradient>
        <filter id={ids.glow} x="-45%" y="-45%" width="190%" height="190%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.12 0 0 0 0 0.78 0 0 0 0 0.95 0 0 0 0.7 0" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={ids.soft} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="7" stdDeviation="8" floodColor="#020617" floodOpacity="0.62" />
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={p.cyan} floodOpacity="0.36" />
        </filter>
        <filter id={ids.shadow} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="10" stdDeviation="7" floodColor="#020617" floodOpacity="0.64" />
        </filter>
      </defs>

      <rect x="7" y="10" width="196" height="140" rx="30" fill={`url(#${ids.scene})`} />
      <ellipse cx="106" cy="137" rx="72" ry="12" fill="#020617" opacity="0.45" />
      <path d="M26 112 C52 68 78 104 104 61 C132 15 164 74 187 40" fill="none" stroke={p.cyan} strokeWidth="1.6" strokeDasharray="7 8" opacity="0.38" />
      <circle cx="34" cy="38" r="18" fill={p.cyan} opacity="0.1" />
      <circle cx="176" cy="105" r="23" fill={p.blue} opacity="0.12" />

      {type === "starter" ? <Starter ids={ids} /> : null}
      {type === "growth" ? <Growth ids={ids} /> : null}
      {type === "creator" ? <Creator ids={ids} /> : null}
      {type === "whatsapp" ? <Whatsapp ids={ids} green={p.green || "#22c55e"} /> : null}
      {type === "ai_ads" ? <AiAds ids={ids} /> : null}
      {type === "enterprise" ? <Enterprise ids={ids} /> : null}
    </svg>
  );
}

type Ids = {
  cyan: string;
  gold: string;
  dark: string;
  glow: string;
  soft: string;
  shadow: string;
};

function Badge({ x, y, label, ids }: { x: number; y: number; label: string; ids: Ids }) {
  return (
    <g filter={`url(#${ids.soft})`}>
      <path d={`M${x + 9} ${y} h45 a13 13 0 0 1 13 13 v3 a13 13 0 0 1-13 13 h-45 a13 13 0 0 1-13-13 v-3 a13 13 0 0 1 13-13z`} fill="rgba(2, 8, 23, 0.82)" stroke={`url(#${ids.cyan})`} />
      <circle cx={x + 13} cy={y + 12} r="6" fill={`url(#${ids.cyan})`} />
      <path d={`M${x + 4} ${y + 24} c5-9 14-9 19 0`} stroke="#e0f2fe" strokeWidth="2" strokeLinecap="round" fill="none" />
      <text x={x + 28} y={y + 18} fill="#fef9c3" fontSize="10" fontWeight="900">{label}</text>
    </g>
  );
}

function Books3D({ ids, x = 35, y = 76 }: { ids: Ids; x?: number; y?: number }) {
  return (
    <g filter={`url(#${ids.soft})`}>
      <path d={`M${x} ${y + 26} l62-7 17 14-62 9z`} fill={`url(#${ids.gold})`} />
      <path d={`M${x + 8} ${y + 10} l62-7 17 14-62 9z`} fill={`url(#${ids.dark})`} stroke={`url(#${ids.cyan})`} />
      <path d={`M${x + 17} ${y - 7} l62-7 17 14-62 9z`} fill="rgba(8, 47, 73, 0.96)" stroke={`url(#${ids.cyan})`} />
      <path d={`M${x + 79} ${y} v20 l-62 9 v-20z M${x + 87} ${y + 17} v17 l-62 9 v-17z`} fill="#0f172a" opacity="0.82" />
      <path d={`M${x + 30} ${y} l25-3 M${x + 20} ${y + 18} l25-3 M${x + 13} ${y + 36} l27-4`} stroke="#e0f2fe" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
    </g>
  );
}

function Starter({ ids }: { ids: Ids }) {
  return (
    <g>
      <Books3D ids={ids} x={30} y={75} />
      <g filter={`url(#${ids.glow})`}>
        <path d="M137 47 c0-17 27-17 27 0 c0 9-8 13-10 22 h-7 c-2-9-10-13-10-22z" fill={`url(#${ids.gold})`} />
        <path d="M145 73 h13 M146 79 h11" stroke="#fef9c3" strokeWidth="3" strokeLinecap="round" />
        <path d="M151 19 v12 M124 46 h11 M169 28 l-9 9 M133 28 l9 9" stroke="#bae6fd" strokeWidth="3" strokeLinecap="round" opacity="0.78" />
      </g>
      <Badge x={121} y={91} label="150+" ids={ids} />
    </g>
  );
}

function Growth({ ids }: { ids: Ids }) {
  return (
    <g>
      <Books3D ids={ids} x={24} y={78} />
      <g filter={`url(#${ids.glow})`}>
        <circle cx="119" cy="69" r="28" fill="rgba(245, 200, 75, 0.14)" stroke={`url(#${ids.gold})`} strokeWidth="3" />
        <path d="M119 49 v38 M107 60 c0-11 25-11 25 0 c0 15-27 6-27 21 c0 10 29 10 29 0" stroke="#fef9c3" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M82 112 l16-19 14 10 24-33" stroke="#7dd3fc" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M133 70 h13 v13" stroke="#7dd3fc" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
      <Badge x={124} y={96} label="700+" ids={ids} />
    </g>
  );
}

function Creator({ ids }: { ids: Ids }) {
  return (
    <g>
      <g filter={`url(#${ids.soft})`}>
        <path d="M45 28 h55 a13 13 0 0 1 13 13 v82 h-68 a13 13 0 0 1-13-13 v-69 a13 13 0 0 1 13-13z" fill={`url(#${ids.dark})`} stroke={`url(#${ids.cyan})`} strokeWidth="2.4" />
        <rect x="43" y="45" width="58" height="54" rx="11" fill="rgba(34, 211, 238, 0.13)" stroke="rgba(186, 230, 253, 0.5)" />
        <path d="M52 58 h36 M52 72 h24 M52 88 l13-11 10 8 14-18" stroke="#e0f2fe" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="73" cy="113" r="4" fill="#bae6fd" />
      </g>
      <g filter={`url(#${ids.glow})`}>
        <path d="M125 35 l17 11-39 56-18 6 7-18z" fill={`url(#${ids.gold})`} stroke="#fef9c3" strokeWidth="1.4" />
        <path d="M96 88 l10 7" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
        <rect x="111" y="66" width="45" height="42" rx="11" fill="rgba(8, 47, 73, 0.9)" stroke={`url(#${ids.cyan})`} />
        <path d="M121 79 h24 M121 91 h17" stroke="#bae6fd" strokeWidth="2.4" strokeLinecap="round" />
      </g>
      <Badge x={116} y={105} label="4000+" ids={ids} />
    </g>
  );
}

function Whatsapp({ ids, green }: { ids: Ids; green: string }) {
  return (
    <g>
      <g filter={`url(#${ids.soft})`}>
        <path d="M37 29 h54 a12 12 0 0 1 12 12 v82 h-66 a12 12 0 0 1-12-12 v-70 a12 12 0 0 1 12-12z" fill={`url(#${ids.dark})`} stroke={`url(#${ids.cyan})`} strokeWidth="2.4" />
        <circle cx="65" cy="72" r="27" fill={green} opacity="0.24" stroke={green} strokeWidth="3.4" />
        <path d="M52 95 l-8 17 19-8" fill={green} opacity="0.9" />
        <path d="M55 66 c7 20 25 27 34 11 l-11-6-6 8 c-6-3-10-8-13-14 l7-6-7-11 c-16 7-13 18-4 18z" fill="#ecfeff" />
      </g>
      <g filter={`url(#${ids.glow})`}>
        <rect x="111" y="44" width="48" height="43" rx="16" fill="rgba(15, 23, 42, 0.95)" stroke={`url(#${ids.cyan})`} strokeWidth="2" />
        <circle cx="127" cy="65" r="5" fill="#e0f2fe" />
        <circle cx="143" cy="65" r="5" fill="#e0f2fe" />
        <path d="M126 76 c7 5 13 5 20 0" stroke={`url(#${ids.gold})`} strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M111 89 c-17 0-16-22-2-22" stroke="#fef9c3" strokeWidth="3" strokeLinecap="round" fill="none" />
        <rect x="103" y="99" width="67" height="23" rx="11.5" fill="rgba(2, 8, 23, 0.82)" stroke={`url(#${ids.cyan})`} />
        <circle cx="118" cy="111" r="3.5" fill="#7dd3fc" />
        <circle cx="135" cy="111" r="3.5" fill="#7dd3fc" />
        <circle cx="152" cy="111" r="3.5" fill="#7dd3fc" />
      </g>
    </g>
  );
}

function AiAds({ ids }: { ids: Ids }) {
  return (
    <g>
      <g filter={`url(#${ids.soft})`}>
        <rect x="29" y="47" width="57" height="57" rx="19" fill={`url(#${ids.dark})`} stroke={`url(#${ids.cyan})`} strokeWidth="2.4" />
        <circle cx="48" cy="72" r="6" fill="#e0f2fe" />
        <circle cx="67" cy="72" r="6" fill="#e0f2fe" />
        <path d="M47 88 c8 7 16 7 24 0" stroke={`url(#${ids.gold})`} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <path d="M39 48 c4-21 35-21 39 0" stroke="#7dd3fc" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      </g>
      <g filter={`url(#${ids.glow})`}>
        <rect x="100" y="34" width="68" height="72" rx="15" fill="rgba(8, 47, 73, 0.92)" stroke={`url(#${ids.cyan})`} strokeWidth="2" />
        <path d="M113 58 c9-13 22 10 34-3 c10-11 20 10 9 20 c-15 13-35 13-50 0 c-6-5-2-12 7-17z" fill="rgba(96, 165, 250, 0.24)" stroke="#bae6fd" strokeWidth="2.4" />
        <path d="M113 91 h11 l6-22 8 32 7-17 h11" stroke="#7dd3fc" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M98 119 l39-18 8 12-38 19z" fill={`url(#${ids.gold})`} />
        <path d="M137 101 l16-11 2 27-10-4z" fill="#fef9c3" />
      </g>
    </g>
  );
}

function Enterprise({ ids }: { ids: Ids }) {
  return (
    <g>
      <g filter={`url(#${ids.glow})`}>
        <path d="M104 29 l42 23 v48 l-42 24-42-24 v-48z" fill={`url(#${ids.dark})`} stroke={`url(#${ids.cyan})`} strokeWidth="2.6" />
        <path d="M62 52 l42 24 42-24 M104 76 v48" stroke="#bae6fd" strokeWidth="2.4" opacity="0.74" />
        <path d="M82 64 h44 M82 83 h44 M82 102 h44" stroke="#7dd3fc" strokeWidth="2" strokeLinecap="round" opacity="0.52" />
      </g>
      <g filter={`url(#${ids.soft})`}>
        <rect x="25" y="91" width="43" height="31" rx="10" fill="rgba(8, 47, 73, 0.92)" stroke={`url(#${ids.cyan})`} />
        <rect x="142" y="86" width="42" height="31" rx="10" fill="rgba(8, 47, 73, 0.92)" stroke={`url(#${ids.cyan})`} />
        <rect x="139" y="31" width="38" height="29" rx="10" fill="rgba(2, 8, 23, 0.86)" stroke={`url(#${ids.gold})`} />
        <path d="M68 106 h36 h38 M104 100 v29 M129 55 h10 M62 55 h-12" stroke={`url(#${ids.gold})`} strokeWidth="3.2" strokeLinecap="round" fill="none" />
        <circle cx="46" cy="106" r="6" fill="#7dd3fc" />
        <circle cx="163" cy="101" r="6" fill="#7dd3fc" />
        <path d="M151 45 h14 M38 106 h17 M154 101 h18" stroke="#e0f2fe" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    </g>
  );
}
