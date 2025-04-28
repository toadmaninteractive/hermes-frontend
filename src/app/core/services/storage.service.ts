import { Injectable } from '@angular/core';
import { Constants } from '../../shared/constants/constants';

@Injectable({
    providedIn: 'root'
})
export class StorageService {
    constructor() {}

    getStoredRoute(): string | null {
        return localStorage.getItem(Constants.storedRouteKey) || null;
    }

    setStoredRoute(url: string): void {
        localStorage.setItem(Constants.storedRouteKey, url);
    }

    resetStoredRoute(): void {
        localStorage.removeItem(Constants.storedRouteKey);
    }

    getStoredConfig(username: string): string | null {
        return localStorage.getItem(username);
    }

    setStoredConfig(username: string, config: string): void {
        localStorage.setItem(username, config);
    }

    getClipboardValue(): string {
        return localStorage.getItem('clipboardValue');
    }

    setClipboardValue(value: string): void {
        localStorage.setItem('clipboardValue', value);
    }

    getTheme(): 'dark' | 'light' | null {
        return localStorage.getItem('theme') as 'dark' | 'light' | null;
    }

    setTheme(value: 'dark' | 'light' | null): void {
        if (value === null) {
            localStorage.removeItem('theme');
            return;
        }
        localStorage.setItem('theme', value);
    }
}
