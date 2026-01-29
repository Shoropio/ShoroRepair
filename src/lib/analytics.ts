import { analytics } from '../firebase/firebase';
import { logEvent } from 'firebase/analytics';

export const Analytics = {
    logEvent: (eventName: string, params?: any) => {
        logEvent(analytics, eventName, params);
    }
};
