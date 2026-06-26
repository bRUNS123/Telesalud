import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  collection,
  doc,
  onSnapshot,
  addDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let db = null;
let isFirebaseActive = false;

if (firebaseConfig.apiKey && firebaseConfig.apiKey !== 'tu-api-key') {
  try {
    const app = initializeApp(firebaseConfig);
    db = initializeFirestore(app, {
      localCache: persistentLocalCache()
    });
    isFirebaseActive = true;
    console.log("🔥 Firebase Telesalud inicializado con persistencia offline.");
  } catch (error) {
    console.error("Error al inicializar Firebase:", error);
  }
} else {
  console.log("📁 Firebase no configurado — usando localStorage como respaldo.");
}

// ─── CITAS DB ─────────────────────────────────────────────────────────────────
// Abstrae Firestore (nube, tiempo real) o localStorage (local, sin cuenta).

export const citasDB = {
  isActive: () => isFirebaseActive,

  /**
   * Suscribirse a la lista de citas en tiempo real.
   * @param {(citas: Array) => void} callback - Se llama cada vez que cambian los datos
   * @returns {() => void} unsubscribe function
   */
  subscribe: (callback) => {
    if (isFirebaseActive) {
      const q = query(
        collection(db, "citas"),
        orderBy("createdAt", "desc")
      );
      return onSnapshot(q, (snap) => {
        const citas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(citas);
      });
    } else {
      // Modo localStorage
      const load = () => {
        try {
          return JSON.parse(localStorage.getItem('telesalud_citas') || '[]');
        } catch { return []; }
      };
      callback(load());
      const handleStorage = (e) => {
        if (e.key === 'telesalud_citas') callback(JSON.parse(e.newValue || '[]'));
      };
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
    }
  },

  /**
   * Agregar una nueva cita.
   * @param {Object} cita - { area, fecha, hora, centro, nota }
   */
  add: async (cita) => {
    if (isFirebaseActive) {
      await addDoc(collection(db, "citas"), {
        ...cita,
        createdAt: serverTimestamp()
      });
    } else {
      const existing = JSON.parse(localStorage.getItem('telesalud_citas') || '[]');
      const updated = [{ ...cita, id: Date.now().toString(), createdAt: new Date().toISOString() }, ...existing];
      localStorage.setItem('telesalud_citas', JSON.stringify(updated));
      window.dispatchEvent(new StorageEvent('storage', { key: 'telesalud_citas', newValue: JSON.stringify(updated) }));
    }
  },

  /**
   * Eliminar una cita por ID.
   * @param {string} id - Firestore doc ID o timestamp string
   */
  delete: async (id) => {
    if (isFirebaseActive) {
      await deleteDoc(doc(db, "citas", id));
    } else {
      const existing = JSON.parse(localStorage.getItem('telesalud_citas') || '[]');
      const updated = existing.filter(c => c.id !== id);
      localStorage.setItem('telesalud_citas', JSON.stringify(updated));
      window.dispatchEvent(new StorageEvent('storage', { key: 'telesalud_citas', newValue: JSON.stringify(updated) }));
    }
  }
};
