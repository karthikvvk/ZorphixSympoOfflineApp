import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

const DB_NAME = 'zorphix_participants.db';
const WEB_STORAGE_KEY = 'zorphix_participants_data';

// Web Mock Storage with Persistence
let webParticipants: any[] = [];

// Load from localStorage on init
if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
        const saved = localStorage.getItem(WEB_STORAGE_KEY);
        if (saved) {
            webParticipants = JSON.parse(saved);
        }
    } catch (e) {
        console.error("Failed to load web mock data", e);
    }
}

// Helper to save to localStorage
const saveWebData = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(webParticipants));
    }
};

// Use a mocked DB for web to prevent crashes
let db: any = null;
if (Platform.OS !== 'web') {
    try {
        db = SQLite.openDatabaseSync(DB_NAME);
    } catch (e) {
        console.error("Failed to open database", e);
    }
}

// Initialize the database table with extended schema
export const initParticipantDB = () => {
    if (Platform.OS === 'web') {
        console.log("Web Mock DB Initialized (with localStorage)");
        return;
    }
    if (!db) return;

    try {
        // Check current schema to see if we need migration
        const tableInfo = db.getAllSync(`PRAGMA table_info(participants);`);

        // Check if 'checked_in' exists (old schema) or 'event_type' missing (new schema target)
        const hasCheckedIn = tableInfo.some((col: any) => col.name === 'checked_in');
        const hasEventType = tableInfo.some((col: any) => col.name === 'event_type');

        if (hasCheckedIn || !hasEventType) {
            console.log("⚡ Starting Schema Migration: Refactoring to Simplified Schema");

            db.execSync('BEGIN TRANSACTION;');
            try {
                // Rename old table
                db.execSync(`ALTER TABLE participants RENAME TO participants_old;`);

                // Create new table with Simplified Schema
                db.execSync(
                    `CREATE TABLE participants (
                        uid TEXT,
                        event_id TEXT,
                        name TEXT,
                        phone TEXT,
                        email TEXT,
                        college TEXT,
                        degree TEXT,
                        department TEXT,
                        year TEXT,
                        checkin_time TEXT,
                        source TEXT,
                        sync_status INTEGER,
                        payment_verified INTEGER,
                        participated INTEGER DEFAULT 0,
                        team_name TEXT,
                        team_members TEXT,
                        event_type TEXT DEFAULT 'free',
                        PRIMARY KEY (uid, event_id)
                    );`
                );

                // Copy data with transformations
                // Merge _other fields into main fields
                // Drop checked_in
                // Default event_type to 'free' (or 'paid' if we could guess, but 'free' is safer default)
                // participated is kept as is (0 or 1, which fits the counter model as starting point)
                db.execSync(`
                    INSERT INTO participants (
                        uid, event_id, name, phone, email, 
                        college, degree, department, year, 
                        checkin_time, source, sync_status, 
                        payment_verified, participated,
                        team_name, team_members, event_type
                    )
                    SELECT 
                        uid, event_id, name, phone, email, 
                        COALESCE(NULLIF(college, ''), college_other) as college, 
                        COALESCE(NULLIF(degree, ''), degree_other) as degree, 
                        COALESCE(NULLIF(department, ''), department_other) as department, 
                        year, 
                        checkin_time, source, sync_status, 
                        payment_verified, participated,
                        team_name, team_members, 
                        'free'
                    FROM participants_old;
                `);

                // Drop old table
                db.execSync(`DROP TABLE participants_old;`);

                db.execSync('COMMIT;');
                console.log("✅ Schema Migration Complete: Schema Simplified.");
            } catch (migrationError) {
                console.error("Migration failed, rolling back", migrationError);
                db.execSync('ROLLBACK;');
            }
        } else {
            // Create table if not exists (Fresh Install)
            db.execSync(
                `CREATE TABLE IF NOT EXISTS participants (
                    uid TEXT,
                    event_id TEXT,
                    name TEXT,
                    phone TEXT,
                    email TEXT,
                    college TEXT,
                    degree TEXT,
                    department TEXT,
                    year TEXT,
                    checkin_time TEXT,
                    source TEXT,
                    sync_status INTEGER,
                    payment_verified INTEGER,
                    participated INTEGER DEFAULT 0,
                    team_name TEXT,
                    team_members TEXT,
                    event_type TEXT DEFAULT 'free',
                    PRIMARY KEY (uid, event_id)
                );`
            );
        }

    } catch (e) {
        console.error("Failed to init DB", e);
    }
};

