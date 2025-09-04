
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// --- START DIAGNOSTIC LOGS ---
console.log('=== FIREBASE DEBUG ===');
console.log('Attempting to initialize Firebase...');
console.log('API Key Populated:', !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
console.log('Auth Domain Populated:', !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
console.log('Project ID Populated:', !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
console.log('Raw Config Object:', firebaseConfig);
console.log('======================');
// --- END DIAGNOSTIC LOGS ---


// Initialize Firebase for client-side if not already initialized
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

export { app, auth, db };
