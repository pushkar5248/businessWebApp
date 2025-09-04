
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

// Initialize Firebase for client-side if not already initialized
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

export { app, auth, db };
