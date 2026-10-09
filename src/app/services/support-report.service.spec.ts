import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { ApiService } from './api.service';
import { ClientDiagnosticsService } from './client-diagnostics.service';
import { SnackbarService } from './snackbar.service';
import {
  SUPPORT_REPORT_BACKDROP_CLASS,
  SUPPORT_REPORT_PANE_CLASS,
  SupportReportService,
  isExcludedFromReportCapture,
  maskSensitiveContent,
  prepareCloneForCapture,
} from './support-report.service';

@Component({
  standalone: true,
  template: `<div style="width: 320px; height: 200px; background: rgb(220, 0, 0)"></div>`,
})
class RedDialogComponent {}

@Component({
  standalone: true,
  template: `<div style="width: 320px; height: 200px; background: rgb(0, 0, 220)"></div>`,
})
class BlueDialogComponent {}

@Component({
  standalone: true,
  template: `<div style="width: 320px; padding: 16px; background: #222">
    <div style="backdrop-filter: blur(8px); padding: 8px">
      <button
        id="footer-save"
        style="width: 120px; height: 40px; border: 0; background: rgb(0, 220, 0)"
      >
        Save
      </button>
    </div>
  </div>`,
})
class FormDialogComponent {}

function element(classes: string[]): Element {
  const node = document.createElement('div');
  node.classList.add(...classes);
  return node;
}

async function pixelAt(dataUrl: string, x: number, y: number) {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0);
  const [r, g, b] = context.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
  return { r, g, b, width: canvas.width, height: canvas.height };
}

function paneOf(ref: MatDialogRef<unknown>): HTMLElement {
  const pane = document.getElementById(ref.id)?.closest('.cdk-overlay-pane');
  if (!pane) throw new Error('Dialog pane not found');
  return pane as HTMLElement;
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 300));
}

describe('SupportReportService capture', () => {
  let service: SupportReportService;
  let dialog: MatDialog;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ApiService, useValue: {} },
        { provide: SnackbarService, useValue: { success: () => {}, error: () => {} } },
        { provide: ClientDiagnosticsService, useValue: { snapshot: () => ({}) } },
      ],
    });
    service = TestBed.inject(SupportReportService);
    dialog = TestBed.inject(MatDialog);
  });

  afterEach(async () => {
    dialog.closeAll();
    await settle();
  });

  it('leaves out only the report dialogs, menus and tooltips', () => {
    expect(isExcludedFromReportCapture(element([SUPPORT_REPORT_PANE_CLASS]))).toBeTrue();
    expect(isExcludedFromReportCapture(element([SUPPORT_REPORT_BACKDROP_CLASS]))).toBeTrue();
    expect(isExcludedFromReportCapture(element(['mat-mdc-menu-panel']))).toBeTrue();
    expect(isExcludedFromReportCapture(element(['mat-mdc-tooltip-panel']))).toBeTrue();
    // The dialog where the problem happened is part of the print.
    expect(isExcludedFromReportCapture(element(['cdk-overlay-container']))).toBeFalse();
    expect(
      isExcludedFromReportCapture(element(['cdk-overlay-pane', 'crud-form-dialog'])),
    ).toBeFalse();
    expect(isExcludedFromReportCapture(element(['cdk-overlay-backdrop']))).toBeFalse();
  });

  it('prints the open dialog and not the report dialog above it', async () => {
    const problem = dialog.open(RedDialogComponent, { hasBackdrop: false });
    await settle();
    const rect = paneOf(problem).getBoundingClientRect();
    // The report dialog sits exactly over the problem dialog: it must not hide it in the print.
    dialog.open(BlueDialogComponent, {
      hasBackdrop: false,
      panelClass: SUPPORT_REPORT_PANE_CLASS,
    });
    await settle();

    const image = await service.captureScreen();
    expect(image).toBeTruthy();
    const ratio = (await pixelAt(image!, 0, 0)).width / window.innerWidth;
    const pixel = await pixelAt(
      image!,
      (rect.left + rect.width / 2) * ratio,
      (rect.top + rect.height / 2) * ratio,
    );
    expect(pixel.r).toBeGreaterThan(150);
    expect(pixel.b).toBeLessThan(100);
  });

  it('keeps dialog footers and field labels in the print', async () => {
    const problem = dialog.open(FormDialogComponent, { hasBackdrop: false });
    await settle();
    const button = document.getElementById('footer-save')!.getBoundingClientRect();
    const image = await service.captureScreen();
    const ratio = (await pixelAt(image!, 0, 0)).width / window.innerWidth;
    // The footer uses backdrop-filter, which html2canvas would otherwise drop entirely.
    const pixel = await pixelAt(
      image!,
      (button.left + button.width / 2) * ratio,
      (button.top + 3) * ratio,
    );
    expect(pixel.g).toBeGreaterThan(150);
    expect(problem).toBeTruthy();
  });

  it('crops the print to the window the report came from', async () => {
    const problem = dialog.open(RedDialogComponent, { hasBackdrop: false });
    await settle();
    const pane = paneOf(problem);
    const rect = pane.getBoundingClientRect();
    (service as unknown as { originElement: WeakRef<HTMLElement> }).originElement = new WeakRef(
      pane,
    );
    expect(service.hasOriginWindow()).toBeTrue();

    const image = await service.captureScreen('window');
    const center = await pixelAt(image!, 0, 0);
    const ratio = center.width / rect.width;
    expect(center.width).toBeLessThan(window.innerWidth * ratio);
    const middle = await pixelAt(image!, center.width / 2, center.height / 2);
    expect(middle.r).toBeGreaterThan(150);
  });
});

describe('prepareCloneForCapture', () => {
  it('turns floating labels into plain text and removes backdrop filters', () => {
    const host = document.createElement('div');
    host.innerHTML = `<label class="mdc-floating-label" style="position: fixed; top: 10px; left: 10px">Status</label>`;
    document.body.appendChild(host);
    try {
      prepareCloneForCapture(document);
      const label = host.querySelector('label')!;
      expect(label.style.visibility).toBe('hidden');
      const copy = Array.from(document.body.querySelectorAll('span')).find(
        (span) => span.textContent === 'Status' && span.style.position === 'fixed',
      );
      expect(copy).toBeTruthy();
      copy?.remove();
    } finally {
      host.remove();
      document.head.lastElementChild?.remove();
    }
  });
});

describe('maskSensitiveContent', () => {
  it('hides revealed passwords, marked textareas and credential autocomplete fields', () => {
    const doc = document.implementation.createHTMLDocument('clone');
    doc.body.innerHTML = `
      <input id="revealed" type="text" data-report-mask value="hunter2" />
      <textarea id="token" data-report-mask>tok_live_123</textarea>
      <input id="otp" autocomplete="one-time-code" value="123456" />
      <input id="plain" value="visible" />`;
    (doc.getElementById('token') as HTMLTextAreaElement).value = 'tok_live_123';
    maskSensitiveContent(doc);
    expect((doc.getElementById('revealed') as HTMLInputElement).value).toBe('••••••');
    expect((doc.getElementById('token') as HTMLTextAreaElement).value).toBe('••••••');
    expect(doc.getElementById('token')!.textContent).toBe('••••••');
    expect((doc.getElementById('otp') as HTMLInputElement).value).toBe('••••••');
    expect((doc.getElementById('plain') as HTMLInputElement).value).toBe('visible');
  });
});
