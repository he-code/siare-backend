export const cleanOptional = (value: string | null | undefined): string | null => {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
};

export const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export const escapePdfText = (value: unknown): string =>
  String(value ?? '')
    // Los caracteres de control no son válidos en el contenido de PDFKit.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .slice(0, 5000);
