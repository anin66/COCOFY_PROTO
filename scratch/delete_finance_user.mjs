import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";

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
  console.log("Searching for user with email 'finance@gmail.com'...");
  const q = query(collection(db, "users"), where("email", "==", "finance@gmail.com"));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    console.log("No user found with email 'finance@gmail.com'.");
    return;
  }
  
  for (const document of querySnapshot.docs) {
    console.log(`Found user: ${document.id} =>`, document.data());
    console.log("Deleting user document from Firestore...");
    await deleteDoc(doc(db, "users", document.id));
    console.log("User document deleted successfully!");
  }
}

run().catch(console.error);
