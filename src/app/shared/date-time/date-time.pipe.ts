import { Pipe, PipeTransform, inject } from '@angular/core';

import { DateTimeFormatService } from '../../services/date-time-format.service';

type DateTimeStyle = 'short' | 'medium' | 'long' | 'full';

@Pipe({
  name: 'mnsDateTime',
  standalone: true,
  pure: false,
})
export class MnsDateTimePipe implements PipeTransform {
  private readonly dateTime = inject(DateTimeFormatService);

  transform(
    value: Date | string | number | null | undefined,
    dateStyle: DateTimeStyle = 'short',
    timeStyle: DateTimeStyle = 'medium',
  ): string {
    return this.dateTime.formatDateTime(value, dateStyle, timeStyle) || '-';
  }
}
