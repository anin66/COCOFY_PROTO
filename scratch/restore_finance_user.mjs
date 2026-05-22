import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

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
  console.log("Restoring user SQRRP3gWrPZ6P67PonHX1LgUmK23...");
  await setDoc(doc(db, "users", "SQRRP3gWrPZ6P67PonHX1LgUmK23"), {
    phone: '875978234',
    email: 'finance@gmail.com',
    createdAt: '2026-05-20T12:06:19.963Z',
    dob: '2026-05-21',
    name: 'finance',
    role: 'worker',
    uid: 'SQRRP3gWrPZ6P67PonHX1LgUmK23'
  });
  console.log("User SQRRP3gWrPZ6P67PonHX1LgUmK23 restored successfully!");
}

run().catch(console.error);
