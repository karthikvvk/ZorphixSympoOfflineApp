import * as FileSystem from 'expo-file-system/legacy';
import { Platform, PermissionsAndroid, Alert, BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllParticipants } from './sqlite';

// Backup directory in Downloads folder
const BACKUP_FOLDER = 'Zorphix_Backup';
const STORAGE_KEY_DIRECTORY_URI = '@zorphix_backup_directory_uri';

// Store the granted directory URI for future writes
let grantedDirectoryUri: string | null = null;

// Track permission request state to prevent infinite loops
let isRequestingPermission = false;
const MAX_BYPASS_ATTEMPTS = 3;

/**
 * Reset permission request state - call this on app startup
 * This ensures the flag doesn't get stuck from previous session
 */
export const resetPermissionState = (): void => {
    isRequestingPermission = false;
};

/**
 * Clear saved directory URI - for testing or permission reset
 */
export const clearSavedDirectoryUri = async (): Promise<void> => {
    try {
        await AsyncStorage.removeItem(STORAGE_KEY_DIRECTORY_URI);
        grantedDirectoryUri = null;
    } catch (err) {
        //console.log('📁 Could not clear directory URI:', err);
    }
};

/**
 * HARD VERIFICATION: Check if storage access is actually valid
 * Clears stale URIs if access was revoked
 * This is a TRUTH CHECK, not a request
 */
export const verifyStorageAccess = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    const savedUri = await loadSavedDirectoryUri();
    if (!savedUri) return false;

    try {
        await FileSystem.StorageAccessFramework.readDirectoryAsync(savedUri);
        return true;
    } catch {
        // Access revoked or URI invalid - clear it
        await AsyncStorage.removeItem(STORAGE_KEY_DIRECTORY_URI);
        grantedDirectoryUri = null;
        return false;
    }
};

/**
 * Load saved directory URI from AsyncStorage
 */
const loadSavedDirectoryUri = async (): Promise<string | null> => {
    try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY_DIRECTORY_URI);
        if (saved) {
            //console.log('📁 Loaded saved directory URI:', saved);
            grantedDirectoryUri = saved;
            return saved;
        }
    } catch (err) {
        //console.log('📁 Could not load saved directory URI:', err);
    }
    return null;
};

/**
 * Save directory URI to AsyncStorage
 */
const saveDirectoryUri = async (uri: string): Promise<void> => {
    try {
        await AsyncStorage.setItem(STORAGE_KEY_DIRECTORY_URI, uri);
        //console.log('📁 Saved directory URI to storage');
    } catch (err) {
        //console.log('📁 Could not save directory URI:', err);
    }
};

/**
 * Show the folder picker and handle the result
 * Returns true only if a folder is actually selected
 */
const showFolderPicker = async (): Promise<boolean> => {
    try {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
            grantedDirectoryUri = permissions.directoryUri;
            await saveDirectoryUri(permissions.directoryUri);
            Alert.alert('✅ Success', 'Backup folder selected!');
            return true;
        }
        return false;
    } catch (err) {
        //console.log('❌ SAF permission error:', err);
        return false;
    }
};

/**
 * Request storage permission for Android with PERSISTENT LOOP
 * Uses Storage Access Framework (SAF) for Android 10+
 * This function will NOT return until permission is granted OR app is closed
 * 
 * PREVENTS BYPASS: If user backs out of folder picker, shows warning and loops
 */
export const requestStoragePermission = async (): Promise<boolean> => {
    //console.log('📁 [BackupService] requestStoragePermission called');

    if (Platform.OS !== 'android') {
        return true;
    }

    // Reset and check if already requesting
    // This handles edge case where flag might be stuck from hot reload
    if (isRequestingPermission) {
        //console.log('📁 Permission request already in progress, waiting...');
        // Wait a bit and check again - might have been a race condition
        await new Promise(resolve => setTimeout(resolve, 500));
        if (isRequestingPermission) {
            return false; // Still in progress, don't start another
        }
    }

    try {
        isRequestingPermission = true;

        // 1. Check if we already have a saved directory
        const savedUri = await loadSavedDirectoryUri();
        if (savedUri) {
            try {
                // VERIFY ACCESS: Try to read the directory
                // If permission was revoked, this will throw an error
                await FileSystem.StorageAccessFramework.readDirectoryAsync(savedUri);
                //console.log('✅ Verified access to saved directory');
                isRequestingPermission = false;
                return true;
            } catch (error) {
                //console.log('⚠️ Saved directory access revoked or invalid. Requesting again...');
                // Clear the invalid URI
                await AsyncStorage.removeItem(STORAGE_KEY_DIRECTORY_URI);
                grantedDirectoryUri = null;
            }
        }

        // 2. PERSISTENT PERMISSION LOOP - Does not return until granted or app closed
        let bypassAttempts = 0;

        const requestWithPersistentLoop = (): Promise<boolean> => {
            return new Promise((resolve) => {

                const ask = () => {
                    Alert.alert(
                        '📁 Allow Zorphix to access your storage',
                        'Select a folder to save backups.',
                        [
                            {
                                text: 'Select Folder',
                                onPress: async () => {
                                    const granted = await showFolderPicker();

                                    if (granted) {
                                        // ONLY place where we resolve
                                        isRequestingPermission = false;
                                        resolve(true);
                                        return;
                                    }

                                    // User backed out → immediately ask again
                                    // No counters, no state mutation
                                    ask();
                                }
                            }
                        ],
                        { cancelable: false }
                    );
                };

                ask();
            });
        };


        return await requestWithPersistentLoop();


    } catch (err) {
        console.warn('📁 Storage permission error:', err);
        isRequestingPermission = false;
        return false;
    }
};

