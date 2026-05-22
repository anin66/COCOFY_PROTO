import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc } from "firebase/firestore";

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
  console.log("Updating role of user SQRRP3gWrPZ6P67PonHX1LgUmK23 to 'finance'...");
  await updateDoc(doc(db, "users", "SQRRP3gWrPZ6P67PonHX1LgUmK23"), {
    role: "finance"
  });
  console.log("User SQRRP3gWrPZ6P67PonHX1LgUmK23 updated to 'finance' successfully!");
}

run().catch(console.error);
