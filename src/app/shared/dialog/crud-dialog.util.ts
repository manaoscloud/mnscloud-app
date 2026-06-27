import { MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';
import { Subscription } from 'rxjs';

import { bindDialogEscape } from './dialog-events.util';

export type CrudDialogBinding = {
  ref: MatDialogRef<unknown>;
  stop: () => void;
};

export type CrudDialogOptions = {
  data?: unknown;
  onEscape?: () => void;
};

function computeDialogLayout(): MatDialogConfig {
  const mobile = window.matchMedia('(max-width: 900px)').matches;
  if (mobile) {
    const spacing = 12;
    const sizeOffset = `${spacing * 2}px`;
    const inset = `${spacing}px`;

    return {
      width: `calc(100vw - ${sizeOffset})`,
      maxWidth: `calc(100vw - ${sizeOffset})`,
      height: `calc(100dvh - ${sizeOffset})`,
      maxHeight: `calc(100dvh - ${sizeOffset})`,
      position: { top: inset, left: inset },
    };
  }

  const pageContent = document.querySelector('.page-content') as HTMLElement | null;
  if (!pageContent) {
    return {
      width: 'min(1280px, calc(100vw - 1.5rem))',
      maxWidth: '99vw',
      maxHeight: '95vh',
      position: {},
    };
  }

  const rect = pageContent.getBoundingClientRect();
  const spacing = 8;
  const widthPx = Math.max(320, Math.floor(rect.width - spacing * 2));
  const maxHeightPx = Math.max(420, Math.floor(rect.height - spacing * 2));

  return {
    width: `${widthPx}px`,
    maxWidth: `${widthPx}px`,
    maxHeight: `${maxHeightPx}px`,
    position: {
      left: `${Math.max(0, Math.floor(rect.left + spacing))}px`,
      top: `${Math.max(0, Math.floor(rect.top + spacing))}px`,
    },
  };
}

export function openCrudTemplateDialog(
  dialog: MatDialog,
  template: any,
  panelClass: string,
  options: CrudDialogOptions = {},
): CrudDialogBinding {
  const initial = computeDialogLayout();
  const ref = dialog.open(template, {
    ...initial,
    disableClose: true,
    autoFocus: false,
    restoreFocus: true,
    panelClass,
    data: options.data,
  });

  let observer: ResizeObserver | null = null;
  let rafId = 0;
  const subscriptions = new Subscription();

  subscriptions.add(
    bindDialogEscape(ref, () => {
      if (options.onEscape) {
        options.onEscape();
      } else {
        ref.close();
      }
    }),
  );

  const updateLayout = () => {
    const config = computeDialogLayout();
    const width = typeof config.width === 'string' ? config.width : '';
    const height =
      typeof config.height === 'string'
        ? config.height
        : typeof config.maxHeight === 'string'
          ? config.maxHeight
          : '';
    ref.updateSize(width, height);
    ref.updatePosition(config.position ?? {});
  };

  const pageContent = document.querySelector('.page-content') as HTMLElement | null;
  if (pageContent && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateLayout);
    });
    observer.observe(pageContent);
  }

  return {
    ref,
    stop: () => {
      subscriptions.unsubscribe();
      if (rafId) cancelAnimationFrame(rafId);
      observer?.disconnect();
      observer = null;
    },
  };
}
