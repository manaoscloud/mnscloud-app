/**
 * Extra images attached to a problem report. Every image is decoded and re-encoded in the
 * browser: the upload never carries the original bytes, so EXIF/GPS metadata is dropped and the
 * size stays inside the support attachment limit. The API still validates the file signature.
 */
export const REPORT_IMAGE_LIMIT = 5;
export const REPORT_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';
const INPUT_MAX_BYTES = 25 * 1024 * 1024;
/** Same limit as a support ticket attachment on the API. */
const OUTPUT_MAX_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 2560;

/** Message is a translation key shown to the user. */
export class ReportImageError extends Error {}

export function reportImageExtension(blob: Blob): string {
  if (blob.type === 'image/webp') return 'webp';
  if (blob.type === 'image/png') return 'png';
  return 'jpg';
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/** The automatic print travels inside the ticket request, whose screenshot limit is 5 MB. */
export const REPORT_SCREENSHOT_MAX_BYTES = 4.5 * 1024 * 1024;

/** WebP when the browser can encode it (Safari cannot), otherwise JPEG, within the size limit. */
export async function encodeReportCanvas(
  canvas: HTMLCanvasElement,
  maxBytes = OUTPUT_MAX_BYTES,
): Promise<Blob> {
  for (const quality of [0.9, 0.75, 0.6]) {
    let blob = await canvasBlob(canvas, 'image/webp', quality);
    if (!blob || blob.type !== 'image/webp') blob = await canvasBlob(canvas, 'image/jpeg', quality);
    if (blob && blob.size <= maxBytes) return blob;
  }
  throw new ReportImageError('The image is too large. Crop it or use a smaller image.');
}

export async function loadReportImage(source: Blob | string): Promise<HTMLImageElement> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return image;
  } catch {
    throw new ReportImageError('The image could not be read.');
  } finally {
    if (typeof source !== 'string') URL.revokeObjectURL(url);
  }
}

/** Bounded, metadata-free copy of a user image (orientation applied by the browser decoder). */
export async function normalizeReportImage(file: Blob): Promise<Blob> {
  if (!REPORT_IMAGE_ACCEPT.split(',').includes(file.type)) {
    throw new ReportImageError('Only PNG, JPEG, WebP or GIF images can be attached.');
  }
  if (!file.size) throw new ReportImageError('The image could not be read.');
  if (file.size > INPUT_MAX_BYTES) {
    throw new ReportImageError('The image is too large. Crop it or use a smaller image.');
  }
  const image = await loadReportImage(file);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) throw new ReportImageError('The image could not be read.');
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new ReportImageError('The image could not be read.');
  // JPEG has no alpha: transparent areas become white instead of black.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return await encodeReportCanvas(canvas);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
