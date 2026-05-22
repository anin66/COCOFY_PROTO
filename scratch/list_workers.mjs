import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAAeC7_aNrMBsaoBYNZs9jnQvpCc9x04kU",
  authDomain: "cocofy-f3cab.firebaseapp.com",
  projectId: "cocofy-f3cab",
  storageBucket: "cocofy-f3cab.firebasestorage.app",
  messagingSenderId: "33629571209",
  appId: "1:33629571209:web:c9b9e37aab0ba91bdd1e58",
  measurementId: "G-ZX9JCGRGK1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  // Find users with role 'worker' that have the wrong name
  console.log("Fetching all workers...");
  const q = query(collection(db, "users"), where("role", "==", "worker"));
  const snap = await getDocs(q);

  snap.forEach((d) => {
    console.log(`uid: ${d.id} | name: ${d.data().name} | email: ${d.data().email}`);
  });
}

run().catch(console.error);
