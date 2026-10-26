import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as fbSignOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc,
  getDocFromServer,
  collection, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  query, 
  orderBy, 
  where, 
  getDocs 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { User, Package, Invoice, Ticket } from './types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Critical connection test as required by Firebase skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration. Client reported offline.");
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const ADMIN_EMAIL = 'mdshobuj4564@gmail.com';

// Sign in with Google
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const fbUser = result.user;
    const isAdmin = fbUser.email === ADMIN_EMAIL || fbUser.email?.includes('admin');

    const userProfile: User = {
      id: fbUser.uid,
      username: fbUser.email ? fbUser.email.split('@')[0] : 'user',
      full_name: fbUser.displayName || 'Google User',
      email: fbUser.email || '',
      address: 'Online',
      phone: fbUser.phoneNumber || '',
      package_name: 'Standard 10Mbps',
      price: 500,
      status: 'active',
      expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      role: isAdmin ? 'admin' : 'customer',
      created_at: new Date().toISOString()
    };

    // Save/update profile in Firestore
    const userDocRef = doc(db, 'users', fbUser.uid);
    try {
      await setDoc(userDocRef, userProfile, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `users/${fbUser.uid}`);
    }

    if (isAdmin) {
      try {
        await setDoc(doc(db, 'admins', fbUser.uid), {
          email: fbUser.email,
          role: 'admin',
          createdAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `admins/${fbUser.uid}`);
      }
    }

    return userProfile;
  } catch (error) {
    console.error('Google Sign-In failed:', error);
    throw error;
  }
}

// Seed default initial packages if not present in Firestore
export async function seedInitialFirestoreData() {
  if (!auth.currentUser) return;
  const path = 'packages';
  try {
    const snap = await getDocs(collection(db, path));
    if (snap.empty) {
      const defaultPackages = [
        { name: "Standard 10Mbps", price: 500, local_address: "10.0.0.1", remote_address: "pppoe-pool", rate_limit: "10M/10M", created_at: new Date().toISOString() },
        { name: "Premium 20Mbps", price: 800, local_address: "10.0.0.1", remote_address: "pppoe-pool", rate_limit: "20M/20M", created_at: new Date().toISOString() },
        { name: "Ultra 50Mbps", price: 1500, local_address: "10.0.0.1", remote_address: "pppoe-pool", rate_limit: "50M/50M", created_at: new Date().toISOString() }
      ];

      for (const pkg of defaultPackages) {
        await addDoc(collection(db, 'packages'), pkg);
      }
    }
  } catch (e) {
    console.warn("Could not seed packages:", e);
  }
}

// Firestore Realtime Subscriptions
export function subscribeToPackages(onUpdate: (pkgs: Package[]) => void) {
  if (!auth.currentUser) return () => {};
  const path = 'packages';
  return onSnapshot(collection(db, path), (snapshot) => {
    const list: Package[] = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Package, 'id'>)
    }));
    onUpdate(list);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, path);
  });
}

export function subscribeToUsers(onUpdate: (users: User[]) => void) {
  if (!auth.currentUser) return () => {};
  const path = 'users';
  return onSnapshot(collection(db, path), (snapshot) => {
    const list: User[] = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<User, 'id'>)
    }));
    onUpdate(list);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, path);
  });
}

export function subscribeToInvoices(userId: string | null, isAdmin: boolean, onUpdate: (invoices: Invoice[]) => void) {
  if (!auth.currentUser) return () => {};
  const path = 'invoices';
  const colRef = collection(db, path);
  const q = (!isAdmin && userId) ? query(colRef, where('userId', '==', userId)) : colRef;

  return onSnapshot(q, (snapshot) => {
    const list: Invoice[] = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        user_id: data.userId || data.user_id,
        user_name: data.userName || data.user_name,
        amount: data.amount || 0,
        month: data.month || 'Current',
        status: data.status || 'unpaid',
        payment_method: data.paymentMethod || data.payment_method,
        transaction_id: data.transactionId || data.transaction_id,
        created_at: data.createdAt || data.created_at || new Date().toISOString()
      };
    });
    onUpdate(list);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, path);
  });
}

export function subscribeToTickets(userId: string | null, isAdmin: boolean, onUpdate: (tickets: Ticket[]) => void) {
  if (!auth.currentUser) return () => {};
  const path = 'tickets';
  const colRef = collection(db, path);
  const q = (!isAdmin && userId) ? query(colRef, where('userId', '==', userId)) : colRef;

  return onSnapshot(q, (snapshot) => {
    const list: Ticket[] = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        user_id: data.userId || data.user_id,
        user_name: data.userName || data.user_name,
        subject: data.subject || '',
        message: data.message || '',
        status: data.status || 'open',
        created_at: data.createdAt || data.created_at || new Date().toISOString()
      };
    });
    onUpdate(list);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, path);
  });
}

export function subscribeToSettings(onUpdate: (settings: Record<string, string>) => void) {
  if (!auth.currentUser) return () => {};
  const path = 'settings';
  return onSnapshot(collection(db, path), (snapshot) => {
    const map: Record<string, string> = {};
    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (data.key) {
        map[data.key] = data.value;
      }
    });
    onUpdate(map);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, path);
  });
}

// Mutators
export async function createFirestorePackage(pkg: Omit<Package, 'id'>) {
  if (!auth.currentUser) return;
  const path = 'packages';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...pkg,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (e) {
    handleFirestoreError(e, OperationType.CREATE, path);
  }
}

export async function updateFirestorePackage(id: string | number, pkg: Partial<Package>) {
  if (!auth.currentUser) return;
  const path = `packages/${id}`;
  try {
    await updateDoc(doc(db, 'packages', String(id)), pkg);
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, path);
  }
}

export async function deleteFirestorePackage(id: string | number) {
  if (!auth.currentUser) return;
  const path = `packages/${id}`;
  try {
    await deleteDoc(doc(db, 'packages', String(id)));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, path);
  }
}

export async function createFirestoreUser(usr: Partial<User>) {
  if (!auth.currentUser) return;
  const path = 'users';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...usr,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (e) {
    handleFirestoreError(e, OperationType.CREATE, path);
  }
}

export async function updateFirestoreUser(id: string | number, usr: Partial<User>) {
  if (!auth.currentUser) return;
  const path = `users/${id}`;
  try {
    await updateDoc(doc(db, 'users', String(id)), usr);
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, path);
  }
}

export async function updateFirestoreInvoice(id: string | number, data: Partial<Invoice>) {
  if (!auth.currentUser) return;
  const path = `invoices/${id}`;
  try {
    await updateDoc(doc(db, 'invoices', String(id)), {
      status: data.status,
      paymentMethod: data.payment_method,
      transactionId: data.transaction_id,
      updatedAt: new Date().toISOString()
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, path);
  }
}

export async function createFirestoreTicket(tkt: { userId: string | number, userName: string, subject: string, message: string }) {
  if (!auth.currentUser) return;
  const path = 'tickets';
  try {
    const docRef = await addDoc(collection(db, path), {
      userId: String(tkt.userId),
      userName: tkt.userName,
      subject: tkt.subject,
      message: tkt.message,
      status: 'open',
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (e) {
    handleFirestoreError(e, OperationType.CREATE, path);
  }
}

export async function saveFirestoreSettings(settings: Record<string, string>) {
  if (!auth.currentUser) return;
  const path = 'settings';
  try {
    for (const [key, value] of Object.entries(settings)) {
      await setDoc(doc(db, 'settings', key), {
        key,
        value,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
  }
}
