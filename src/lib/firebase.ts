import { getApp,getApps,initializeApp } from "firebase/app";
import { connectAuthEmulator,getAuth } from "firebase/auth";
import { connectFirestoreEmulator,getFirestore } from "firebase/firestore";
import { connectStorageEmulator,getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Non-production app environments must use an isolated Firebase project.
if (["preview", "development"].includes(process.env.NEXT_PUBLIC_FINOVA_ENV || "") && firebaseConfig.projectId === "finova-3b91d") {
  throw new Error("Usa un proyecto Firebase de pruebas o los emuladores. Este entorno no puede conectarse a producción.");
}

// Initialize Firebase for Client-side
const firstInitialization = getApps().length === 0;
const app = firstInitialization ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
if (firstInitialization && process.env.NEXT_PUBLIC_USE_EMULATORS === "true") {
  if (!firebaseConfig.projectId?.startsWith("demo-")) throw new Error("Los emuladores requieren un proyecto demo.");
  connectAuthEmulator(auth, "http://127.0.0.1:9098", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8088);
  connectStorageEmulator(storage, "127.0.0.1", 9198);
}

export { app,auth,db,storage };
