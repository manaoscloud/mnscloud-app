import { effect, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslocoService } from '@jsverse/transloco';
import { AppI18nService } from './app-i18n.service';

@Injectable()
export class PaginatorIntlService extends MatPaginatorIntl {
  private readonly i18n = inject(AppI18nService);
  private readonly translationEvent = toSignal(inject(TranslocoService).events$);
  constructor() {
    super();
    effect(() => {
      this.i18n.language();
      this.translationEvent();
      this.itemsPerPageLabel = this.i18n.t('Items per page');
      this.nextPageLabel = this.i18n.t('Next page');
      this.previousPageLabel = this.i18n.t('Previous page');
      this.firstPageLabel = this.i18n.t('First page');
      this.lastPageLabel = this.i18n.t('Last page');
      this.changes.next();
    });
  }
  override getRangeLabel = (page: number, size: number, length: number): string => {
    const total = Math.max(0, length);
    const start = !total || !size ? 0 : page * size + 1;
    const end = Math.min(total, (page + 1) * size);
    return this.i18n.t('Page range', { start, end, total });
  };
}
