import { Link } from "react-router";

export function LogoMark({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="15" stroke="#A8842B" strokeWidth="2" />
      <g stroke="#A8842B" strokeWidth="2.2" strokeLinecap="round">
        <line x1="16" y1="8" x2="16" y2="24" />
        <line x1="9.1" y1="12" x2="22.9" y2="20" />
        <line x1="22.9" y1="12" x2="9.1" y2="20" />
      </g>
    </svg>
  );
}

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-1.5 select-none">
      <span className={`text-xl font-extrabold tracking-tight ${dark ? "text-ivory" : "text-ink"}`}>
        club 1
      </span>
      <LogoMark />
    </Link>
  );
}
