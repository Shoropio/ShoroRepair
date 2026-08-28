import { getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import app from './firebase';

export const firestore: Firestore | null = app ? getFirestore(app) : null;
