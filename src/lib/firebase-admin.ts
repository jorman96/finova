import * as admin from "firebase-admin";

if (!admin.apps.length) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;
  if (emulator && !projectId?.startsWith("demo-")) throw new Error("Los emuladores de verificación requieren un proyecto demo.");
  const email = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  admin.initializeApp({
    projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    ...(emulator ? {} : { credential: email && privateKey ? admin.credential.cert({ projectId, clientEmail: email, privateKey }) : admin.credential.applicationDefault() }),
  });
}
export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
