import { Injectable, inject } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MatDialog } from '@angular/material/dialog';

@Injectable({ providedIn: 'root' })
export class SessionUiCleanupService {
  private readonly dialog = inject(MatDialog);
  private readonly overlayContainer = inject(OverlayContainer);

  closeSessionUi() {
    this.dialog.closeAll();

    const container = this.overlayContainer.getContainerElement();
    for (const child of Array.from(container.children)) {
      child.remove();
    }
  }
}
