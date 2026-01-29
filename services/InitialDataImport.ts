import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { insertParticipant } from './sqlite';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// Status callback type for UI updates
export type SyncStatusCallback = (status: string, subStatus?: string) => void;

/**
 * Sync participants from Firebase to local SQLite.
 * Runs on EVERY app launch (not one-time).
 * Uses INSERT OR IGNORE to skip existing records (no duplicates, no delay).
 * Silently fails on errors (no alerts, just logs).
 * 
 * @param onStatusChange - Optional callback to report status updates to UI
 */
export const syncParticipantsFromFirebase = async (
    onStatusChange?: SyncStatusCallback
): Promise<{ success: boolean; count: number }> => {
    // console.log('📦 [SyncFromFirebase] syncParticipantsFromFirebase() called.');

    const updateStatus = (status: string, subStatus?: string) => {
        // console.log(`📡 [SyncFromFirebase] ${status} ${subStatus || ''}`);
        onStatusChange?.(status, subStatus);
    };

    // Skip on web platform
    if (Platform.OS === 'web') {
        // console.log('⏭️ [SyncFromFirebase] Skipping on web platform');
        return { success: true, count: 0 };
    }

    try {
        // Step 1: Check internet connection
        updateStatus('Checking connection...', 'Please ensure you are connected to the internet');
        const netState = await NetInfo.fetch();

        if (!netState.isConnected) {
            updateStatus('No internet connection', 'Using offline data');
            return { success: false, count: 0 };
        }

        updateStatus('Connected ✓', 'Internet connection available');

        // Step 2: Fetch from Firebase (read from 'registrations' collection)
        updateStatus('Fetching data...', 'Downloading participant records from server');
        const snapshot = await getDocs(collection(db, 'registrations'));
        const totalParticipants = snapshot.docs.length;

        updateStatus('Data received ✓', `Found ${totalParticipants} participants`);
        // console.log(`📊 [SyncFromFirebase] Found ${totalParticipants} participants in Firebase`);

        // Step 3: Process and insert
        updateStatus('Updating local database...', 'Processing records');
        let totalRecords = 0;
        let errors = 0;

        for (const docSnap of snapshot.docs) {
            try {
                const data = docSnap.data();
                const events = data.events || [];
                const firestoreUid = data.uid || docSnap.id;

                for (const eventName of events) {
                    insertParticipant(
                        firestoreUid,
                        eventName,
                        data.name || data.displayName || 'Unknown',
                        data.phone || '',
                        data.email || '',
                        data.college || '',
                        data.degree || '',
                        data.department || '',
                        data.year || '',
                        'WEB',
                        1,
                        0,
                        0,
                        '',
                        '',
                        'free' as 'free' | 'paid'
                    );
                    totalRecords++;
                }
            } catch (docError) {
                // console.log(`⚠️ [SyncFromFirebase] Failed to process doc ${docSnap.id}:`, docError);
                errors++;
            }
        }

        // Step 4: Complete
        updateStatus('Sync complete ✓', `${totalRecords} records updated`);
        // console.log(`✅ [SyncFromFirebase] Sync complete: ${totalRecords} records processed, ${errors} errors`);

        return { success: true, count: totalRecords };

    } catch (error) {
        // console.log('⚠️ [SyncFromFirebase] Sync failed silently:', error);
        updateStatus('Sync failed', 'Will retry on next launch');
        return { success: false, count: 0 };
    }
};

// Keep for backward compatibility
export const runInitialDataImport = syncParticipantsFromFirebase;
