import { trigger, transition, style, animate, state, keyframes } from '@angular/animations';

export const fadeAnimation = trigger('fadeAnimation', [
    transition(':enter', [
        style({ opacity: 0, transform: 'scaleY(0)' }),
        animate('250ms', style({ opacity: 1, transform: 'scaleY(1)' }))
    ]),
    transition(':leave', [
        style({ opacity: 1, transform: 'scaleY(1)' }),
        animate('250ms', style({ opacity: 0, transform: 'scaleY(0)' }))
    ])
]);

export const smoothOpacity = trigger('smoothOpacity', [
    transition(':enter', [style({ opacity: 0 }), animate('125ms', style({ opacity: 1 }))]),
    transition(':leave', [style({ opacity: 1 }), animate('125ms', style({ opacity: 0 }))])
]);

export const visible = trigger('visible', [
    state('true', style({ 'animation-fill-mode': 'forwards', opacity: 1 })),
    state('false', style({ 'animation-fill-mode': 'forwards', opacity: 0 })),
    transition(
        '* => false',
        animate('0.25s', keyframes([style({ opacity: 1 }), style({ opacity: 0 })]))
    ),
    transition(
        '* => true',
        animate('0.25s', keyframes([style({ opacity: 0 }), style({ opacity: 1 })]))
    )
]);
