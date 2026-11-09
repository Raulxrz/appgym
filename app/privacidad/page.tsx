import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteNav } from "@/components/Site";

export const metadata: Metadata = { title: "Privacidad" };

export default function Privacy() {
  return (
    <div className="site">
      <SiteNav />
      <main className="prose wrap">
        <p className="eyebrow eyebrow-accent">Política de privacidad</p>
        <h1>Privacidad</h1>
        <p className="lead">Asymettry usa tu cuenta de Google para que puedas registrar entrenamientos en tus propios archivos de Drive.</p>
        <h2>A qué accede</h2>
        <p>A tu nombre y correo, para mostrar con qué cuenta has entrado, y solo a los archivos de Drive que elijas en el selector de Google o que la app cree para ti.</p>
        <h2>Qué guarda</h2>
        <p>Tus registros se guardan únicamente en esos Excel. La app no tiene base de datos: tu sesión se conserva en una cookie cifrada en tu navegador y los cambios pendientes de subir, en el almacenamiento local de tu navegador.</p>
        <h2>Con quién lo comparte</h2>
        <p>Con nadie. Los datos de Google solo se usan para el funcionamiento de la app.</p>
        <h2>Cómo retirar el acceso</h2>
        <p>Puedes retirarlo cuando quieras en los <a href="https://myaccount.google.com/permissions">permisos de tu cuenta de Google</a>. Tus Excel seguirán en tu Drive.</p>
        <h2>Contacto</h2>
        <p>Para cualquier duda sobre tus datos, escribe a <a href="mailto:spa2008xx@gmail.com">spa2008xx@gmail.com</a>.</p>
        <p><Link className="button" href="/">Volver al inicio</Link></p>
      </main>
      <SiteFooter />
    </div>
  );
}
