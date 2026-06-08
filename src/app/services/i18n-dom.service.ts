import { Injectable, Injector, effect, inject } from '@angular/core';
import { I18nService } from './i18n.service';

@Injectable({ providedIn: 'root' })
export class I18nDomService {
  private readonly i18n = inject(I18nService);
  private readonly injector = inject(Injector);

  private observer: MutationObserver | null = null;
  private initialized = false;
  private applying = false;

  init() {
    if (this.initialized || typeof document === 'undefined') return;
    this.initialized = true;

    this.translateSubtree(document.body);

    effect(
      () => {
        this.i18n.language();
        this.translateSubtree(document.body);
      },
      { injector: this.injector },
    );

    this.observer = new MutationObserver((mutations) => {
      if (this.applying) return;

      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          this.translateNode(mutation.target);
          continue;
        }

        if (mutation.type !== 'childList') continue;
        for (const node of mutation.addedNodes) {
          this.translateNode(node);
          this.translateNodeSoon(node);
        }
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  private translateNode(node: Node) {
    if (node instanceof Text) {
      this.translateTextNode(node);
      return;
    }

    if (node instanceof HTMLElement) {
      this.translateSubtree(node);
    }
  }

  private translateNodeSoon(node: Node) {
    const translate = () => this.translateNode(node);

    queueMicrotask(translate);

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(translate);
    } else {
      setTimeout(translate, 0);
    }
  }

  private translateSubtree(root: HTMLElement | null) {
    if (!root) return;

    this.applying = true;
    try {
      this.translateElementAttributes(root);

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let textNode = walker.nextNode();
      while (textNode) {
        if (textNode instanceof Text) {
          this.translateTextNode(textNode);
        }
        textNode = walker.nextNode();
      }

      root.querySelectorAll<HTMLElement>('*').forEach((element) => {
        this.translateElementAttributes(element);
      });
    } finally {
      this.applying = false;
    }
  }

  private translateTextNode(textNode: Text) {
    if (!textNode.data.trim()) return;

    const parent = textNode.parentElement;
    if (!parent || this.shouldSkipElement(parent)) return;

    const translated = this.i18n.translateLiteral(textNode.data);
    if (translated !== textNode.data) {
      textNode.data = translated;
    }
  }

  private translateElementAttributes(element: HTMLElement) {
    if (this.shouldSkipElement(element)) return;

    this.translateAttribute(element, 'placeholder');
    this.translateAttribute(element, 'title');
    this.translateAttribute(element, 'aria-label');
  }

  private translateAttribute(element: HTMLElement, attribute: string) {
    const raw = element.getAttribute(attribute);
    if (!raw) return;

    const translated = this.i18n.translateLiteral(raw);
    if (translated !== raw) {
      element.setAttribute(attribute, translated);
    }
  }

  private shouldSkipElement(element: HTMLElement): boolean {
    if (element.closest('[data-no-translate]')) return true;

    return !!element.closest(
      [
        'mat-icon',
        '.material-icons',
        '.material-symbols-outlined',
        'code',
        'pre',
        'script',
        'style',
        'noscript',
      ].join(','),
    );
  }
}
