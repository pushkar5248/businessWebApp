
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "adhunik-invoicer",
  appId: "1:376988209658:web:4ca6c9f19f00f8a969d443",
  storageBucket: "adhunik-invoicer.firebasestorage.app",
  apiKey: "AIzaSyB2y_6tyKy9So4L6NZjTj3CiZPjuiVEgeo",
  authDomain: "adhunik-invoicer.firebaseapp.com",
  measurementId: "",
  messagingSenderId: "376988209658",
};

// Initialize Firebase for client-side
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (typeof window !== 'undefined' && !getApps().length) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} else if (getApps().length) {
    app = getApp();
    auth = getAuth(app);
    db = getFirestore(app);
} else {
    // This is for server-side rendering, though we primarily need client-side for auth UI
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
}

export { app, auth, db };
