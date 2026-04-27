import { getMessaging } from 'firebase/messaging';
import app from './firebase';

export const messaging = async () => {
    try {
        if (!app) return null;
        return getMessaging(app);
    } catch (e) {
        console.warn('Firebase Messaging not supported');
        return null;
    }
}
