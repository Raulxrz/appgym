"use client";
// Selector de archivos de Google. Es lo que da acceso a un Excel existente con el permiso drive.file.

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const PROJECT_NUMBER = process.env.NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER;
export const pickerConfigured = !!(API_KEY && PROJECT_NUMBER);
export const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    gapi?: any;
    google?: any;
  }
}

let loading: Promise<void> | undefined;

function loadPicker(): Promise<void> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.onerror = () => {
      loading = undefined;
      reject(new Error("No se ha podido cargar el selector de Google Drive"));
    };
    script.onload = () => window.gapi.load("picker", { callback: () => resolve() });
    document.head.appendChild(script);
  });
  return loading;
}

export async function openDrivePicker(mimeType: string): Promise<string | null> {
  await loadPicker();
  const res = await fetch("/api/auth/token");
  if (!res.ok) throw new Error("Tu sesión ha caducado. Vuelve a entrar.");
  const { accessToken } = await res.json();
  const { picker } = window.google;
  return new Promise((resolve) => {
    const view = new picker.DocsView(picker.ViewId.DOCS).setMimeTypes(mimeType).setMode(picker.DocsViewMode.LIST);
    new picker.PickerBuilder()
      .setAppId(PROJECT_NUMBER)
      .setDeveloperKey(API_KEY)
      .setOAuthToken(accessToken)
      .setLocale("es")
      .setTitle("Elige tu Excel de entrenamiento")
      .addView(view)
      .setCallback((data: any) => {
        if (data.action === picker.Action.PICKED) resolve(data.docs[0].id);
        else if (data.action === picker.Action.CANCEL) resolve(null);
      })
      .build()
      .setVisible(true);
  });
}
