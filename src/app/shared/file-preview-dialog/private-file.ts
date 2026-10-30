import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../services/api.service';
import { openImagePreview } from './file-preview-dialog';

/**
 * Opens a private file. Images (screenshots, report images) open in an in-App preview dialog;
 * other files open in a new tab, opened synchronously so popup blockers allow it.
 */
export async function openPrivateFile(
  api: ApiService,
  endpoint: string,
  preview?: { dialog: MatDialog; contentType: string; fileName: string },
): Promise<void> {
  if (preview && preview.contentType.toLowerCase().startsWith('image/')) {
    try {
      openImagePreview(preview.dialog, await api.getBlob(endpoint), preview.fileName);
    } catch {
      /* the API error toast already explains the failure */
    }
    return;
  }
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;
  try {
    const blob = await api.getBlob(endpoint);
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    tab?.close();
  }
}
