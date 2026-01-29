import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore, initializeFirestore, collection, getDocs, query, where, doc, getDoc, updateDoc, setDoc, arrayUnion } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { Platform } from "react-native";

// --- Read Configuration (Source of Truth) ---
// Uses usage-based/new project credentials (zorphix-2026)
// Hardcoded because process.env is not resolving in the Expo/RN runtime


// --- Write Configuration (Legacy Logging) ---
// Uses legacy hardcoded credentials for writing logs
const writeConfig = {
    apiKey: "AIzaSyDu5oRJbf-gWqDZzMOK6HYmb0PBLXNqFEo",
    authDomain: "zorphix-8d91e.firebaseapp.com",
    projectId: "zorphix-8d91e",
    storageBucket: "zorphix-8d91e.firebasestorage.app",
    messagingSenderId: "1016587815374",
    appId: "1:1016587815374:web:4972ea556e5e781aaac39f",
    measurementId: "G-PK6GESKCSB"
};

// Initialize Apps
// We check getApps() to avoid re-initialization errors in hot-reload environments
// const writeApp = !getApps().length ? initializeApp(readConfig) : getApp();
const writeApp = !getApps().find(app => app.name === "writeApp")
    ? initializeApp(writeConfig, "writeApp")
    : getApp("writeApp");

// Analytics only works on web (attached to default/read app)
if (Platform.OS === 'web') {
    import('firebase/analytics').then(({ getAnalytics }) => {
        getAnalytics(writeApp);
    });
}

// Initialize Firestore with settings to improve connectivity
// Default 'db' is for READING (Source of Truth)
export const db = initializeFirestore(writeApp, {
    experimentalForceLongPolling: true,
    ignoreUndefinedProperties: true,
});

// 'writeDb' is for WRITING (Legacy Logging)
export const writeDb = initializeFirestore(writeApp, {
    experimentalForceLongPolling: true,
    ignoreUndefinedProperties: true,
});

// Initialize Auth (attached to Read App / new project)
export const auth = getAuth(writeApp);

// --- Local Authentication Setup ---

// Password generator
function generatePassword(eventName: string): string {
    // Special case for on-spot admin (empty eventName)
    if (eventName === '') return 'onspot@zorphix@2026';
    // Special case for master admin
    if (eventName === 'Admin') return 'ad##zp##2026';
    const cleaned = eventName.toLowerCase().replace(/\s+/g, '').replace(/°/g, '');
    return `${cleaned}@zorphix@2026`;
}

// Event admin mappings (Hardcoded for Local Auth)
const EVENT_ADMINS = [
    // Technical Events
    { email: 'pixelreforge@zorphix.com', eventName: 'Pixel Reforge' },
    { email: 'promptcraft@zorphix.com', eventName: 'PromptCraft' },
    { email: 'algopulse@zorphix.com', eventName: 'AlgoPulse' },
    { email: 'reversecoding@zorphix.com', eventName: 'Reverse Coding' },
    { email: 'siptosurvive@zorphix.com', eventName: 'Sip to Survive' },
    { email: 'codecrypt@zorphix.com', eventName: 'CodeCrypt' },
    { email: 'linklogic@zorphix.com', eventName: 'LinkLogic' },
    { email: 'pitchfest@zorphix.com', eventName: 'Pitchfest' },

    // Paper Presentation
    { email: 'paperpresentation@zorphix.com', eventName: 'Paper Presentation' },

    // Workshops
    { email: 'fintech@zorphix.com', eventName: 'FinTech 360°' },
    { email: 'wealthx@zorphix.com', eventName: 'WealthX' },

    // On-Spot Registration Desk (no specific event)
    { email: 'onspot@zorphix.com', eventName: '' },

    // Master Admin
    { email: 'admin@zorphix.com', eventName: 'Admin' },
];

/**
 * MOCK Firebase User object
 * sufficient satisfy the return type Promise<User> for basic usage
 */
