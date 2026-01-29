import { getAllParticipants } from './sqlite';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// QR code size limits (in characters for safe encoding)
// QR code size limits (in characters for safe encoding)
const MAX_QR_SIZE = 2200; // Increased limit slightly for better density

export interface ExportData {
    part: number;
    total: number;
    event: string;
    timestamp: string;
    // Array of [name, phone, email] for compactness
    items: [string, string, string][];
}

export interface ExportResult {
    qrDataArray: string[];
    totalParts: number;
    totalParticipants: number;
}

/**
 * Export all local participant data (Name, Phone, Email) as QR-encoded JSON
 * Splits into multiple parts if data is too large
 */
export const exportLocalData = async (eventName: string): Promise<ExportResult> => {
    try {
        // Get all participants from local DB
        const allParticipants = await getAllParticipants();

        // Deduplicate based on Email AND Phone
        // If multiple entries share keys, we take the first one found
        const uniqueMap = new Map<string, any>();

        allParticipants.forEach(p => {
            // Filter: Only include those who have PARTICIPATED
            if ((p.participated || 0) <= 0) return;

            if (!p.email && !p.phone) return;
            const key = `${p.email?.toLowerCase() || ''}_${p.phone || ''}`;
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, p);
            }
        });

        const uniqueParticipants = Array.from(uniqueMap.values());

        if (uniqueParticipants.length === 0) {
            return {
                qrDataArray: [],
                totalParts: 0,
                totalParticipants: 0
            };
        }

        // Prepare items for export: [name, phone, email]
        const exportItems: [string, string, string][] = uniqueParticipants.map(p => [
            p.name || '',
            p.phone || '',
            p.email || ''
        ]);

        // Calculate chunk size based on JSON structure overhead
        const testData: ExportData = {
            part: 1,
            total: 100,
            event: eventName,
            timestamp: new Date().toISOString(),
            items: [['Test Name', '1234567890', 'test@example.com']]
        };

        const baseOverhead = JSON.stringify(testData).length - JSON.stringify(testData.items).length;
        const itemOverhead = 4; // ["","",""], basically
        const avgItemSize = 60 + itemOverhead; // Estimate: Name(15) + Phone(10) + Email(25) + overhead

        const availableSize = MAX_QR_SIZE - baseOverhead;
        const itemsPerChunk = Math.floor(availableSize / avgItemSize);

        // Split items into chunks
        const chunks: [string, string, string][][] = [];
        for (let i = 0; i < exportItems.length; i += itemsPerChunk) {
            chunks.push(exportItems.slice(i, i + itemsPerChunk));
        }

        // Generate QR data for each chunk
        const qrDataArray = chunks.map((chunk, index) => {
            const data: ExportData = {
                part: index + 1,
                total: chunks.length,
                event: eventName,
                timestamp: new Date().toISOString(),
                items: chunk
            };
            return JSON.stringify(data);
        });

        return {
            qrDataArray,
            totalParts: chunks.length,
            totalParticipants: uniqueParticipants.length
        };
    } catch (error) {
        console.error('Export failed:', error);
        throw new Error('Failed to export data');
    }
};

// ... (previous content)
export const getExportSummary = async (): Promise<{
    totalParticipants: number;
    totalEmails: number;
}> => {
    try {
        const participants = await getAllParticipants();
        const emails = [...new Set(participants.map(p => p.email).filter(Boolean))];

        return {
            totalParticipants: participants.length,
            totalEmails: emails.length
        };
    } catch (error) {
        console.error('Failed to get export summary:', error);
        return {
            totalParticipants: 0,
            totalEmails: 0
        };
    }
};

/**
 * Export full local database to Excel file
 */
export const exportToExcel = async (): Promise<void> => {
    try {
        const participants = await getAllParticipants();

        if (participants.length === 0) {
            throw new Error('No data to export');
        }

        // Deduplicate: Use a Map to ensure unique entries based on uid and event_id
        // (Although DB has PK (uid, event_id), this is an extra safety and clean-up step)
        const uniqueParticipantsMap = new Map<string, any>();

        participants.forEach(p => {
            // Only include attended participants (participated > 0)
            if ((p.participated || 0) <= 0) return;

            const key = `${p.uid}_${p.event_id}`;
            if (!uniqueParticipantsMap.has(key)) {
                uniqueParticipantsMap.set(key, p);
            }
        });

        const uniqueParticipants = Array.from(uniqueParticipantsMap.values());

        if (uniqueParticipants.length === 0) {
            throw new Error('No attended participants to export');
        }

        // Format data to specific columns requested
        // event_id,Name,Phone,Email,College,Department,Year,Checkin Time,Source,Payment Verified,Participated,Team Name,Team Members,UID
        const formattedData = uniqueParticipants.map(p => {
            // Format checkin_time to 12hr format
            let formattedTime = '';
            if (p.checkin_time) {
                try {
                    const date = new Date(p.checkin_time);
                    formattedTime = date.toLocaleString('en-US', {
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: true,
                        day: 'numeric',
                        month: 'short'
                    });
                } catch (e) {
                    formattedTime = p.checkin_time;
                }
            }

            return {
                event_id: p.event_id,
                name: p.name,
                phone: p.phone,
                email: p.email,
                college: p.college,
                department: p.department,
                year: p.year,
                checkin_time: formattedTime, // Formatted 12hr time
                source: p.source,
                payment_verified: p.payment_verified,
                participated: p.participated,
                team_name: p.team_name,
                team_members: p.team_members,
                uid: p.uid
            };
        });

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(formattedData);
        XLSX.utils.book_append_sheet(wb, ws, "Participants");

        // Generate base64
        const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

        // Save to file
        const filename = `zorphix_participants_${new Date().getTime()}.xlsx`;
        const uri = FileSystem.cacheDirectory + filename;

        await FileSystem.writeAsStringAsync(uri, wbout, {
            encoding: FileSystem.EncodingType.Base64
        });

        // Share file
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
            await Sharing.shareAsync(uri, {
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                dialogTitle: 'Export DB to Excel',
                UTI: 'com.microsoft.excel.xlsx' // helpful for iOS
            });
        } else {
            throw new Error('Sharing is not available on this device');
        }

    } catch (error) {
        console.error('Excel export failed:', error);
        throw error;
    }
};
