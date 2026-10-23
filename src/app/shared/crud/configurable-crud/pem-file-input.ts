/**
 * Reads a certificate or key upload as PEM text into a form field (the API validates and seals it)
 * and remembers the file name shown beside the field; an empty selection clears both.
 */
export function readPemFileInput(
  event: Event,
  key: string,
  fileNames: Map<string, string>,
  setValue: (key: string, value: string) => void,
): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) {
    fileNames.delete(key);
    setValue(key, '');
    return;
  }
  void file.text().then((content) => {
    fileNames.set(key, file.name);
    setValue(key, content);
  });
}
