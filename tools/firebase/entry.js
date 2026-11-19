// The parts of the Firebase SDK the app uses, bundled into vendor/firebase.js as window.FB.
export { initializeApp } from 'firebase/app';
export {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, connectAuthEmulator, onAuthStateChanged,
  signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut,
} from 'firebase/auth';
export {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache, connectFirestoreEmulator,
  doc, collection, query, where, orderBy, limit, getDoc, getDocs, getDocFromServer, setDoc, updateDoc, deleteDoc, onSnapshot,
  writeBatch, FieldPath, Bytes, terminate, clearIndexedDbPersistence,
} from 'firebase/firestore';
