/**
 * Generic Storage Wrapper
 * wrappers for localStorage / IndexedDB
 */

export const Storage = {
    get: (key: string) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error(`Error reading ${key} from storage`, e);
            return null;
        }
    },

    set: (key: string, value: any) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error(`Error writing ${key} to storage`, e);
        }
    },

    remove: (key: string) => {
        localStorage.removeItem(key);
    },

    clear: () => {
        localStorage.clear();
    }
};

export default Storage;
