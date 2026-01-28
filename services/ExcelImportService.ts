
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import { insertParticipant, checkParticipantExists } from './sqlite';
import { Alert } from 'react-native';

export const importFromExcel = async () => {
    try {
        // 1. Pick the file
        const result = await DocumentPicker.getDocumentAsync({
            type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'],
            copyToCacheDirectory: true
        });

        if (result.canceled) {
            console.log('User cancelled file picker');
            return 0;
        }

        const fileUri = result.assets[0].uri;

        // 2. Read file as Base64
        const fileContent = await FileSystem.readAsStringAsync(fileUri, {
            encoding: 'base64'
        });

        // 3. Parse Workbook
        const workbook = XLSX.read(fileContent, { type: 'base64' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // 4. Convert to JSON
        const data: any[] = XLSX.utils.sheet_to_json(sheet);

        if (!data || data.length === 0) {
            Alert.alert('Error', 'No data found in the Excel file.');
            return 0;
        }

        let totalImported = 0;
        let errors = 0;

        // 5. Iterate and Insert
        for (const row of data) {
            try {
                // Map columns
                // Expected: Name,Email,Phone,College,Department,Degree,Year,Events,Registration Date
                const name = row['Name'] || '';
                const email = row['Email'] || '';
                const phone = String(row['Phone'] || ''); // Ensure string
                const college = row['College'] || '';
                const dept = row['Department'] || '';
                const degree = row['Degree'] || '';
                const year = String(row['Year'] || '');
                const eventsString = row['Events'] || '';
                // const regDate = row['Registration Date']; // Unused for now

                if (!name && !email) {
                    // Skip empty rows
                    continue;
                }

                // Split events
                const events = eventsString.split(',').map((e: string) => e.trim()).filter((e: string) => e.length > 0);

                if (events.length === 0) {
                    // Start with 'General' or just skip? 
                    // If no event, maybe we can't insert into simplified schema which requires event_id
                    // But maybe we skip.
                    continue;
                }

                for (const eventName of events) {
                    // Generate UID (Composite logic or consistent with other imports)
                    // We use email or phone as base.
                    // To avoid collisions with Firestore UIDs, we can use a prefix 'EXCEL_'
                    // or just use the email as the UID if we want to treat it as "Source of Truth"
                    // The prompt implies this Excel replaces Firebase.
                    const uid = `EXCEL_${email.replace(/[@.]/g, '_')}`;

                    // Check if exists
                    const exists = await checkParticipantExists(email, phone, eventName);
                    if (!exists) {
                        insertParticipant(
                            uid,
                            eventName,
                            name,
                            phone,
                            email,
                            college,
                            degree,
                            dept,
                            year,
                            'IMPORT', // Source
                            1, // sync_status (Marked as synced because it comes from "Server" equivalent file)
                            0, // payment_verified (Unknown, default 0)
                            0, // participated
                            '', // team_name
                            '', // team_members
                            'free' // event_type (Default)
                        );
                        totalImported++;
                    }
                }

            } catch (rowError) {
                console.error('Error importing row:', rowError);
                errors++;
            }
        }

        Alert.alert(
            'Import Complete',
            `Successfully imported ${totalImported} entries.${errors > 0 ? `\n${errors} errors encountered.` : ''}`
        );

        return totalImported;

    } catch (error) {
        console.error('Excel Import Failed:', error);
        Alert.alert('Import Failed', 'An error occurred while reading the Excel file.');
        return 0;
    }
};
