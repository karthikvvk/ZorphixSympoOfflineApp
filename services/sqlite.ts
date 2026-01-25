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
        // 1. Check if we need to migrate to Composite PK
        // We check if the table info shows 'pk' > 1 for just uid, or we check if we can insert dupes.
        // Easier way: Check table definition or just rely on a specific migration flag.
        // Let's check table info.
        const tableInfo = db.getAllSync(`PRAGMA table_info(participants);`);
        const uidInfo = tableInfo.find((col: any) => col.name === 'uid');
        const eventInfo = tableInfo.find((col: any) => col.name === 'event_id');

        // If 'uid' is PK (pk=1) and 'event_id' is NOT part of PK (pk=0/undefined), we need migration
        // Note: in composite PK, both would have pk > 0.
        const isOldSchema = uidInfo?.pk === 1 && (!eventInfo?.pk || eventInfo?.pk === 0);

        if (isOldSchema) {
            console.log("⚡ Starting Schema Migration: Single PK -> Composite PK");

            db.execSync('BEGIN TRANSACTION;');
            try {
                // Rename old table
                db.execSync(`ALTER TABLE participants RENAME TO participants_old;`);

                // Create new table with Composite PK
                db.execSync(
                    `CREATE TABLE participants (
                        uid TEXT,
                        event_id TEXT,
                        name TEXT,
                        phone TEXT,
                        email TEXT,
                        college TEXT,
                        college_other TEXT,
                        degree TEXT,
                        degree_other TEXT,
                        department TEXT,
                        department_other TEXT,
                        year TEXT,
                        checked_in INTEGER DEFAULT 0,
                        checkin_time TEXT,
                        source TEXT DEFAULT 'WEB',
                        sync_status INTEGER DEFAULT 1,
                        payment_verified INTEGER DEFAULT 0,
                        participated INTEGER DEFAULT 0,
                        PRIMARY KEY (uid, event_id)
                    );`
                );

                // Copy data
                // We need to be careful about columns matching. 
                // The old table might check miss some columns if we just added them via ALTER.
                // Best to list columns specifically if we can, but 'SELECT *' usually works if structure matches loosely.
                // Safest is to insert common columns.
                db.execSync(`
                    INSERT INTO participants (
                        uid, event_id, name, phone, email, 
                        college, college_other, degree, degree_other, 
                        department, department_other, year, 
                        checked_in, checkin_time, source, sync_status, 
                        payment_verified, participated
                    )
                    SELECT 
                        uid, event_id, name, phone, email, 
                        college, college_other, degree, degree_other, 
                        department, department_other, year, 
                        checked_in, checkin_time, source, sync_status, 
                        payment_verified, participated
                    FROM participants_old;
                `);

                // Drop old table
                db.execSync(`DROP TABLE participants_old;`);

                db.execSync('COMMIT;');
                console.log("✅ Schema Migration Complete: Composite PK enabled.");
            } catch (migrationError) {
                console.error("Migration failed, rolling back", migrationError);
                db.execSync('ROLLBACK;');
            }
        } else {
            // Ensure table exists if fresh install
            db.execSync(
                `CREATE TABLE IF NOT EXISTS participants (
                    uid TEXT,
                    event_id TEXT,
                    name TEXT,
                    phone TEXT,
                    email TEXT,
                    college TEXT,
                    college_other TEXT,
                    degree TEXT,
                    degree_other TEXT,
                    department TEXT,
                    department_other TEXT,
                    year TEXT,
                    checked_in INTEGER DEFAULT 0,
                    checkin_time TEXT,
                    source TEXT DEFAULT 'WEB',
                    sync_status INTEGER DEFAULT 1,
                    payment_verified INTEGER DEFAULT 0,
                    participated INTEGER DEFAULT 0,
                    PRIMARY KEY (uid, event_id)
                );`
            );
        }

        // Schema Migration: Add columns if they requested but missing (for existing apps)
        // This is safe to run even after the big migration above, as it checks existence.
        const columnsToAdd = [
            "college TEXT",
            "college_other TEXT",
            "degree TEXT",
            "degree_other TEXT",
            "department TEXT",
            "department_other TEXT",
            "year TEXT",
            "checked_in INTEGER DEFAULT 0",
            "checkin_time TEXT",
            "source TEXT DEFAULT 'WEB'",
            "sync_status INTEGER DEFAULT 1",
            "payment_verified INTEGER DEFAULT 0",
            "participated INTEGER DEFAULT 0",
            "team_name TEXT",
            "team_members TEXT"
        ];

        columnsToAdd.forEach(colDef => {
            try {
                const colName = colDef.split(' ')[0];
                db.execSync(`ALTER TABLE participants ADD COLUMN ${colDef};`);
            } catch (e: any) {
                if (!e.message?.includes('duplicate column name')) {
                    // console.log(`Column exists or error: ${e.message}`);
                }
            }
        });

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

