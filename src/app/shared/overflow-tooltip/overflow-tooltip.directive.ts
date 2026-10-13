import { Directive, ElementRef, inject, input } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';

/**
 * Shows the full text in a tooltip only while the host is visually truncated
 * (`text-overflow: ellipsis`). The check runs on pointer enter / focus, before
 * MatTooltip's own mouse handlers, so untruncated cells never show a tooltip.
 */
@Directive({
  selector: '[mnsOverflowTooltip]',
  hostDirectives: [MatTooltip],
  host: {
    '(pointerenter)': 'sync()',
    '(focusin)': 'sync()',
  },
})
export class MnsOverflowTooltipDirective {
  readonly mnsOverflowTooltip = input<string | null | undefined>('');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly tooltip = inject(MatTooltip);

  sync(): void {
    const element = this.host.nativeElement;
    const text = (this.mnsOverflowTooltip() || element.textContent || '').trim();
    const truncated = element.scrollWidth > element.clientWidth + 1;
    this.tooltip.message = truncated ? text : '';
  }
}
