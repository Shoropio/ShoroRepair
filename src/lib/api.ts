/**
 * API wrapper
 */

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = {
    get: async (endpoint: string) => {
        const res = await fetch(`${BASE_URL}${endpoint}`);
        return res.json();
    },
    post: async (endpoint: string, data: any) => {
        const res = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    }
};
