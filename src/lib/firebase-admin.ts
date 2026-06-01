import * as admin from 'firebase-admin';

import serviceAccount from './service-account.json';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as any),
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

const adminDb = admin.firestore();
const adminAuth = admin.auth();

export { adminDb, adminAuth };
