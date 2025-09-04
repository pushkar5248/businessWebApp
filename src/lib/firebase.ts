
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "adhunik-invoicer",
  appId: "1:376988209658:web:4ca6c9f19f00f8a969d443",
  storageBucket: "adhunik-invoicer.firebasestorage.app",
  apiKey: "AIzaSyB2y_6tyKy9So4L6NZjTj3CiZPjuiVEgeo",
  authDomain: "adhunik-invoicer.firebaseapp.com",
  measurementId: "",
  messagingSenderId: "376988209658",
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
