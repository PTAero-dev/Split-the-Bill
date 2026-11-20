import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

export const FIREBASE_REGION_LABEL = 'Bangkok (asia-southeast3)';

const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    'AIzaSyCsO-vo5f_LZQQkj09YezAvHOTDlQl-u18',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    'split-the-bill-th.firebaseapp.com',
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID || 'split-the-bill-th',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    'split-the-bill-th.firebasestorage.app',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '236364494161',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    '1:236364494161:web:686576ca1f2f2d3e2a0f70',
};

export const firebaseApp: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(firebaseApp);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

function createFirestoreClient(app: FirebaseApp): Firestore {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    return getFirestore(app);
  }
}

export const db: Firestore = createFirestoreClient(firebaseApp);

export function mapFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';

  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'ยกเลิกการเข้าสู่ระบบด้วย Google แล้ว';
    case 'auth/popup-blocked':
      return 'เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณาลองอีกครั้ง';
    case 'auth/unauthorized-domain':
      return 'โดเมนนี้ยังไม่ได้เพิ่มใน Authorized domains ของ Firebase Authentication (กรุณาเพิ่มในหน้า Firebase Console)';
    case 'auth/network-request-failed':
      return 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตเพื่อเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง';
    case 'auth/operation-not-allowed':
      return 'ยังไม่ได้เปิดใช้งาน Google Sign-In ใน Firebase Console';
    default: {
      if (error instanceof Error && error.message.trim()) {
        return error.message;
      }
      return 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้';
    }
  }
}

export async function signInWithGoogleAccount(): Promise<void> {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code ?? '')
        : '';
    if (code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    throw new Error(mapFirebaseAuthError(err));
  }
}

export async function consumeRedirectSignIn(): Promise<void> {
  try {
    await getRedirectResult(auth);
  } catch (err) {
    throw new Error(mapFirebaseAuthError(err));
  }
}

export async function signOutFromCloud(): Promise<void> {
  await signOut(auth);
}
