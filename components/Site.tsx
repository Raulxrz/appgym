import Link from "next/link";
import Logo from "./Logo";

export function SiteNav() {
  return (
    <header className="site-nav wrap">
      <Link href="/" className="logo-link" aria-label="Asymettry, inicio"><Logo /></Link>
      <nav className="site-nav-links" aria-label="Principal">
        <Link className="nav-link" href="/privacidad">Privacidad</Link>
        <a className="button button-primary button-small" href="/api/auth/login">Entrar con Google</a>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-foot wrap">
      <Logo size={22} />
      <p>Tus entrenamientos viven en tu Google Drive, no en nuestros servidores.</p>
      <Link className="nav-link" href="/privacidad">Privacidad</Link>
    </footer>
  );
}