const mockUser = (email: string): User => ({
    uid: `local_${email}`,
    email: email,
    emailVerified: true,
    isAnonymous: false,
    metadata: {},
    providerData: [],
    refreshToken: '',
    tenantId: null,
    delete: async () => { },
    getIdToken: async () => 'mock_token',
    getIdTokenResult: async () => ({} as any),
    reload: async () => { },
    toJSON: () => ({}),
    displayName: null,
    phoneNumber: null,
    photoURL: null,
    providerId: 'firebase',
});

// Admin login function (LOCAL)
export const loginAdmin = async (email: string, password: string): Promise<User> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const normalizedEmail = email.toLowerCase().trim();
    const admin = EVENT_ADMINS.find(a => a.email === normalizedEmail);

    if (!admin) {
        // Throw simulated Firebase error
        const error: any = new Error('User not found');
        error.code = 'auth/user-not-found';
        throw error;
    }

    const expectedPassword = generatePassword(admin.eventName);
    if (password !== expectedPassword) {
        // Throw simulated Firebase error
        const error: any = new Error('Wrong password');
        error.code = 'auth/wrong-password';
        throw error;
    }

    return mockUser(admin.email);
};

// Logout function
export const logoutAdmin = async (): Promise<void> => {
    // No-op for local auth
    return;
};

// Get event name mapped to admin email (LOCAL)
export const getAdminEventMapping = async (email: string): Promise<string | null> => {
    const normalizedEmail = email.toLowerCase().trim();
    const admin = EVENT_ADMINS.find(a => a.email === normalizedEmail);
    return admin ? admin.eventName : null;
};

// Check payment status for a user's event registration
export const checkPaymentStatus = async (
    userUid: string,
    eventName: string
): Promise<{ isPaid: boolean; verified: boolean }> => {
    try {
        const userDoc = await getDoc(doc(db, "registrations", userUid));

        if (!userDoc.exists()) {
            return { isPaid: false, verified: false };
        }

        const data = userDoc.data();
        const payments = data.payments || [];

        // Check if any payment includes this event
        for (const payment of payments) {
            if (payment.eventNames?.includes(eventName) && payment.verified) {
                return { isPaid: true, verified: true };
            }
        }

        // Check if event is in their registered events (might be free)
        const events = data.events || [];
        if (events.includes(eventName)) {
            // Event is registered, check if it's a paid event
            // Free events don't need payment verification
            return { isPaid: false, verified: true };
        }

        return { isPaid: false, verified: false };
    } catch (error) {
        console.error("Failed to check payment status:", error);
        throw error;
    }
};

// Get participant info from Firebase by UID
export const getParticipantFromFirebase = async (userUid: string) => {
    try {
        const userDoc = await getDoc(doc(db, "registrations", userUid));

        if (!userDoc.exists()) {
            return null;
        }

        return userDoc.data();
    } catch (error) {
        console.error("Failed to get participant from Firebase:", error);
        return null;
    }
};

// Register user for an event on-spot (updates Firebase)
export const registerUserOnSpot = async (
    userUid: string,
    eventName: string,
    amountPaid: number = 0
): Promise<boolean> => {
    try {
        // Validation: Check if user exists in the main 'registrations' collection (Read DB - Source of Truth)
        const userRef = doc(db, "registrations", userUid);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            console.error("User does not exist in registrations (Source of Truth), cannot register on-spot.");
            return false;
        }

        // Write to: 'local_registrations' in the WRITE DB (Legacy Project)
        const localUserRef = doc(writeDb, "local_registrations", userUid);

        // We use setDoc with merge: true to create the document if it doesn't exist
        await setDoc(localUserRef, {
            events: arrayUnion(eventName),
            payments: arrayUnion({
                amount: amountPaid,
                date: new Date().toISOString(),
                eventNames: [eventName],
                id: `onspot_${Date.now()}`,
                status: "verified",
                verified: true,
                type: "CASH_ONSPOT"
            })
        }, { merge: true });

        console.log(`Successfully registered on-spot in local_registrations (Write DB) for ${userUid}`);
        return true;
    } catch (error) {
        console.error("Failed to register user on-spot:", error);
        return false;
    }
};
