import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteNav } from "@/components/Site";

export const metadata: Metadata = { title: "Términos de servicio" };

export default function Terms() {
  return (
    <div className="site">
      <SiteNav />
      <main className="prose wrap">
        <p className="eyebrow eyebrow-accent">Términos de servicio</p>
        <h1>Términos</h1>
        <p className="lead">Estas condiciones regulan el uso de Asymettry. Al entrar con tu cuenta de Google y usar la app, las aceptas.</p>
        <p className="muted">Última actualización: 9 de noviembre de 2026.</p>
        <h2>Qué es Asymettry</h2>
        <p>Una herramienta gratuita para planificar y registrar entrenamientos en hojas de Excel que se guardan en tu propio Google Drive. La app no aloja tus registros: lee y escribe solo los archivos que tú eliges o que la app crea para ti.</p>
        <h2>Tu cuenta</h2>
        <p>Necesitas una cuenta de Google para usarla. Eres responsable de lo que ocurra con tu cuenta y de mantenerla segura. También debes cumplir las condiciones de servicio de Google al usar Drive.</p>
        <h2>Tus datos</h2>
        <p>Tus entrenamientos y tus archivos son tuyos. No adquirimos ningún derecho sobre ellos. Cómo tratamos la información de tu cuenta se explica en la <Link href="/privacidad">política de privacidad</Link>.</p>
        <h2>Uso aceptable</h2>
        <p>No uses la app para fines ilegales, para intentar acceder a archivos o cuentas de otras personas, ni para sobrecargar o interferir con el servicio o con las API de Google.</p>
        <h2>Salud y entrenamiento</h2>
        <p>Asymettry es una herramienta de registro y no da consejo médico ni profesional. Entrenas bajo tu responsabilidad: consulta a un profesional antes de empezar o cambiar un programa de ejercicio.</p>
        <h2>Disponibilidad</h2>
        <p>La app se ofrece tal cual, sin garantías. Puede haber interrupciones, errores o cambios, y depende de servicios de Google que no controlamos. Te recomendamos conservar tus Excel, que siempre seguirán en tu Drive.</p>
        <h2>Responsabilidad</h2>
        <p>En la medida en que lo permita la ley, no respondemos de pérdidas de datos, lesiones ni daños indirectos derivados del uso de la app. Nada en estos términos limita los derechos que la ley te reconozca como consumidor.</p>
        <h2>Fin del uso</h2>
        <p>Puedes dejar de usar la app cuando quieras y retirar su acceso en los <a href="https://myaccount.google.com/permissions">permisos de tu cuenta de Google</a>. Podemos suspender el acceso a quien incumpla estos términos.</p>
        <h2>Cambios</h2>
        <p>Podemos actualizar estos términos. Si el cambio es importante, lo indicaremos en esta página con una nueva fecha. Seguir usando la app después supone aceptar la nueva versión.</p>
        <h2>Contacto</h2>
        <p>Para cualquier duda sobre estos términos, escribe a <a href="mailto:spa2008xx@gmail.com">spa2008xx@gmail.com</a>.</p>
        <p><Link className="button" href="/">Volver al inicio</Link></p>
      </main>
      <SiteFooter />
    </div>
  );
}
