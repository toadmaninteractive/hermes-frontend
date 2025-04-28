import { inject, Injectable } from '@angular/core';
import { StorageService } from './storage.service';

const ATTRIBUTE_NAME = 'data-bs-theme';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    private readonly storageService = inject(StorageService);

    applyStoredTheme() {
        const savedTheme = this.storageService.getTheme();
        if (savedTheme) {
            this.setTheme(savedTheme);
        } else {
            // Check system theme preferences
            const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.setTheme(prefersDarkScheme ? 'dark' : 'light');
        }
    }

    get currentTheme() {
        return document.body.getAttribute(ATTRIBUTE_NAME);
    }

    private setTheme(theme: 'light' | 'dark') {
        document.body.setAttribute(ATTRIBUTE_NAME, theme);
        this.storageService.setTheme(theme);
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }
}
