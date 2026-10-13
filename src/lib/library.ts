export const SUBJECTS = [
  { id: "spanish", label: "اللغة الإسبانية", sub: "Lengua Española" },
  { id: "french", label: "اللغة الفرنسية", sub: "Langue Française" },
  { id: "english", label: "اللغة الإنجليزية", sub: "English Language" },
  { id: "arabic", label: "اللغة العربية والآداب", sub: "" },
  { id: "history_geo", label: "التاريخ والجغرافيا", sub: "" },
  { id: "philosophy", label: "الفلسفة", sub: "" },
  { id: "islamic", label: "العلوم الإسلامية", sub: "" },
  { id: "math", label: "الرياضيات", sub: "" },
] as const;

export type SubjectId = (typeof SUBJECTS)[number]["id"];

export const CONTENT_TYPES = [
  { id: "lesson", label: "درس" },
  { id: "summary", label: "ملخص" },
] as const;

export const subjectLabel = (id: string) => SUBJECTS.find((s) => s.id === id)?.label ?? id;
export const contentTypeLabel = (id: string) =>
  CONTENT_TYPES.find((c) => c.id === id)?.label ?? id;

/** Compress an image in the browser to a JPEG, max dimension `max`. */
export async function compressImage(file: File, max = 1600, quality = 0.75): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("compress failed"))), "image/jpeg", quality),
  );
}
