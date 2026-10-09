import { normalizeReportImage, ReportImageError } from './report-image';
import { paintAnnotation } from './image-annotator/image-annotator';

function canvasBlob(width: number, height: number, type = 'image/png'): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.fillStyle = 'rgb(0, 128, 255)';
  context.fillRect(0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!), type));
}

async function size(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  return { width: bitmap.width, height: bitmap.height };
}

describe('normalizeReportImage', () => {
  it('re-encodes and bounds large images', async () => {
    const result = await normalizeReportImage(await canvasBlob(4000, 1000));
    expect(['image/webp', 'image/jpeg']).toContain(result.type);
    expect(await size(result)).toEqual({ width: 2560, height: 640 });
  });

  it('keeps small images at their size', async () => {
    expect(await size(await normalizeReportImage(await canvasBlob(300, 200)))).toEqual({
      width: 300,
      height: 200,
    });
  });

  it('rejects files that are not raster images', async () => {
    const svg = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], {
      type: 'image/svg+xml',
    });
    await expectAsync(normalizeReportImage(svg)).toBeRejectedWithError(ReportImageError);
    const fake = new Blob(['not an image'], { type: 'image/png' });
    await expectAsync(normalizeReportImage(fake)).toBeRejectedWithError(ReportImageError);
  });
});

describe('paintAnnotation', () => {
  it('blur replaces detail with uniform blocks', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 100;
    const context = canvas.getContext('2d')!;
    for (let x = 0; x < 200; x += 2) {
      context.fillStyle = x % 4 ? '#000' : '#fff';
      context.fillRect(x, 0, 2, 100);
    }
    paintAnnotation(context, { tool: 'blur', from: { x: 0, y: 0 }, to: { x: 200, y: 100 } }, 4);
    const row = context.getImageData(0, 10, 16, 1).data;
    for (let index = 4; index < row.length; index += 4) expect(row[index]).toBe(row[0]);
  });

  it('highlight draws the mark color on the box border', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const context = canvas.getContext('2d')!;
    paintAnnotation(context, { tool: 'rect', from: { x: 10, y: 10 }, to: { x: 90, y: 90 } }, 4);
    const [r, g] = context.getImageData(10, 50, 1, 1).data;
    expect(r).toBeGreaterThan(150);
    expect(g).toBeLessThan(100);
  });
});
