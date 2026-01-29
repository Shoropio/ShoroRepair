/**
 * Platform detection and exports
 */
import { Capacitor } from '@capacitor/core';

export const isWeb = !Capacitor.isNativePlatform();
export const isCapacitor = Capacitor.isNativePlatform();
export const isTauri = window.__TAURI__ !== undefined;

export * from './web';
export * from './capacitor';
export * from './tauri';
