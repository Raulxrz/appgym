import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"] });

export const metadata: Metadata = {
  title: "AppGym",
  description: "Registra tus entrenamientos en tus propios Excel de Google Drive.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={archivo.className}>{children}</body>
    </html>
  );
}
