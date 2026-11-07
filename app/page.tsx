import App from "@/components/App";
import { SiteFooter, SiteNav } from "@/components/Site";
import { readSession } from "@/lib/session";

const ERRORS: Record<string, string> = {
  cancelado: "Has cancelado el inicio de sesión.",
  permiso: "Para guardar tus entrenamientos, marca la casilla de acceso a Drive en la pantalla de Google.",
  sesion: "El inicio de sesión ha caducado. Vuelve a intentarlo.",
  google: "Google no ha podido completar el inicio de sesión. Vuelve a intentarlo.",
};

const PREVIEW_COLUMNS = ["Micro 1", "Micro 2", "Micro 3", "Descarga"];
const PREVIEW_ROWS = [
  { name: "Press banca", targets: "6 · 10 reps", logs: ["82.5x7 / 70x11", "85x6 / 72.5x10", null, null] },
  { name: "Remo con barra", targets: "8 · 12 reps", logs: ["70x8 / 60x12", "72.5x8 / 60x12", null, null] },
  { name: "Press militar", targets: "8 · 10 reps", logs: ["45x8 / 37.5x10", null, null, null] },
  { name: "Fondos lastrados", targets: "10 reps", logs: ["10x10+P4", null, null, null] },
];

const STEPS = [
  {
    n: "01",
    title: "Tu Excel, en tu Drive",
    text: "Elige un Excel que ya uses o crea una copia de una rutina. Asymettry solo escribe en las celdas de registro y respeta tu formato.",
  },
  {
    n: "02",
    title: "Microciclos y descarga",
    text: "Cada día muestra la pauta de la semana, tu marca anterior y lo que toca hoy. Un toque te lleva a lo siguiente.",
  },
  {
    n: "03",
    title: "Guardado sin pensar",
    text: "Cada serie se sube sola a Drive. Si pierdes la cobertura en el gimnasio, se guarda en el navegador hasta que vuelva.",
  },
];

function AppPreview() {
  return (
    <div className="preview" aria-hidden="true">
      <div className="preview-window">
        <div className="preview-bar">
          <span className="preview-dots"><i /><i /><i /></span>
          <span className="preview-file">ENTRENO 19 (Asymettry)</span>
          <span className="preview-saved">Guardado en Drive</span>
        </div>
        <div className="preview-days">
          <span className="preview-day preview-day-on">Día 1 · Push</span>
          <span className="preview-day">Día 2 · Piernas</span>
          <span className="preview-day">Día 3 · Tirón</span>
        </div>
        <div className="preview-grid">
          <span className="preview-head preview-name">Ejercicio</span>
          {PREVIEW_COLUMNS.map((c, i) => (
            <span key={c} className={`preview-head${i === 1 ? " preview-current" : ""}`}>{c}</span>
          ))}
          {PREVIEW_ROWS.map((r, row) => (
            <div key={r.name} className="preview-row">
              <span className="preview-name">
                <b>{r.name}</b>
                <small>{r.targets}</small>
              </span>
              {r.logs.map((log, i) => (
                <span
                  key={i}
                  className={`preview-cell${i === 1 ? " preview-cell-current" : ""}${row === 2 && i === 1 ? " preview-cell-selected" : ""}`}
                >
                  {log ? <b>{log}</b> : <em>Apuntar</em>}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="preview-editor">
        <p className="eyebrow">Microciclo 2</p>
        <p className="preview-editor-title">Press militar</p>
        <div className="preview-prev">
          <span className="eyebrow">Sesión anterior</span>
          <b>45x8 / 37.5x10</b>
        </div>
        <div className="preview-set preview-set-done">
          <span>Top 1</span><b>47.5</b><i>×</i><b>8</b><span className="preview-check">✓</span>
        </div>
        <div className="preview-set preview-set-done">
          <span>Resto 1</span><b>40</b><i>×</i><b>10</b><span className="preview-check">✓</span>
        </div>
        <div className="preview-set">
          <span>Resto 2</span><b>40</b><i>×</i><b className="preview-caret">9</b><span className="preview-check preview-check-off">✓</span>
        </div>
      </div>
    </div>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await readSession();
  if (session) return <App email={session.email} />;
  const { error } = await searchParams;
  return (
    <div className="site">
      <SiteNav />
      <main>
        <section className="hero wrap">
          <div className="hero-copy">
            <p className="eyebrow eyebrow-accent">Registro de entrenamiento para Google Drive</p>
            <h1>
              Apunta cada serie.
              <span className="hero-h1-alt">Tu Excel hace el resto.</span>
            </h1>
            <p className="lead">
              Sigue tu rutina por microciclos desde el móvil, con tu marca anterior siempre a la vista. Todo se guarda en tu propio Excel de Google Drive.
            </p>
            {error && ERRORS[error] && <p className="notice notice-error" role="alert">{ERRORS[error]}</p>}
            <div className="hero-actions">
              <a className="button button-primary button-large" href="/api/auth/login">
                <GoogleGlyph />
                Entrar con Google
              </a>
              <a className="button button-large" href="#como-funciona">Ver cómo funciona</a>
            </div>
            <p className="fineprint">Gratis. Solo accede a los Excel que elijas o que cree para ti, nunca al resto de tu Drive.</p>
          </div>
          <AppPreview />
        </section>

        <section id="como-funciona" className="steps wrap" aria-labelledby="steps-title">
          <div className="steps-head">
            <h2 id="steps-title">Cómo funciona Asymettry</h2>
            <p className="muted">Sin base de datos ni hojas nuevas que aprender: la app lee y escribe el Excel que ya tienes.</p>
          </div>
          <ol className="steps-list">
            {STEPS.map((s) => (
              <li key={s.n} className="step">
                <span className="step-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="format">
            <span className="eyebrow">Formato en la columna KGs x Reps</span>
            <code>82.5x7 / 70x11</code>
            <code>60x8+DS45x6+P4</code>
            <code>60x8+RP3</code>
            <code>1min</code>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg className="google-glyph" width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
