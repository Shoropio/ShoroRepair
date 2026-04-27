import { getFirestore } from 'firebase/firestore';
import app from './firebase';

export const firestore = app ? getFirestore(app) : (null as any);
