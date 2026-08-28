/**
 * Tauri Platform Implementation
 */

declare global {
    interface Window {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        __TAURI__?: any;
    }
}

export const initializeTauri = () => {
    if (window.__TAURI__) {
        console.log('Initializing Tauri Platform');
        // Add tauri-specific initialization here
    }
};
