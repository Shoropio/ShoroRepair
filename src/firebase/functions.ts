import { getFunctions } from 'firebase/functions';
import app from './firebase';

export const functions = app ? getFunctions(app) : (null as any);
