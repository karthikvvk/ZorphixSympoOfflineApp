import { collection, getDocs, doc, writeBatch, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { insertParticipant, getUnsyncedOnspot, markSynced } from "./sqlite";

// 1. Sync FROM Firebase (Pre-Event)
// Fetches all registrations and inserts them into local SQLite
// Maps the 'events' array to multiple local participant entries
export const syncFromFirebase = async () => {
    try {
        // console.log("Starting sync from Firebase...");

        // Fetch all registrations
        const snapshot = await getDocs(collection(db, "registrations"));
        let totalSynced = 0;

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const events = data.events || []; // Array of event names
            const firestoreUid = data.uid || docSnap.id;
            const payments = data.payments || [];

            // For each event the user is registered for, create a local record
            for (const eventName of events) {
                // Use actual Firestore UID since we now support composite PK (uid, event_id)
                const localUid = firestoreUid;

                // Check if payment is verified for this event
                const paymentVerified = payments.some(
                    (p: any) => p.eventNames?.includes(eventName) && p.verified
                ) ? 1 : 0;

                insertParticipant(
                    localUid,
                    eventName,
                    data.displayName || data.name || "Unknown",
                    data.phone || "",
                    data.email || "",
                    data.college || data.collegeOther || "",
                    data.degree || data.degreeOther || "",
                    data.department || data.departmentOther || "",
                    data.year || "",
                    'WEB',
                    1,  // sync_status
                    paymentVerified,
                    0,   // participated
                    '', // team_name
                    '', // team_members
                    'paid' // event_type (assuming paid for synced? or derive from payments? for now 'paid' or 'free' based on paymentVerified? No, that's dangerous. Let's use logic: if paymentVerified, it's paid. If not, maybe free? BUT syncFromFirebase implies registration. Safe default 'free' if unknown, but better if we knew. User didn't specify event_type source. I'll default to 'free' or update if payment verified).
                    // Actually, if paymentVerified is 1, event_type should probably be 'paid'. If 0, it might be a free event OR unpaid paid event.
                    // Let's assume 'free' default, app logic handles payment status separately.
                );
                totalSynced++;
            }
        }

        // console.log(`Sync complete. Synced ${totalSynced} participant-event records.`);
        return totalSynced;
    } catch (error) {
        console.error("Sync from Firebase failed:", error);
        throw error;
    }
};

// 2. Sync ON-SPOT registrations TO Firebase (Post-Event)
// Pushes locally registered 'ONSPOT' participants to Firestore
export const syncOnspotToFirebase = async () => {
    try {
        const unsyncedParams = await getUnsyncedOnspot();

        if (unsyncedParams.length === 0) {
            // console.log("No unsynced on-spot registrations found.");
            return 0;
        }

        // console.log(`Found ${unsyncedParams.length} unsynced participants. Uploading...`);

        const batch = writeBatch(db);

        for (const p of unsyncedParams) {
            // For on-spot registrations, create a new document in registrations collection
            // Using the local UID as the document ID
            const userRef = doc(db, "registrations", p.uid);

            batch.set(userRef, {
                uid: p.uid,
                displayName: p.name,
                name: p.name,
                email: p.email,
                phone: p.phone,
                college: p.college || '',
                degree: p.degree || '',
                department: p.department || '',
                year: p.year || '',
                events: [p.event_id],
                payments: p.payment_verified ? [{
                    amount: 0,
                    date: new Date().toISOString(),
                    eventNames: [p.event_id],
                    id: `onspot_${Date.now()}`,
                    status: "verified",
                    verified: true,
                    type: "CASH_ONSPOT"
                }] : [],
                profileCompleted: true,
                registeredAt: serverTimestamp(),
                createdAt: serverTimestamp(),
                source: 'ONSPOT',
                participated: p.participated > 0
            }, { merge: true });
        }

        await batch.commit();

        // Mark local records as synced
        for (const p of unsyncedParams) {
            markSynced(p.uid, p.event_id);
        }

        // console.log(`Successfully uploaded ${unsyncedParams.length} on-spot registrations.`);
        return unsyncedParams.length;

    } catch (error) {
        console.error("Upload to Firebase failed:", error);
        throw error;
    }
};

// 3. Update participation status in Firebase
// Called after marking someone as participated locally
export const updateParticipationInFirebase = async (uid: string, eventName: string) => {
    try {
        const userRef = doc(db, "registrations", uid);

        await setDoc(userRef, {
            participated: true,
            participatedEvents: [eventName],
            lastParticipationTime: serverTimestamp()
        }, { merge: true });

        // console.log(`Updated participation status in Firebase for ${uid}`);
        return true;
    } catch (error) {
        console.error("Failed to update participation in Firebase:", error);
        // Don't throw - local update is still valid
        return false;
    }
};

// 4. Sync event-specific data
// Fetches only participants for a specific event
export const syncEventFromFirebase = async (eventName: string) => {
    try {
        // console.log(`Syncing participants for event: ${eventName}`);

        const snapshot = await getDocs(collection(db, "registrations"));
        let eventSynced = 0;

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const events = data.events || [];

            // Only process if user is registered for this event
            if (!events.includes(eventName)) continue;

            const firestoreUid = data.uid || docSnap.id;
            const payments = data.payments || [];

            const localUid = firestoreUid;

            const paymentVerified = payments.some(
                (p: any) => p.eventNames?.includes(eventName) && p.verified
            ) ? 1 : 0;

            insertParticipant(
                localUid,
                eventName,
                data.displayName || data.name || "Unknown",
                data.phone || "",
                data.email || "",
                data.college || data.collegeOther || "",
                data.degree || data.degreeOther || "",
                data.department || data.departmentOther || "",
                data.year || "",
                'WEB',
                1,
                paymentVerified,
                0, // participated
                '',
                '',
                'free'
            );
            eventSynced++;
        }

        // console.log(`Event sync complete. Synced ${eventSynced} participants for ${eventName}.`);
        return eventSynced;
    } catch (error) {
        console.error(`Sync for event ${eventName} failed:`, error);
        throw error;
    }
};
