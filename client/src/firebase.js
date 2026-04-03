import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyARWEfu5oYzO8Np56zIyIXU6BbRg9Jblw8",
  authDomain: "womensafety-57ada.firebaseapp.com",
  projectId: "womensafety-57ada",
  storageBucket: "womensafety-57ada.firebasestorage.app",
  messagingSenderId: "256494940289",
  appId: "1:256494940289:web:5bb6c6a0a81389c4769d80",
  measurementId: "G-N45W8H1CXM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
