
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

// This script is for one-time use to seed the database.
// It will be removed after execution.

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
    process.exit(0);
  } catch (error) {
    console.error('Error seeding GSTIN data:', error);
    process.exit(1);
  }
}

// Running a timeout to ensure firebase connection is established
setTimeout(() => {
    seedGstinData();
}, 5000);