// Check if participant exists by email or phone for a specific event
export const checkParticipantExists = async (email: string, phone: string, eventId: string): Promise<boolean> => {
    if (Platform.OS === 'web') {
        return webParticipants.some(p =>
            p.event_id === eventId &&
            (p.email === email || p.phone === phone)
        );
    }
    if (!db) return false;

    try {
        const result = db.getFirstSync(
            `SELECT COUNT(*) as count FROM participants WHERE event_id = ? AND (email = ? OR phone = ?);`,
            [eventId, email, phone]
        );
        return (result?.count || 0) > 0;
    } catch (e) {
        console.error("Check existence failed", e);
        return false;
    }
};

// Insert a participant with simplified schema
export const insertParticipant = (
    uid: string,
    event_id: string,
    name: string,
    phone: string,
    email: string,
    college: string = '',
    degree: string = '',
    department: string = '',
    year: string = '',
    source: 'WEB' | 'ONSPOT' | 'IMPORT' | 'QR_AUTO' = 'WEB',
    sync_status: number = 1,
    payment_verified: number = 0,
    participated: number = 0,
    team_name: string = '',
    team_members: string = '',
    event_type: 'free' | 'paid' = 'free'
) => {
    if (Platform.OS === 'web') {
        const exists = webParticipants.find(p => p.uid === uid && p.event_id === event_id);
        if (!exists) {
            webParticipants.push({
                uid, event_id, name, phone, email,
                college, degree, department, year,
                source, sync_status, checkin_time: null,
                payment_verified, participated,
                team_name, team_members, event_type
            });
            saveWebData();
        }
        return;
    }
    if (!db) return;

    try {
        db.runSync(
            `INSERT OR IGNORE INTO participants 
            (uid, event_id, name, phone, email, college, degree, 
             department, year, source, sync_status, payment_verified, participated, team_name, team_members, event_type) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [uid, event_id, name, phone, email, college, degree,
                department, year, source, sync_status, payment_verified, participated, team_name, team_members, event_type]
        );
    } catch (e) {
        console.error("Insert failed", e);
    }
};

// Get participant by UID for QR verification
// NOTE: Returns ALL records for this UID (could be multiple events)
export const getParticipantByUID = async (uid: string): Promise<any> => {
    if (Platform.OS === 'web') {
        return webParticipants.filter(p => p.uid === uid) || null;
    }
    if (!db) return null;

    try {
        // Should probably return a list, but keeping signature for now.
        // The original code expected one. 
        // For general "scan to see history", maybe getAllSync is better.
        // But for "Entry", we usually know the event context or ask for it.
        // If we just scanned a bare UID, we might need to pick which event.
        const result = db.getAllSync(
            `SELECT * FROM participants WHERE uid = ?;`,
            [uid]
        );
        return result.length > 0 ? result[0] : null;
    } catch (e) {
        console.error("Get participant failed", e);
        return null;
    }
};

// Get participant by UID and event for specific verification
export const getParticipantByUIDAndEvent = async (uid: string, eventId: string): Promise<any> => {
    if (Platform.OS === 'web') {
        let p = webParticipants.find(p => p.uid === uid && p.event_id === eventId);
        if (!p) {
            p = webParticipants.find(p => p.uid.startsWith(uid) && p.event_id === eventId);
        }
        return p || null;
    }
    if (!db) return null;

    try {
        const result = db.getFirstSync(
            `SELECT * FROM participants WHERE (uid = ? OR uid LIKE ?) AND event_id = ?;`,
            [uid, `${uid}_%`, eventId]
        );
        return result || null;
    } catch (e) {
        console.error("Get participant by UID and event failed", e);
        return null;
    }
};

// Mark participant as checked in
// DELETE markCheckedIn - Logic merged into incrementParticipation

// Mark participant as participated (verified and allowed entry)
// !! CRITICAL: Must scope by event_id now
// Increment participation count (Attendance)
export const incrementParticipation = (uid: string, eventId: string) => {
    if (Platform.OS === 'web') {
        const p = webParticipants.find(p => p.uid === uid && p.event_id === eventId);
        if (p) {
            p.participated = (p.participated || 0) + 1;
            p.checkin_time = new Date().toISOString();
            saveWebData();
        }
        return;
    }
    if (!db) return;

    const timestamp = new Date().toISOString();
    try {
        // Increment participated count and update checkin_time
        const query = `UPDATE participants 
             SET participated = participated + 1, checkin_time = ? 
             WHERE uid = ? AND event_id = ?;`;

        db.runSync(query, [timestamp, uid, eventId]);
        console.log(`Incremented participation: ${uid} for ${eventId}`);
    } catch (e) {
        console.error("Increment participation failed", e);
    }
};

// Update payment verification status
export const updatePaymentStatus = (uid: string, verified: boolean, eventId?: string) => {
    if (Platform.OS === 'web') {
        const p = webParticipants.find(p => p.uid === uid && (!eventId || p.event_id === eventId));
        if (p) {
            p.payment_verified = verified ? 1 : 0;
            saveWebData();
        }
        return;
    }
    if (!db) return;

    try {
        db.runSync(
            `UPDATE participants SET payment_verified = ? WHERE uid = ? ${eventId ? 'AND event_id = ?' : ''};`,
            eventId ? [verified ? 1 : 0, uid, eventId] : [verified ? 1 : 0, uid]
        );
    } catch (e) {
        console.error("Update payment status failed", e);
    }
};

// Get all unsynced ONSPOT registrations for post-event sync
export const getUnsyncedOnspot = async (): Promise<any[]> => {
    if (Platform.OS === 'web') {
        const unsynced = webParticipants.filter(p => p.source === 'ONSPOT' && p.sync_status === 0);
        return unsynced;
    }
    if (!db) return [];

    try {
        return db.getAllSync(
            `SELECT * FROM participants WHERE source = 'ONSPOT' AND sync_status = 0;`
        );
    } catch (e) {
        console.error("Get unsynced failed", e);
        return [];
    }
};

export const markSynced = (uid: string, eventId?: string) => {
    if (Platform.OS === 'web') {
        const p = webParticipants.find(p => p.uid === uid && (!eventId || p.event_id === eventId));
        if (p) {
            p.sync_status = 1;
            saveWebData();
        }
        return;
    }
    if (!db) return;

    try {
        db.runSync(
            `UPDATE participants SET sync_status = 1 WHERE uid = ? ${eventId ? 'AND event_id = ?' : ''};`,
            eventId ? [uid, eventId] : [uid]
        );
    } catch (e) {
        console.error("Mark synced failed", e);
    }
};

// Get all participants for the viewer
export const getAllParticipants = async (): Promise<any[]> => {
    if (Platform.OS === 'web') {
        return [...webParticipants];
    }
    if (!db) return [];

    try {
        return db.getAllSync(
            `SELECT * FROM participants ORDER BY name ASC;`
        );
    } catch (e) {
        console.error("Get all failed", e);
        return [];
    }
};

// Get participants for a specific event
export const getParticipantsByEvent = async (eventId: string): Promise<any[]> => {
    if (Platform.OS === 'web') {
        return webParticipants.filter(p => p.event_id === eventId);
    }
    if (!db) return [];

    try {
        return db.getAllSync(
            `SELECT * FROM participants WHERE event_id = ? ORDER BY name ASC;`,
            [eventId]
        );
    } catch (e) {
        console.error("Get by event failed", e);
        return [];
    }
};

// Get strictly locally added participants (Newly Added: Onspot and Imported)
export const getOnSpotParticipants = async (): Promise<any[]> => {
    if (Platform.OS === 'web') {
        const local = webParticipants.filter(p => p.source === 'ONSPOT' || p.source === 'IMPORT');
        return local;
    }
    if (!db) return [];

    try {
        return await db.getAllSync(
            `SELECT * FROM participants WHERE source IN ('ONSPOT', 'IMPORT') ORDER BY rowid DESC;`
        );
    } catch (e) {
        console.error("Get onspot failed", e);
        return [];
    }
};

// Get count of participants for an event
// Get count of participants for an event
export const getEventParticipantCount = async (eventId: string): Promise<{ total: number; checkedIn: number }> => {
    if (Platform.OS === 'web') {
        const eventParticipants = webParticipants.filter(p => p.event_id === eventId);
        const checkedIn = eventParticipants.filter(p => (p.participated || 0) > 0).length;
        return { total: eventParticipants.length, checkedIn };
    }
    if (!db) return { total: 0, checkedIn: 0 };

    try {
        const totalResult = db.getFirstSync(
            `SELECT COUNT(*) as count FROM participants WHERE event_id = ?;`,
            [eventId]
        );
        // Checked in means participated count > 0
        const checkedInResult = db.getFirstSync(
            `SELECT COUNT(*) as count FROM participants WHERE event_id = ? AND participated > 0;`,
            [eventId]
        );
        return {
            total: totalResult?.count || 0,
            checkedIn: checkedInResult?.count || 0
        };
    } catch (e) {
        console.error("Get event count failed", e);
        return { total: 0, checkedIn: 0 };
    }
};

// Clear all data (for testing/reset)
export const clearAllParticipants = () => {
    if (Platform.OS === 'web') {
        webParticipants = [];
        saveWebData();
        return;
    }
    if (!db) return;

    try {
        db.runSync(`DELETE FROM participants;`);
    } catch (e) {
        console.error("Clear all failed", e);
    }
};