/**
 * Quote CSV value to handle special characters
 */
const quoteCSV = (value: any): string => {
    if (value === null || value === undefined) {
        return '""';
    }
    // Convert to string and escape any internal quotes
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
};

/**
 * Generate CSV row from participant data
 */
const participantToCSVRow = (p: any): string => {
    // Format checkin time to readable format
    let formattedTime = '';
    if (p.checkin_time) {
        try {
            const date = new Date(p.checkin_time);
            formattedTime = date.toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch (e) {
            formattedTime = p.checkin_time;
        }
    }

    return [
        quoteCSV(p.uid),
        quoteCSV(p.event_id),
        quoteCSV(p.name),
        quoteCSV(p.phone),
        quoteCSV(p.email),
        quoteCSV(p.college),
        quoteCSV(p.department),
        quoteCSV(p.year),
        quoteCSV(formattedTime),
        quoteCSV(p.participated || 0),
        quoteCSV(p.team_name || ''),
        quoteCSV(p.source || '')
    ].join(',');
};

/**
 * CSV Header row
 */
const CSV_HEADER = [
    'UID',
    'Event',
    'Name',
    'Phone',
    'Email',
    'College',
    'Department',
    'Year',
    'Checkin Time',
    'Participated Count',
    'Team Name',
    'Source'
].map(h => quoteCSV(h)).join(',');

/**
 * Backup participants to Downloads folder as CSV
 * Only includes participants who have participated (attended)
 * Deduplicates based on email+phone+event
 * APPENDS to existing file - does not create duplicates
 */
export const backupParticipantsToDownloads = async (): Promise<{ success: boolean; count: number; path?: string }> => {
    //console.log('📦 [BackupService] backupParticipantsToDownloads called');

    if (Platform.OS === 'web') {
        //console.log('⚠️ Backup not supported on web');
        return { success: false, count: 0 };
    }

    try {
        // Get all participants
        const participants = await getAllParticipants();
        //console.log(`📦 Total participants in DB: ${participants.length}`);

        // Filter only those who have participated (attended)
        const attendedParticipants = participants.filter(p => (p.participated || 0) > 0);
        //console.log(`📦 Attended participants: ${attendedParticipants.length}`);

        if (attendedParticipants.length === 0) {
            //console.log('ℹ️ No attended participants to backup');
            return { success: true, count: 0 };
        }

        // Deduplicate by email+phone+event
        const uniqueMap = new Map<string, any>();
        attendedParticipants.forEach(p => {
            const key = `${(p.email || '').toLowerCase()}_${p.phone || ''}_${p.event_id}`;
            // Keep the most recent entry (highest participated count)
            const existing = uniqueMap.get(key);
            if (!existing || (p.participated || 0) > (existing.participated || 0)) {
                uniqueMap.set(key, p);
            }
        });

        const uniqueParticipants = Array.from(uniqueMap.values());
        //console.log(`📦 Unique participants to backup: ${uniqueParticipants.length}`);

        // Fixed filename - always append to same file
        const filename = `zorphix_backup.csv`;

        // Primary backup location (app document directory)
        const appDocPath = `${FileSystem.documentDirectory}${filename}`;

        // Read existing file content if it exists
        let existingKeys = new Set<string>();
        try {
            const existingContent = await FileSystem.readAsStringAsync(appDocPath, {
                encoding: FileSystem.EncodingType.UTF8
            });
            // Parse existing entries to get their keys (skip header)
            const lines = existingContent.split('\n').slice(1); // Skip header
            lines.forEach((line, idx) => {
                if (line.trim()) {
                    // Parse CSV properly handling quoted values with commas
                    const parts: string[] = [];
                    let current = '';
                    let inQuotes = false;
                    for (let i = 0; i < line.length; i++) {
                        const char = line[i];
                        if (char === '"') {
                            inQuotes = !inQuotes;
                        } else if (char === ',' && !inQuotes) {
                            parts.push(current.replace(/"/g, '').trim());
                            current = '';
                        } else {
                            current += char;
                        }
                    }
                    parts.push(current.replace(/"/g, '').trim()); // Last field

                    if (parts.length >= 5) {
                        // CSV order: UID, Event, Name, Phone, Email
                        const [uid, eventId, name, phone, email] = parts;
                        const key = `${(email || '').toLowerCase()}_${phone || ''}_${eventId}`;
                        existingKeys.add(key);
                        //console.log(`📦 Existing entry ${idx + 1}: ${name} | Key: ${key}`);
                    }
                }
            });
            //console.log(`📦 Found ${existingKeys.size} existing entries in backup file`);
        } catch (readErr) {
            // File doesn't exist yet, that's fine
            //console.log('📦 No existing backup file, creating new one');
        }

        // Filter out participants that already exist in backup
        const newParticipants = uniqueParticipants.filter(p => {
            const key = `${(p.email || '').toLowerCase()}_${p.phone || ''}_${p.event_id}`;
            const exists = existingKeys.has(key);
            //console.log(`📦 Checking ${p.name} | Key: ${key} | Exists: ${exists}`);
            return !exists;
        });

        //console.log(`📦 New participants to add: ${newParticipants.length}`);

        if (newParticipants.length === 0) {
            //console.log('📦 All participants already in backup, nothing to add');
            return { success: true, count: 0, path: appDocPath };
        }

        // Build CSV content - only new rows (no header if appending)
        const newRows = newParticipants.map(p => participantToCSVRow(p));

        // If file didn't exist, include header
        let csvContent: string;
        if (existingKeys.size === 0) {
            csvContent = CSV_HEADER + '\n' + newRows.join('\n');
        } else {
            // Read existing content and append new rows
            const existingContent = await FileSystem.readAsStringAsync(appDocPath, {
                encoding: FileSystem.EncodingType.UTF8
            });
            csvContent = existingContent.trimEnd() + '\n' + newRows.join('\n');
        }

        // Write back to app directory
        await FileSystem.writeAsStringAsync(appDocPath, csvContent, {
            encoding: FileSystem.EncodingType.UTF8
        });
        //console.log(`✅ Backup updated: added ${newParticipants.length} new entries to ${appDocPath}`);

        // Also save to Downloads folder if permission was granted
        if (Platform.OS === 'android' && grantedDirectoryUri) {
            try {
                //console.log('📦 Saving to Downloads folder:', grantedDirectoryUri);

                // Try to find existing file in the directory and delete it first
                try {
                    const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(grantedDirectoryUri);
                    const existingFile = files.find(f => f.includes('zorphix_backup'));
                    if (existingFile) {
                        //console.log('📦 Deleting existing file:', existingFile);
                        await FileSystem.deleteAsync(existingFile, { idempotent: true });
                    }
                } catch (listErr) {
                    //console.log('📦 Could not list/delete existing files:', listErr);
                }

                // Create new file with full content
                const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
                    grantedDirectoryUri,
                    filename,
                    'text/csv'
                );

                await FileSystem.writeAsStringAsync(fileUri, csvContent, {
                    encoding: FileSystem.EncodingType.UTF8
                });

                //console.log('✅ Backup saved to Downloads:', fileUri);
                return { success: true, count: newParticipants.length, path: fileUri };
            } catch (downloadErr) {
                //console.log('⚠️ Could not save to Downloads:', downloadErr);
            }
        } else if (Platform.OS === 'android') {
            //console.log('📦 No directory selected - backup only in app directory');
        }

        return { success: true, count: newParticipants.length, path: appDocPath };

    } catch (error) {
        console.error('❌ Backup failed:', error);
        return { success: false, count: 0 };
    }
};

/**
 * Silent backup - doesn't show any UI, just logs
 * Use this for automatic backups after each enrollment
 */
export const silentBackup = async (): Promise<void> => {
    try {
        const result = await backupParticipantsToDownloads();
        if (result.success && result.count > 0) {
            //console.log(`📦 Backup complete: ${result.count} participants saved`);
        }
    } catch (error) {
        //console.log('⚠️ Silent backup failed:', error);
        // Don't throw - this is a background operation
    }
};
