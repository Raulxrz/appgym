// Rutinas incluidas. El id coincide con el archivo de templates/ y no debe cambiar.
export type Template = {
  id: string;
  number: string;
  title: string;
  detail: string;
  days: string[];
  fileName: string;
  /** Nombre de los archivos creados antes de guardar la plantilla en las propiedades de Drive. */
  legacyName: RegExp;
};

export const TEMPLATES: Template[] = [
  {
    id: "entreno-7",
    number: "Entreno 1",
    title: "PPL + Torso y Brazo",
    detail: "Tirón, empuje y pierna, con un día de torso y otro de brazo y hombro.",
    days: ["Pull", "Push", "Pierna", "Torso", "Brazo y hombro"],
    fileName: "Entreno 1 · PPL + Torso y Brazo (Asymettry).xlsx",
    legacyName: /entreno\s*7\b/i,
  },
  {
    id: "entreno-19",
    number: "Entreno 2",
    title: "Doble pierna en 5 días",
    detail: "Empuje y tirón con brazo, un día de torso y dos días de pierna.",
    days: ["Push + Brazo", "Pierna 1", "Tirón + Brazo", "Torso", "Pierna 2"],
    fileName: "Entreno 2 · Doble pierna en 5 días (Asymettry).xlsx",
    legacyName: /entreno\s*19\b/i,
  },
];

export const TEMPLATE_PROPERTY = "asymettryTemplate";

export function templateOf(file: { name: string; appProperties?: Record<string, string> }): Template | undefined {
  const id = file.appProperties?.[TEMPLATE_PROPERTY];
  if (id) return TEMPLATES.find((t) => t.id === id);
  return TEMPLATES.find((t) => t.fileName === file.name || t.legacyName.test(file.name));
}
