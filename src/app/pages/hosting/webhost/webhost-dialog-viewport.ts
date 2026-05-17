import type { MatDialogRef } from '@angular/material/dialog';

export function getWebhostDialogViewportConfig() {
  if (window.innerWidth <= 900) {
    return {
      width: 'calc(100vw - 24px)',
      maxWidth: 'calc(100vw - 24px)',
      height: 'calc(100dvh - 24px)',
      maxHeight: 'calc(100dvh - 24px)',
      position: { left: '12px', top: '12px' },
    };
  }

  const pageContent = document.querySelector('.page-content') as HTMLElement | null;
  if (!pageContent) {
    return {
      width: 'min(1280px, calc(100vw - 1.5rem))',
      maxWidth: '99vw',
      maxHeight: '95vh',
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

export function updateWebhostDialogViewport(dialogRef: MatDialogRef<unknown>) {
  const config = getWebhostDialogViewportConfig();
  const width = typeof config.width === 'string' ? config.width : '';
  const height =
    typeof config.height === 'string'
      ? config.height
      : typeof config.maxHeight === 'string'
        ? config.maxHeight
        : '';

  dialogRef.updateSize(width, height);
  if (config.position) {
    dialogRef.updatePosition(config.position);
  } else {
    dialogRef.updatePosition();
  }
}
