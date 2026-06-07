interface LogoProps {
  size?: number;
}

export function Logo({ size = 28 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="4" fill="#1e293b" />
      <ellipse cx="16" cy="9" rx="7" ry="2.5" stroke="#94a3b8" strokeWidth="1.5" />
      <path d="M9 9v6c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5V9" stroke="#94a3b8" strokeWidth="1.5" />
      <path d="M9 15v6c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5v-6" stroke="#94a3b8" strokeWidth="1.5" />
      <text x="16" y="27" textAnchor="middle" fill="#60a5fa" fontSize="7" fontFamily="monospace" fontWeight="700">
        SQL
      </text>
    </svg>
  );
}
