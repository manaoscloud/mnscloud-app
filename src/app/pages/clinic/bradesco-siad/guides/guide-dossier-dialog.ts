import { Component, Inject, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { lastValueFrom } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';

type DossierData = { guideUUID: string };
type DocumentItem = {
  uuid: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  documentType: number;
  status: string;
  createdAt: string;
};
type SubmissionItem = {
  uuid: string;
  status: string;
  responseCode: string | null;
  responseMessage: string | null;
  createdAt: string;
  finishedAt: string | null;
};
type DossierResponse = {
  data: {
    item: { protocol: string; guideNumber: string; status: string };
    documents: DocumentItem[];
    submissions: SubmissionItem[];
  };
};

@Component({
  selector: 'app-clinic-bradesco-siad-guide-dossier-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressBarModule,
    MatChipsModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  template: `
    <div class="crud-dialog">
      <div class="dialog-header">
        <div>
          <h2>{{ 'siad.dossier.title' | transloco }}</h2>
          <p>{{ 'siad.dossier.description' | transloco }}</p>
        </div>
      </div>
      <div class="dialog-content">
        @if (loading()) {
          <mat-progress-bar mode="indeterminate" />
        }
        @if (dossier(); as current) {
          <div class="siad-summary">
            <strong>{{ 'siad.field.protocol' | transloco }} {{ current.item.protocol }}</strong
            ><span>{{ 'siad.dossier.guide' | transloco }} {{ current.item.guideNumber }}</span
            ><span>{{ 'siad.status.' + current.item.status | transloco }}</span>
          </div>
          <section class="siad-section">
            <div class="section-heading">
              <h3>{{ 'siad.field.documents' | transloco }}</h3>
              <label class="upload-button"
                ><input
                  type="file"
                  multiple
                  accept="application/pdf,image/tiff,image/jpeg,image/png"
                  (change)="upload($event)"
                /><mat-icon>upload_file</mat-icon>{{ 'siad.dossier.addFiles' | transloco }}</label
              >
            </div>
            <p class="hint">{{ 'siad.dossier.fileHint' | transloco }}</p>
            @if (!current.documents.length) {
              <p class="empty">{{ 'siad.dossier.noDocuments' | transloco }}</p>
            }
            @for (document of current.documents; track document.uuid) {
              <div class="document-row">
                <span>{{ document.filename }}</span
                ><span>{{ formatBytes(document.sizeBytes) }}</span
                ><span>{{ document.status }}</span
                ><button
                  mat-icon-button
                  type="button"
                  [matTooltip]="'siad.dossier.openDocument' | transloco"
                  (click)="openDocument(document)"
                >
                  <mat-icon>visibility</mat-icon>
                </button>
              </div>
            }
          </section>
          <section class="siad-section">
            <div class="section-heading">
              <h3>{{ 'siad.dossier.submissions' | transloco }}</h3>
              <button
                mat-flat-button
                color="primary"
                type="button"
                [disabled]="loading() || !current.documents.length"
                (click)="submit()"
              >
                <mat-icon>send</mat-icon>{{ 'siad.dossier.submit' | transloco }}
              </button>
            </div>
            @if (!current.submissions.length) {
              <p class="empty">{{ 'siad.dossier.noSubmissions' | transloco }}</p>
            }
            @for (submission of current.submissions; track submission.uuid) {
              <div class="submission-row">
                <span>{{ submission.createdAt }}</span
                ><span class="status-pill">{{
                  'siad.status.' + submission.status | transloco
                }}</span
                ><span>{{ submission.responseMessage || '-' }}</span>
              </div>
            }
          </section>
        }
      </div>
      <div class="form-actions">
        <div class="secondary-actions">
          <button mat-stroked-button color="primary" type="button" (click)="close()">
            {{ 'Close' | transloco }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .siad-summary,
      .document-row,
      .submission-row {
        display: grid;
        gap: 12px;
        align-items: center;
      }
      .siad-summary {
        grid-template-columns: 1fr auto auto;
        margin-bottom: 20px;
      }
      .siad-section {
        border-top: 1px solid var(--mns-border, #445);
        padding-top: 16px;
        margin-top: 16px;
      }
      .section-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .section-heading h3 {
        margin: 0;
      }
      .upload-button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        color: var(--mns-primary, #27d8d8);
        font-weight: 600;
      }
      .upload-button input {
        display: none;
      }
      .hint,
      .empty {
        color: var(--mns-text-muted, #b5c0c0);
      }
      .document-row {
        grid-template-columns: 1fr 120px 100px auto;
        border-bottom: 1px solid var(--mns-border, #445);
        padding: 10px 0;
      }
      .submission-row {
        grid-template-columns: 180px 120px 1fr;
        border-bottom: 1px solid var(--mns-border, #445);
        padding: 10px 0;
      }
      .status-pill {
        justify-self: start;
      }
      .form-actions {
        margin-top: 24px;
      }
      @media (max-width: 700px) {
        .siad-summary,
        .document-row,
        .submission-row {
          grid-template-columns: 1fr;
        }
        .section-heading {
          align-items: flex-start;
          flex-direction: column;
        }
        .dialog-content {
          padding-bottom: 16px;
        }
      }
    `,
  ],
})
export class ClinicBradescoSiadGuideDossierDialogComponent {
  private readonly api = inject(ApiService);
  private readonly snack = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);
  private readonly ref = inject(MatDialogRef<ClinicBradescoSiadGuideDossierDialogComponent>);
  readonly loading = signal(false);
  readonly dossier = signal<DossierResponse['data'] | null>(null);

  constructor(@Inject(MAT_DIALOG_DATA) readonly data: DossierData) {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.dossier.set(
        (await this.api.get<DossierResponse>(`clinic/bradesco/siad/guides/${this.data.guideUUID}`))
          .data,
      );
    } catch (error) {
      this.snack.error(this.errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  async upload(event: Event): Promise<void> {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    if (!files.length) return;
    this.loading.set(true);
    try {
      for (const file of files) {
        const form = new FormData();
        form.append('documentType', '1');
        form.append('file', file, file.name);
        await lastValueFrom(
          this.api.postFormWithProgress(
            `clinic/bradesco/siad/guides/${this.data.guideUUID}/documents`,
            form,
          ),
        );
      }
      this.snack.success(this.transloco.translate('siad.dossier.uploaded'));
      await this.load();
    } catch (error) {
      this.snack.error(this.errorMessage(error));
      this.loading.set(false);
    }
  }

  async submit(): Promise<void> {
    this.loading.set(true);
    try {
      await this.api.post(`clinic/bradesco/siad/guides/${this.data.guideUUID}/submit`, {});
      this.snack.success(this.transloco.translate('siad.dossier.queued'));
      await this.load();
    } catch (error) {
      this.snack.error(this.errorMessage(error));
      this.loading.set(false);
    }
  }

  async openDocument(document: DocumentItem): Promise<void> {
    try {
      const blob = await this.api.getBlob(
        `clinic/bradesco/siad/guides/${this.data.guideUUID}/documents/${document.uuid}`,
      );
      window.open(URL.createObjectURL(blob), '_blank', 'noopener');
    } catch (error) {
      this.snack.error(this.errorMessage(error));
    }
  }
  formatBytes(value: number): string {
    return value < 1024 * 1024
      ? `${Math.ceil(value / 1024)} KB`
      : `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  close(): void {
    this.ref.close();
  }
  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'A solicitação SIAD falhou.';
  }
}
