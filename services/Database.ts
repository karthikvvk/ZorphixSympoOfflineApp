import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const initDB = async () => {
    try {
        db = await SQLite.openDatabaseAsync('zorphix.db');
        await db.execAsync(`
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
};

export const addUser = async (name: string, email: string, phone: string) => {
    if (!db) await initDB();
    if (!db) throw new Error('Database not initialized');

    try {
        const result = await db.runAsync(
            'INSERT INTO users (name, email, phone) VALUES (?, ?, ?)',
            name, email, phone
        );
        return result.lastInsertRowId;
    } catch (error) {
        console.error('Error adding user:', error);
        throw error;
    }
};

export const getUsers = async () => {
    if (!db) await initDB();
    if (!db) throw new Error('Database not initialized');

    try {
        const allRows = await db.getAllAsync('SELECT * FROM users ORDER BY created_at DESC');
        return allRows;
    } catch (error) {
        console.error('Error getting users:', error);
        throw error;
    }
};

export interface User {
    id: number;
    name: string;
    email: string;
    phone: string;
    created_at: string;
}
