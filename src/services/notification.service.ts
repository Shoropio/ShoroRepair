import { messaging } from '../firebase/messaging';
import { getToken, onMessage } from 'firebase/messaging';

export const NotificationService = {
    requestPermission: async () => {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const msg = await messaging();
                if (msg) {
                    const token = await getToken(msg, { vapidKey: import.meta.env.VITE_VAPID_KEY });
                    return token;
                }
            }
            return null;
        } catch (error) {
            console.error("Notification permission error", error);
            return null;
        }
    },

    onMessage: async (callback: (payload: any) => void) => {
        const msg = await messaging();
        if (msg) {
            onMessage(msg, callback);
        }
    }
};
