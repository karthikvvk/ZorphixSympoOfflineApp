import * as FileSystem from 'expo-file-system/legacy';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllParticipants } from './sqlite';

// Backup directory in Downloads folder
const BACKUP_FOLDER = 'Zorphix_Backup';
const STORAGE_KEY_DIRECTORY_URI = '@zorphix_backup_directory_uri';

// Store the granted directory URI for future writes
let grantedDirectoryUri: string | null = null;

/**
 * Load saved directory URI from AsyncStorage
 */
const loadSavedDirectoryUri = async (): Promise<string | null> => {
    try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY_DIRECTORY_URI);
        if (saved) {
            console.log('📁 Loaded saved directory URI:', saved);
            grantedDirectoryUri = saved;
            return saved;
        }
    } catch (err) {
        console.log('📁 Could not load saved directory URI:', err);
    }
    return null;
};

/**
 * Save directory URI to AsyncStorage
 */
const saveDirectoryUri = async (uri: string): Promise<void> => {
    try {
        await AsyncStorage.setItem(STORAGE_KEY_DIRECTORY_URI, uri);
        console.log('📁 Saved directory URI to storage');
    } catch (err) {
        console.log('📁 Could not save directory URI:', err);
    }
};

/**
 * Request storage permission for Android
 * Uses Storage Access Framework (SAF) for Android 10+
 * This is called at app startup
 */
export const requestStoragePermission = async (): Promise<boolean> => {
    console.log('📁 [BackupService] requestStoragePermission called');
    console.log('📁 Platform:', Platform.OS);

    if (Platform.OS !== 'android') {
        console.log('📁 Not Android, skipping permission request');
        return true; // iOS handles permissions differently
    }

    try {
        // Check if we already have a saved directory from previous session
        const savedUri = await loadSavedDirectoryUri();
        if (savedUri) {
            console.log('📁 Already have saved directory access, skipping prompt');
            return true;
        }

        // For Android 10+ (API 29+), we need to use SAF
        // Request directory access via SAF - this will prompt user to select a folder
        console.log('📁 Requesting directory permissions via SAF...');

        // Show alert to explain what we're doing
        Alert.alert(
            '📁 Backup Location',
            'Please select a folder (like Downloads) where Zorphix can save backup files. This ensures your data is safe even if the app is uninstalled.',
            [
                {
                    text: 'Select Folder',
                    onPress: async () => {
                        try {
                            const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                            if (permissions.granted) {
                                grantedDirectoryUri = permissions.directoryUri;
                                // Save to AsyncStorage for future app launches
                                await saveDirectoryUri(permissions.directoryUri);
                                console.log('✅ Directory access granted:', grantedDirectoryUri);
                                Alert.alert('✅ Success', 'Backup folder selected successfully!');
                            } else {
                                console.log('❌ Directory access denied');
                                Alert.alert('⚠️ Warning', 'Backup will be saved to app internal storage only.');
                            }
                        } catch (err) {
                            console.log('❌ SAF permission error:', err);
                        }
                    }
                },
                {
                    text: 'Later',
                    style: 'cancel',
                    onPress: () => {
                        console.log('📁 User chose to set up backup later');
                    }
                }
            ]
        );

        return true;
    } catch (err) {
        console.warn('📁 Storage permission error:', err);
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
    console.log('📦 [BackupService] backupParticipantsToDownloads called');

    if (Platform.OS === 'web') {
        console.log('⚠️ Backup not supported on web');
        return { success: false, count: 0 };
    }

    try {
        // Get all participants
        const participants = await getAllParticipants();
        console.log(`📦 Total participants in DB: ${participants.length}`);

        // Filter only those who have participated (attended)
        const attendedParticipants = participants.filter(p => (p.participated || 0) > 0);
        console.log(`📦 Attended participants: ${attendedParticipants.length}`);

        if (attendedParticipants.length === 0) {
            console.log('ℹ️ No attended participants to backup');
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
        console.log(`📦 Unique participants to backup: ${uniqueParticipants.length}`);

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
            lines.forEach(line => {
                if (line.trim()) {
                    // Extract UID, Event, Email, Phone from CSV to create key
                    const parts = line.split(',').map(p => p.replace(/"/g, '').trim());
                    if (parts.length >= 5) {
                        const [uid, eventId, name, phone, email] = parts;
                        const key = `${(email || '').toLowerCase()}_${phone || ''}_${eventId}`;
                        existingKeys.add(key);
                    }
                }
            });
            console.log(`📦 Found ${existingKeys.size} existing entries in backup file`);
        } catch (readErr) {
            // File doesn't exist yet, that's fine
            console.log('📦 No existing backup file, creating new one');
        }

        // Filter out participants that already exist in backup
        const newParticipants = uniqueParticipants.filter(p => {
            const key = `${(p.email || '').toLowerCase()}_${p.phone || ''}_${p.event_id}`;
            return !existingKeys.has(key);
        });

        console.log(`📦 New participants to add: ${newParticipants.length}`);

        if (newParticipants.length === 0) {
            console.log('📦 All participants already in backup, nothing to add');
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
        console.log(`✅ Backup updated: added ${newParticipants.length} new entries to ${appDocPath}`);

        // Try to also save to Downloads folder (Android only) using cached directory
        if (Platform.OS === 'android' && grantedDirectoryUri) {
            try {
                console.log('📦 Attempting to save to selected directory:', grantedDirectoryUri);

                // For SAF, we need to create a new file each time or find existing
                // Since SAF doesn't support easy append, we write the full content
                const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
                    grantedDirectoryUri,
                    filename,
                    'text/csv'
                );

                await FileSystem.writeAsStringAsync(fileUri, csvContent, {
                    encoding: FileSystem.EncodingType.UTF8
                });

                console.log('✅ Backup saved to Downloads:', fileUri);
                return { success: true, count: newParticipants.length, path: fileUri };
            } catch (downloadErr) {
                console.log('⚠️ Could not save to Downloads, using app directory:', downloadErr);
            }
        } else if (Platform.OS === 'android') {
            console.log('📦 No directory selected yet - backup only in app directory');
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
            console.log(`📦 Backup complete: ${result.count} participants saved`);
        }
    } catch (error) {
        console.log('⚠️ Silent backup failed:', error);
        // Don't throw - this is a background operation
    }
};
