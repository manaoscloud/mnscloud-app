import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from '../../services/i18n.service';

@Pipe({
  name: 't',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: string): string {
    this.i18n.language();
    return this.i18n.t(key);
  }
}
