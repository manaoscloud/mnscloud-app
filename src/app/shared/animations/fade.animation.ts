import { trigger, transition, style, animate } from '@angular/animations';

/**
 * Fade suave MD3 (Material You)
 * Ideal para elementos simples: cards, blocos, seções internas.
 */
export const fadeIn = trigger('fadeIn', [
    transition(':enter', [
        style({ opacity: 0, transform: 'translateY(4px)' }),
        animate(
            '220ms cubic-bezier(0.2, 0, 0, 1)',
            style({ opacity: 1, transform: 'translateY(0)' })
        ),
    ]),
]);

/**
 * Fade completo (entrada + saída)
 * Ideal para páginas, router-outlet e grandes containers.
 */
export const fadeInOut = trigger('fadeInOut', [
    transition(':enter', [
        style({ opacity: 0, transform: 'translateY(6px)' }),
        animate(
            '260ms cubic-bezier(0.2, 0, 0, 1)',
            style({ opacity: 1, transform: 'translateY(0)' })
        ),
    ]),

    transition(':leave', [
        animate(
            '180ms cubic-bezier(0.4, 0, 1, 1)',
            style({ opacity: 0, transform: 'translateY(-4px)' })
        ),
    ]),
]);