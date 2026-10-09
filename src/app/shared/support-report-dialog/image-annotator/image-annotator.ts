import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { encodeReportCanvas, loadReportImage, ReportImageError } from '../report-image';

export interface ImageAnnotatorData {
  /** Data URL or object URL of the image to mark. */
  src: string;
  /** Upper bound for the encoded result (the print travels inside the ticket request). */
  maxBytes?: number;
}

export type AnnotationTool = 'rect' | 'arrow' | 'blur';
type Point = { x: number; y: number };
export type Annotation = { tool: AnnotationTool; from: Point; to: Point };

const MARK_COLOR = '#e11d48';
const MARK_HALO = 'rgba(255, 255, 255, 0.85)';

/**
 * Marks the exact spot of a problem on a report image: highlight box, arrow, and blur for data
 * that must not leave the browser. Blur is applied to the exported pixels, never as an overlay.
 */
@Component({
  selector: 'app-report-image-annotator',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  templateUrl: './image-annotator.html',
  styleUrls: ['./image-annotator.scss'],
})
export class ReportImageAnnotatorComponent {
  private readonly dialogRef = inject(MatDialogRef<ReportImageAnnotatorComponent, Blob | null>);
  readonly data = inject<ImageAnnotatorData>(MAT_DIALOG_DATA);
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  readonly tools: ReadonlyArray<{ value: AnnotationTool; icon: string; label: string }> = [
    { value: 'rect', icon: 'crop_square', label: 'Highlight' },
    { value: 'arrow', icon: 'north_east', label: 'Arrow' },
    { value: 'blur', icon: 'blur_on', label: 'Blur' },
  ];
  readonly tool = signal<AnnotationTool>('rect');
  readonly annotations = signal<Annotation[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly hasChanges = computed(() => this.annotations().length > 0);

  private image: HTMLImageElement | null = null;
  private drawing: Annotation | null = null;
  private frame = 0;

  constructor() {
    afterNextRender(() => void this.load());
  }

  private async load() {
    try {
      this.image = await loadReportImage(this.data.src);
      const canvas = this.canvasRef().nativeElement;
      canvas.width = this.image.naturalWidth;
      canvas.height = this.image.naturalHeight;
      this.render();
    } catch (error) {
      this.error.set(
        error instanceof ReportImageError ? error.message : 'The image could not be read.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  setTool(value: unknown) {
    if (value === 'rect' || value === 'arrow' || value === 'blur') this.tool.set(value);
  }

  undo() {
    this.annotations.update((items) => items.slice(0, -1));
    this.render();
  }

  clear() {
    this.annotations.set([]);
    this.render();
  }

  pointerDown(event: PointerEvent) {
    if (!this.image || this.saving() || (event.pointerType === 'mouse' && event.button !== 0))
      return;
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    const point = this.toCanvas(event);
    this.drawing = { tool: this.tool(), from: point, to: point };
  }

  pointerMove(event: PointerEvent) {
    if (!this.drawing) return;
    event.preventDefault();
    this.drawing = { ...this.drawing, to: this.toCanvas(event) };
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.render());
  }

  pointerUp(event: PointerEvent) {
    const shape = this.drawing;
    this.drawing = null;
    if (!shape) return;
    const done = { ...shape, to: this.toCanvas(event) };
    const minimum = this.strokeWidth() * 2;
    if (
      Math.abs(done.to.x - done.from.x) >= minimum ||
      Math.abs(done.to.y - done.from.y) >= minimum
    ) {
      this.annotations.update((items) => [...items, done]);
    }
    this.render();
  }

  async apply() {
    if (!this.image || this.saving()) return;
    if (!this.hasChanges()) {
      this.dialogRef.close(null);
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      this.render();
      this.dialogRef.close(
        await encodeReportCanvas(this.canvasRef().nativeElement, this.data.maxBytes),
      );
    } catch (error) {
      this.error.set(
        error instanceof ReportImageError ? error.message : 'The image could not be read.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  cancel() {
    this.dialogRef.close(null);
  }

  /** Pointer position in image pixels: the canvas is shown scaled to fit the dialog. */
  private toCanvas(event: PointerEvent): Point {
    const canvas = this.canvasRef().nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    return {
      x: Math.min(canvas.width, Math.max(0, x)),
      y: Math.min(canvas.height, Math.max(0, y)),
    };
  }

  private strokeWidth(): number {
    const canvas = this.canvasRef().nativeElement;
    return Math.max(3, Math.round(Math.max(canvas.width, canvas.height) / 400));
  }

  private render() {
    const canvas = this.canvasRef().nativeElement;
    const context = canvas.getContext('2d');
    if (!context || !this.image) return;
    context.drawImage(this.image, 0, 0, canvas.width, canvas.height);
    const shapes = this.drawing ? [...this.annotations(), this.drawing] : this.annotations();
    for (const shape of shapes) paintAnnotation(context, shape, this.strokeWidth());
  }
}

export function annotationBox(shape: Annotation) {
  return {
    x: Math.min(shape.from.x, shape.to.x),
    y: Math.min(shape.from.y, shape.to.y),
    width: Math.abs(shape.to.x - shape.from.x),
    height: Math.abs(shape.to.y - shape.from.y),
  };
}

export function paintAnnotation(
  context: CanvasRenderingContext2D,
  shape: Annotation,
  stroke: number,
) {
  const box = annotationBox(shape);
  if (shape.tool === 'blur') {
    pixelate(context, box.x, box.y, box.width, box.height, Math.max(14, stroke * 4));
    return;
  }
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const [color, width] of [
    [MARK_HALO, stroke + 3],
    [MARK_COLOR, stroke],
  ] as const) {
    context.strokeStyle = color;
    context.lineWidth = width;
    if (shape.tool === 'rect') {
      context.strokeRect(box.x, box.y, box.width, box.height);
    } else {
      const angle = Math.atan2(shape.to.y - shape.from.y, shape.to.x - shape.from.x);
      const head = stroke * 5;
      context.beginPath();
      context.moveTo(shape.from.x, shape.from.y);
      context.lineTo(shape.to.x, shape.to.y);
      for (const side of [-1, 1]) {
        context.moveTo(shape.to.x, shape.to.y);
        context.lineTo(
          shape.to.x - head * Math.cos(angle + (side * Math.PI) / 7),
          shape.to.y - head * Math.sin(angle + (side * Math.PI) / 7),
        );
      }
      context.stroke();
    }
  }
  context.restore();
}

/** Replaces the area with large opaque blocks: unreadable text, no reversible soft blur. */
function pixelate(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  block: number,
) {
  const left = Math.floor(x);
  const top = Math.floor(y);
  const w = Math.ceil(width);
  const h = Math.ceil(height);
  if (w < 1 || h < 1) return;
  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.ceil(w / block));
  small.height = Math.max(1, Math.ceil(h / block));
  const reduced = small.getContext('2d');
  if (!reduced) return;
  reduced.drawImage(context.canvas, left, top, w, h, 0, 0, small.width, small.height);
  // Whole blocks clipped to the area, so every block is one flat color.
  context.save();
  context.beginPath();
  context.rect(left, top, w, h);
  context.clip();
  context.imageSmoothingEnabled = false;
  context.drawImage(small, left, top, small.width * block, small.height * block);
  context.restore();
}
