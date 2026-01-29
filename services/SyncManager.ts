import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import { syncParticipantsFromFirebase, SyncStatusCallback } from './InitialDataImport';
import { AppState, AppStateStatus } from 'react-native';

let networkSubscription: NetInfoSubscription | null = null;
let pollingInterval: ReturnType<typeof setInterval> | null = null;
let hasSyncedSuccessfully = false;
let isCurrentlySyncing = false;
let statusCallback: SyncStatusCallback | undefined;
let appStateSubscription: any = null;

const POLLING_INTERVAL_MS = 30000; // 30 seconds

/**
 * Check if we have ACTUAL internet connectivity (not just WiFi)
 * by doing a fetch to a reliable endpoint
 */
const checkActualInternet = async (): Promise<boolean> => {
    try {
        // Use Google's generate_204 endpoint (extremely reliable)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch('https://clients3.google.com/generate_204', {
            method: 'HEAD',
            signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response.status === 204;
    } catch {
        return false;
    }
};

/**
 * Attempt sync if not already synced and not currently syncing
 * Only shows UI overlay when actually syncing (not on failures)
 */
const attemptSync = async () => {
    if (hasSyncedSuccessfully) {
        // console.log('✅ [SyncManager] Already synced, skipping');
        return;
    }

    if (isCurrentlySyncing) {
        // console.log('⏳ [SyncManager] Sync already in progress, skipping');
        return;
    }

    // console.log('🔍 [SyncManager] Checking actual internet connectivity...');
    // Don't show overlay for connectivity check - silent background check

    const hasInternet = await checkActualInternet();

    if (!hasInternet) {
        // Silent failure - just log, no popup
        // console.log('❌ [SyncManager] No actual internet (WiFi but no access) - will retry silently');
        return;
    }

    // Internet confirmed - NOW show the overlay
    // console.log('🌐 [SyncManager] Internet confirmed, triggering sync...');
    isCurrentlySyncing = true;

    try {
        // Pass statusCallback only for actual sync progress (not failures)
        const result = await syncParticipantsFromFirebase(statusCallback);
        if (result.success) {
            hasSyncedSuccessfully = true;
            // console.log('✅ [SyncManager] Sync completed successfully');
        }
    } catch (error) {
        // Silent failure - just log, no popup
        // console.log('⚠️ [SyncManager] Sync failed - will retry silently:', error);
    } finally {
        isCurrentlySyncing = false;
    }
};

/**
 * Start the polling interval
 */
const startPolling = () => {
    if (pollingInterval) {
        // console.log('⏰ [SyncManager] Polling already running');
        return;
    }

    pollingInterval = setInterval(() => {
        // console.log('⏰ [SyncManager] Polling tick...');
        if (!hasSyncedSuccessfully && !isCurrentlySyncing) {
            attemptSync();
        } else if (hasSyncedSuccessfully) {
            // console.log('⏹ [SyncManager] Sync complete, stopping polling');
            stopPolling();
        }
    }, POLLING_INTERVAL_MS);

    // console.log('⏰ [SyncManager] Polling started (every 30s)');
};

/**
 * Stop the polling interval
 */
const stopPolling = () => {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        // console.log('⏹ [SyncManager] Polling stopped');
    }
};

/**
 * Handle app state changes (foreground/background)
 */
const handleAppStateChange = (nextAppState: AppStateStatus) => {
    // console.log(`📱 [SyncManager] App state changed: ${nextAppState}`);

    if (nextAppState === 'active' && !hasSyncedSuccessfully) {
        // App came to foreground, try sync immediately
        // console.log('🔄 [SyncManager] App active, attempting sync...');
        attemptSync();

        // Restart polling if it was stopped
        if (!pollingInterval) {
            startPolling();
        }
    }
};

/**
 * Start watching for network changes and polling for connectivity.
 * When internet becomes available, automatically trigger sync.
 * 
 * @param onStatusChange - Optional callback to update UI with sync status
 */
export const startNetworkWatcher = (onStatusChange?: SyncStatusCallback) => {
    // Avoid duplicate subscriptions
    if (networkSubscription) {
        // console.log('🔄 [SyncManager] Network watcher already running');
        return;
    }

    // console.log('👀 [SyncManager] Starting network watcher...');
    hasSyncedSuccessfully = false;
    isCurrentlySyncing = false;
    statusCallback = onStatusChange;

    // Listen for app state changes
    appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Network state change listener
    networkSubscription = NetInfo.addEventListener(async (state: NetInfoState) => {
        // console.log(`📶 [SyncManager] Network state: connected=${state.isConnected}, type=${state.type}`);

        if (state.isConnected && !hasSyncedSuccessfully && !isCurrentlySyncing) {
            await attemptSync();
        }
    });

    // Start polling as fallback
    startPolling();

    // Also try immediately
    attemptSync();
};

/**
 * Stop watching for network changes and polling
 */
export const stopNetworkWatcher = () => {
    if (networkSubscription) {
        networkSubscription();
        networkSubscription = null;
    }
    stopPolling();
    if (appStateSubscription) {
        appStateSubscription.remove();
        appStateSubscription = null;
    }
    hasSyncedSuccessfully = false;
    isCurrentlySyncing = false;
    statusCallback = undefined;
    // console.log('🛑 [SyncManager] All watchers stopped');
};

/**
 * Force reset the sync status (to trigger another sync)
 */
export const resetSyncStatus = () => {
    hasSyncedSuccessfully = false;
    // console.log('🔄 [SyncManager] Sync status reset');
};

/**
 * Check if sync has completed successfully
 */
export const hasSynced = () => hasSyncedSuccessfully;
