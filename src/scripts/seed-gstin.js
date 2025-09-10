
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });
const { initializeApp } = require("firebase/app");
const { getFirestore, doc, setDoc } = require("firebase/firestore");

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const gstinData = {
  '09AGZPA5852F1Z0': {
    businessName: 'Adhunik Marbles',
    businessAddress: 'KUNDAN BHAWAN, ROHTA, GWALIOR ROAD, AGRA, Agra, Uttar Pradesh, 282001',
  },
};

async function seedGstinData() {
  console.log('Starting to seed GSTIN data into Firestore...');

  try {
    const promises = Object.entries(gstinData).map(([gstin, data]) => {
      const docRef = doc(db, 'gstin_data', gstin);
      console.log(`Setting data for GSTIN: ${gstin}`);
      return setDoc(docRef, data);
    });

    await Promise.all(promises);

    console.log('**********************************************');
    console.log('GSTIN data seeding completed successfully!');
    console.log('**********************************************');
    // Exit gracefully
    process.exit(0);
  } catch (error) {
    console.error('Error seeding GSTIN data:', error);
    process.exit(1);
  }
}

// Timeout to allow for Firestore connection to establish in some environments.
setTimeout(() => {
    seedGstinData().catch(e => {
        console.error("Seeding script failed:", e);
        process.exit(1);
    });
}, 3000);

// Failsafe exit
setTimeout(() => {
    console.log("Seeding script timed out.");
    process.exit(1);
}, 15000);
