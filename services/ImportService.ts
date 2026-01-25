import { insertParticipant, checkParticipantExists } from './sqlite';
import { ExportData } from './ExportService';

export interface ImportResult {
    totalImported: number;
    duplicates: number;
    errors: number;
    parts: number[];
}

// Track imported parts to handle multi-QR imports
let importBuffer: Map<string, ExportData[]> = new Map();

/**
 * Parse and validate QR data
 */
const parseQRData = (qrString: string): ExportData | null => {
    try {
        const data = JSON.parse(qrString) as ExportData;

        // Validate structure
        if (!data.part || !data.total || !data.event || !Array.isArray(data.items)) {
            return null;
        }

        return data;
    } catch (error) {
        console.error('Failed to parse QR data:', error);
        return null;
    }
};

/**
 * Import participants from scanned QR code
 * Handles multi-part QR imports
 */
export const importFromQR = async (
    qrString: string,
    eventName: string
): Promise<ImportResult> => {
    const data = parseQRData(qrString);

    if (!data) {
        throw new Error('Invalid QR code format');
    }

    // Check if event matches
    if (data.event !== eventName) {
        throw new Error(`QR code is for event "${data.event}" but current event is "${eventName}"`);
    }

    // Create buffer key
    const bufferKey = `${data.event}_${data.timestamp}`;

    // Initialize buffer if needed
    if (!importBuffer.has(bufferKey)) {
        importBuffer.set(bufferKey, []);
    }

    const buffer = importBuffer.get(bufferKey)!;

    // Check if this part already imported
    if (buffer.some(item => item.part === data.part)) {
        throw new Error(`Part ${data.part} already imported`);
    }

    // Add to buffer
    buffer.push(data);

    // Check if all parts received
    if (buffer.length === data.total) {
        // Sort by part number
        buffer.sort((a, b) => a.part - b.part);

        // Merge all items: [name, phone, email]
        const allItems = buffer.flatMap(item => item.items);

        // Import to database
        const result = await importParticipantsToDatabase(allItems, eventName);

        // Clear buffer
        importBuffer.delete(bufferKey);

        return {
            ...result,
            parts: buffer.map(item => item.part)
        };
    }

    // Return partial result
    return {
        totalImported: 0,
        duplicates: 0,
        errors: 0,
        parts: buffer.map(item => item.part)
    };
};

/**
 * Import participants into local database
 */
const importParticipantsToDatabase = async (
    items: [string, string, string][],
    eventName: string
): Promise<Omit<ImportResult, 'parts'>> => {
    let totalImported = 0;
    let duplicates = 0;
    let errors = 0;

    for (const item of items) {
        try {
            const [name, phone, email] = item;

            // Generate UID for imported user
            // We use a prefix to distinguish, but maybe we should try to match existing format if possible?
            // "IMPORT_Event_Email" is fine.
            const uid = `IMPORT_${eventName.replace(/\s+/g, '')}_${(email || phone).replace(/[@.]/g, '_')}`;

            // Check if already exists by Email OR Phone (Strict Check)
            const exists = await checkParticipantExists(email, phone, eventName);
            if (exists) {
                duplicates++;
                continue;
            }

            // Try to insert
            insertParticipant(
                uid,
                eventName,
                name || email.split('@')[0],
                phone,
                email,
                '', // college
                '', // degree
                '', // dept
                '', // year
                'IMPORT', // Source
                1, // sync_status
                0, // payment_verified
                0, // participated
                '', // team_name
                '', // team_members
                'free' // event_type
            );

            totalImported++;
        } catch (error: any) {
            console.error(`Failed to import ${item[2]}:`, error);
            errors++;
        }
    }

    return {
        totalImported,
        duplicates,
        errors
    };
};

/**
 * Get import progress for multi-part QR codes
 */
export const getImportProgress = (eventName: string, timestamp: string): {
    partsReceived: number[];
    totalParts: number | null;
} => {
    const bufferKey = `${eventName}_${timestamp}`;
    const buffer = importBuffer.get(bufferKey);

    if (!buffer || buffer.length === 0) {
        return {
            partsReceived: [],
            totalParts: null
        };
    }

    return {
        partsReceived: buffer.map(item => item.part).sort((a, b) => a - b),
        totalParts: buffer[0].total
    };
};

/**
 * Clear import buffer (useful for canceling multi-part import)
 */
export const clearImportBuffer = () => {
    importBuffer.clear();
};
