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

// ─── CÓDIGOS DE SEGUIMIENTO DB ────────────────────────────────────────────────
// Persiste los códigos personalizados que el usuario agrega manualmente.
// Estructura: { code: string, apellido: string, createdAt }

export const codigosDB = {
  isActive: () => isFirebaseActive,

  /**
   * Suscribirse a la lista de códigos guardados en tiempo real.
   * @param {(codigos: Array) => void} callback
   * @returns {() => void} unsubscribe
   */
  subscribe: (callback) => {
    if (isFirebaseActive) {
      const q = query(
        collection(db, "codigos"),
        orderBy("createdAt", "desc")
      );
      return onSnapshot(q, (snap) => {
        const codigos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(codigos);
      });
    } else {
      const LS_KEY = 'telesalud_codigos';
      const load = () => {
        try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
        catch { return []; }
      };
      callback(load());
      const handler = (e) => {
        if (e.key === LS_KEY) callback(JSON.parse(e.newValue || '[]'));
      };
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    }
  },

  /** Guardar un nuevo código { code, apellido } */
  add: async ({ code, apellido }) => {
    if (isFirebaseActive) {
      await addDoc(collection(db, "codigos"), {
        code, apellido, createdAt: serverTimestamp()
      });
    } else {
      const LS_KEY = 'telesalud_codigos';
      const existing = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      const updated = [{ id: Date.now().toString(), code, apellido, createdAt: new Date().toISOString() }, ...existing];
      localStorage.setItem(LS_KEY, JSON.stringify(updated));
      window.dispatchEvent(new StorageEvent('storage', { key: LS_KEY, newValue: JSON.stringify(updated) }));
    }
  },

  /** Eliminar un código por su ID */
  delete: async (id) => {
    if (isFirebaseActive) {
      await deleteDoc(doc(db, "codigos", id));
    } else {
      const LS_KEY = 'telesalud_codigos';
      const existing = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      const updated = existing.filter(c => c.id !== id);
      localStorage.setItem(LS_KEY, JSON.stringify(updated));
      window.dispatchEvent(new StorageEvent('storage', { key: LS_KEY, newValue: JSON.stringify(updated) }));
    }
  }
};
