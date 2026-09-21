// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDEvCvXMyL4sZr5d-3avMP7BMOkHHA-71A",
    authDomain: "checklis-237cf.firebaseapp.com",
    projectId: "checklis-237cf",
    storageBucket: "checklis-237cf.firebasestorage.app",
    messagingSenderId: "759905183203",
    appId: "1:759905183203:web:bc9e0efb831ccb6e66acd6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };
export default app;