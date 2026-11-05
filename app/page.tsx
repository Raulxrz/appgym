import App from "@/components/App";
import { readSession } from "@/lib/session";
import Link from "next/link";

const ERRORS: Record<string, string> = {
  cancelado: "Has cancelado el inicio de sesión.",
  permiso: "Para guardar tus entrenamientos, marca la casilla de acceso a Drive en la pantalla de Google.",
  sesion: "El inicio de sesión ha caducado. Vuelve a intentarlo.",
  google: "Google no ha podido completar el inicio de sesión. Vuelve a intentarlo.",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await readSession();
  if (session) return <App email={session.email} />;
  const { error } = await searchParams;
  return (
    <main className="landing">
      <h1>AppGym</h1>
      <p className="lead">Apunta tus series y sigue tu rutina por microciclos. Todo se guarda en tu propio Excel de Google Drive.</p>
      {error && ERRORS[error] && <p className="notice notice-error" role="alert">{ERRORS[error]}</p>}
      <a className="button button-primary" href="/api/auth/login">Entrar con Google</a>
      <p className="fineprint">
        La app solo accede a los Excel que elijas o que cree para ti, nunca al resto de tu Drive.{" "}
        <Link href="/privacidad">Privacidad</Link>
      </p>
    </main>
  );
}