// Insert a participant with extended fields
export const insertParticipant = (
    uid: string,
    event_id: string,
    name: string,
    phone: string,
    email: string,
    college: string = '',
    college_other: string = '',
    degree: string = '',
    degree_other: string = '',
    department: string = '',
    department_other: string = '',
    year: string = '',
    source: 'WEB' | 'ONSPOT' | 'IMPORT' = 'WEB',
    sync_status: number = 1,
    checked_in: number = 0,
    team_name: string = '',
    team_members: string = '' // Store as JSON string or comma separated
) => {
    if (Platform.OS === 'web') {
        const exists = webParticipants.find(p => p.uid === uid && p.event_id === event_id);
        if (!exists) {
            webParticipants.push({
                uid, event_id, name, phone, email,
                college, college_other, degree, degree_other,
                department, department_other, year,
                source, sync_status, checked_in, checkin_time: null,
                payment_verified: 0, participated: 0,
                team_name, team_members
            });
            saveWebData();
        }
        return;
    }
    if (!db) return;

    try {
        db.runSync(
            `INSERT OR IGNORE INTO participants 
            (uid, event_id, name, phone, email, college, college_other, degree, degree_other, 
             department, department_other, year, source, sync_status, checked_in, team_name, team_members) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [uid, event_id, name, phone, email, college, college_other, degree, degree_other,
                department, department_other, year, source, sync_status, checked_in, team_name, team_members]
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
export const markCheckedIn = (uid: string, eventId?: string) => {
    if (Platform.OS === 'web') {
        const p = webParticipants.find(p => p.uid === uid && (!eventId || p.event_id === eventId));
        if (p) {
            p.checked_in = 1;
            p.checkin_time = new Date().toISOString();
            saveWebData();
        }
        return;
    }
    if (!db) return;
    if (!eventId) {
        console.warn("markCheckedIn called without eventId, might affect multiple records");
    }

    const timestamp = new Date().toISOString();
    try {
        db.runSync(
            `UPDATE participants 
             SET checked_in = 1, checkin_time = ? 
             WHERE uid = ? ${eventId ? 'AND event_id = ?' : ''};`,
            eventId ? [timestamp, uid, eventId] : [timestamp, uid]
        );
    } catch (e) {
        console.error("Check-in failed", e);
    }
};

// Mark participant as participated (verified and allowed entry)
// !! CRITICAL: Must scope by event_id now
export const markParticipated = (uid: string, eventId?: string) => {
    if (Platform.OS === 'web') {
        const p = webParticipants.find(p => p.uid === uid && (!eventId || p.event_id === eventId));
        if (p) {
            p.participated = 1;
            p.checked_in = 1;
            p.checkin_time = new Date().toISOString();
            saveWebData();
        }
        return;
    }
    if (!db) return;

    // We should really require eventId here to be safe
    // But for backward compat, we handle optional (though it's risky)

    const timestamp = new Date().toISOString();
    try {
        const query = `UPDATE participants 
             SET participated = 1, checked_in = 1, checkin_time = ? 
             WHERE uid = ? ${eventId ? 'AND event_id = ?' : ''};`;

        const params = eventId ? [timestamp, uid, eventId] : [timestamp, uid];

        db.runSync(query, params);
        console.log(`Marked participated: ${uid} for ${eventId || 'any'}`);
    } catch (e) {
        console.error("Mark participated failed", e);
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
export const getEventParticipantCount = async (eventId: string): Promise<{ total: number; checkedIn: number }> => {
    if (Platform.OS === 'web') {
        const eventParticipants = webParticipants.filter(p => p.event_id === eventId);
        const checkedIn = eventParticipants.filter(p => p.checked_in === 1).length;
        return { total: eventParticipants.length, checkedIn };
    }
    if (!db) return { total: 0, checkedIn: 0 };

    try {
        const totalResult = db.getFirstSync(
            `SELECT COUNT(*) as count FROM participants WHERE event_id = ?;`,
            [eventId]
        );
        const checkedInResult = db.getFirstSync(
            `SELECT COUNT(*) as count FROM participants WHERE event_id = ? AND checked_in = 1;`,
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
