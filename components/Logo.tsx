// Marca de Asymettry: una mancuerna con discos desiguales.
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" className="logo-tile" />
      <rect x="5" y="7" width="6" height="18" rx="1.5" className="logo-plate" />
      <rect x="11" y="14.25" width="11" height="3.5" className="logo-plate" />
      <rect x="22" y="10.5" width="5" height="11" rx="1.5" className="logo-plate" />
    </svg>
  );
}

export default function Logo({ size }: { size?: number }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logo-word">Asymettry</span>
    </span>
  );
}
