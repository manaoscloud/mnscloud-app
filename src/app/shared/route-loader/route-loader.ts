import { Component, signal } from '@angular/core';

import {
    trigger,
    style,
    animate,
    transition,
} from '@angular/animations';

@Component({
    selector: 'app-route-loader',
    standalone: true,
    imports: [],
    templateUrl: './route-loader.html',
    styleUrls: ['./route-loader.scss'],
    animations: [
        trigger('fadeInOut', [
            transition(':enter', [
                style({ opacity: 0 }),
                animate('200ms ease-out', style({ opacity: 1 })),
            ]),
            transition(':leave', [
                animate('200ms ease-in', style({ opacity: 0 })),
            ]),
        ]),
    ],
})
export class RouteLoader {
    visible = signal(false);

    show() {
        this.visible.set(true);
    }

    hide() {
        this.visible.set(false);
    }
}