import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, writeBatch, Timestamp } from "firebase/firestore";

// Your exact config
import 'dotenv/config'; // Loads the .env file

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function deleteBeforeFeb13() {
  // Set the exact cutoff date
  const cutoffDate = new Date("2026-02-13T00:00:00Z");
  const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

  // NOTE: Change "messages" if your collection has a different name
  const messagesRef = collection(db, "messages"); 
  
  // Query for messages where CreatedAt is BEFORE our cutoff timestamp
  const q = query(messagesRef, where("createdAt", "<", cutoffTimestamp));

  try {
    console.log("Fetching messages before Feb 13, 2026...");
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log("No messages found before that date. Your database is clean!");
      process.exit(0);
    }

    console.log(`Found ${snapshot.size} messages. Deleting now...`);

    // Firestore has a limit of 500 operations per batch. 
    // This loop handles chunking them safely if you have more than 500.
    let batch = writeBatch(db);
    let count = 0;

    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      count++;

      // Commit the batch every 500 documents
      if (count % 500 === 0) {
        await batch.commit();
        batch = writeBatch(db); // Start a fresh batch
      }
    }

    // Commit any leftovers that didn't hit the 500 mark
    if (count % 500 !== 0) {
      await batch.commit();
    }

    console.log(`Success! Deleted ${count} old messages.`);
    process.exit(0);

  } catch (error) {
    console.error("\n❌ Error deleting messages:");
    console.error(error.message);
    
    if (error.message.includes("permissions")) {
       console.log("\n💡 This means your Firestore Security Rules blocked the deletion. You will need to use the Admin SDK instead.");
    }
    process.exit(1);
  }
}

deleteBeforeFeb13();
