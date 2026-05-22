import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAAeC7_aNrMBsaoBYNZs9jnQvpCc9x04kU",
  authDomain: "cocofy-f3cab.firebaseapp.com",
  projectId: "cocofy-f3cab",
  storageBucket: "cocofy-f3cab.appspot.com", // alternative
  messagingSenderId: "33629571209",
  appId: "1:33629571209:web:c9b9e37aab0ba91bdd1e58",
};

async function testBucket() {
  try {
    const app = initializeApp(firebaseConfig);
    const storage = getStorage(app);
    const testRef = ref(storage, "test_connection_dummy.txt");
    const dummyData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    
    console.log("Uploading to alternative...");
    await uploadBytes(testRef, dummyData);
    console.log("Upload succeeded!");
  } catch (err) {
    console.error("FULL ERROR DETAILS:");
    console.error(err);
    if (err.customData) {
      console.error("Custom Data:", err.customData);
    }
  }
}

testBucket();
