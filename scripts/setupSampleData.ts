/**
 * SQLite to Firestore Sync Script
 * 
 * Reads participant data from SQLite database and uploads to Firestore.
 * 
 * Run this script:
 * npx ts-node --skipProject scripts/syncSQLiteToFirestore.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import 'dotenv/config';

// Helper to handle ESM/CJS interop for XLSX
const getXLSX = () => {
    // @ts-ignore
    return XLSX.default || XLSX;
};

const firebaseConfig = {
    apiKey: "AIzaSyDu5oRJbf-gWqDZzMOK6HYmb0PBLXNqFEo",
    authDomain: "zorphix-8d91e.firebaseapp.com",
    projectId: "zorphix-8d91e",
    storageBucket: "zorphix-8d91e.firebasestorage.app",
    messagingSenderId: "1016587815374",
    appId: "1:1016587815374:web:4972ea556e5e781aaac39f",
    measurementId: "G-PK6GESKCSB"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);



// Interface for participant data
interface Participant {
    id?: number;
    name: string;
    email: string;
    phone: string;
    college: string;
    department: string;
    degree: string;
    year: number;
    events: string;
    registrationDate: string;
}

/**
 * Read participants from Excel file
 */
function readParticipantsFromExcel(): Participant[] {
    // Get file from command line args or default to 'data.xlsx'
    const fileName = process.argv[2] || 'data.xlsx';
    const EXCEL_PATH = path.isAbsolute(fileName)
        ? fileName
        : path.join(process.cwd(), fileName);

    // console.log(`\n📖 Reading from Excel file: ${EXCEL_PATH}`);

    if (!fs.existsSync(EXCEL_PATH)) {
        console.error(`❌ Excel file not found at: ${EXCEL_PATH}`);
        // console.log(`   Usage: npx ts-node scripts/setupSampleData.ts [filename]`);
        process.exit(1);
    }

    const XLSX_LIB = getXLSX();
    const workbook = XLSX_LIB.readFile(EXCEL_PATH);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rawData: any[] = XLSX_LIB.utils.sheet_to_json(sheet);
    // console.log(`✅ Read ${rawData.length} rows from Excel`);

    // Map to Participant interface
    return rawData.map(row => ({
        name: row['Name'] || '',
        email: row['Email'] || '',
        phone: String(row['Phone'] || ''),
        college: row['College'] || '',
        department: row['Department'] || '',
        degree: row['Degree'] || '',
        year: Number(row['Year']) || 0,
        events: row['Events'] || '',
        registrationDate: row['Registration Date'] || new Date().toISOString()
    })).filter(p => p.name && p.email);
}


/**
 * Upload participants to Firestore in batches
 * Firestore batch limit is 500 operations
 */
async function uploadParticipantsToFirestore(participants: Participant[]) {
    // console.log('\n🔄 Uploading participants to Firestore...\n');
    // console.log('='.repeat(60));

    const BATCH_SIZE = 500;
    let totalUploaded = 0;
    let batchCount = 0;

    try {
        // Process in batches
        for (let i = 0; i < participants.length; i += BATCH_SIZE) {
            const batch = writeBatch(db);
            const batchParticipants = participants.slice(i, i + BATCH_SIZE);
            batchCount++;

            for (const participant of batchParticipants) {
                // Use email as document ID (sanitized)
                const docId = participant.email.replace(/[@.]/g, '_');

                // Parse events string into array
                const eventsArray = participant.events
                    .split(',')
                    .map(e => e.trim())
                    .filter(e => e.length > 0);

                const participantData = {
                    name: participant.name,
                    email: participant.email.toLowerCase(),
                    phone: participant.phone,
                    college: participant.college,
                    department: participant.department,
                    degree: participant.degree,
                    year: participant.year,
                    events: eventsArray,
                    registrationDate: participant.registrationDate,
                    uploadedAt: new Date().toISOString(),
                    // Store original SQLite ID if you need to reference it later
                    sqliteId: participant.id || null
                };

                const docRef = doc(db, 'participants', docId);
                batch.set(docRef, participantData);
            }

            await batch.commit();
            totalUploaded += batchParticipants.length;

            // console.log(`✅ Batch ${batchCount}: Uploaded ${batchParticipants.length} participants (Total: ${totalUploaded}/${participants.length})`);
        }

        // console.log('='.repeat(60));
        // console.log(`\n✨ Participant Upload Complete! Uploaded ${totalUploaded} participants in ${batchCount} batches`);

        return totalUploaded;
    } catch (error: any) {
        console.error(`\n❌ Error uploading to Firestore: ${error.message}`);
        throw error;
    }
}

/**
 * Create event-wise participant collections
 * This creates a sub-collection under each event with registered participants
 */
async function createEventWiseCollections(participants: Participant[]) {
    // console.log('\n📊 Creating event-wise participant collections...\n');
    // console.log('='.repeat(60));

    // Group participants by event
    const eventParticipants = new Map<string, Participant[]>();

    for (const participant of participants) {
        const events = participant.events
            .split(',')
            .map(e => e.trim())
            .filter(e => e.length > 0);

        for (const event of events) {
            if (!eventParticipants.has(event)) {
                eventParticipants.set(event, []);
            }
            eventParticipants.get(event)!.push(participant);
        }
    }

    let eventCount = 0;

    for (const [eventName, eventParts] of eventParticipants.entries()) {
        try {
            const batch = writeBatch(db);

            // Create event document
            const eventDocId = eventName.toLowerCase().replace(/\s+/g, '_').replace(/°/g, '');
            const eventDocRef = doc(db, 'events', eventDocId);

            batch.set(eventDocRef, {
                name: eventName,
                participantCount: eventParts.length,
                lastUpdated: new Date().toISOString()
            });

            // Add participants to event's sub-collection (first 500 only due to batch limit)
            const batchLimit = Math.min(eventParts.length, 499); // Reserve 1 for event doc

            for (let i = 0; i < batchLimit; i++) {
                const participant = eventParts[i];
                const participantDocId = participant.email.replace(/[@.]/g, '_');
                const participantRef = doc(db, 'events', eventDocId, 'participants', participantDocId);

                batch.set(participantRef, {
                    name: participant.name,
                    email: participant.email.toLowerCase(),
                    phone: participant.phone,
                    college: participant.college,
                    registrationDate: participant.registrationDate
                });
            }

            await batch.commit();

            // If more than 499 participants, handle remaining in additional batches
            if (eventParts.length > 499) {
                for (let i = 499; i < eventParts.length; i += 500) {
                    const additionalBatch = writeBatch(db);
                    const remainingParts = eventParts.slice(i, i + 500);

                    for (const participant of remainingParts) {
                        const participantDocId = participant.email.replace(/[@.]/g, '_');
                        const participantRef = doc(db, 'events', eventDocId, 'participants', participantDocId);

                        additionalBatch.set(participantRef, {
                            name: participant.name,
                            email: participant.email.toLowerCase(),
                            phone: participant.phone,
                            college: participant.college,
                            registrationDate: participant.registrationDate
                        });
                    }

                    await additionalBatch.commit();
                }
            }

            eventCount++;
            // console.log(`✅ ${eventName}: ${eventParts.length} participants`);
        } catch (error: any) {
            console.error(`❌ Failed to create collection for ${eventName}: ${error.message}`);
        }
    }

    // console.log('='.repeat(60));
    // console.log(`\n✨ Event Collections Complete! Created ${eventCount} event collections`);
}

/**
 * Verify uploaded data
 */
async function verifyData() {
    // console.log('\n🔍 Verifying Firestore data...\n');
    // console.log('='.repeat(60));

    try {
        // Verify participants
        const participantSnapshot = await getDocs(collection(db, 'participants'));
        // console.log(`\n📌 Participants: ${participantSnapshot.size} records`);

        // Verify events
        const eventsSnapshot = await getDocs(collection(db, 'events'));
        // console.log(`📌 Events: ${eventsSnapshot.size} events`);

        // Show sample participant
        if (participantSnapshot.size > 0) {
            const firstDoc = participantSnapshot.docs[0];
            // console.log('\n📄 Sample Participant:');
            // console.log(JSON.stringify(firstDoc.data(), null, 2));
        }

        // console.log('\n' + '='.repeat(60));
    } catch (error: any) {
        console.error('Error reading data:', error.message);
    }
}

/**
 * Main execution
 */
async function main() {
    // console.log('\n🎯 EXCEL → FIRESTORE SYNC');
    // console.log('='.repeat(60));
    // console.log(`Database: ${DB_PATH}`); // No DB
    // console.log(`Firebase Project: ${firebaseConfig.projectId}`);
    // console.log('='.repeat(60));

    try {
        // Step 1: Read from Excel
        const participants = readParticipantsFromExcel();

        if (participants.length === 0) {
            console.warn('\n⚠️  No participants found in Excel. Nothing to upload.');
            process.exit(0);
        }

        // Step 2: Upload participants to Firestore
        await uploadParticipantsToFirestore(participants);

        // Step 3: Create event-wise collections
        await createEventWiseCollections(participants);

        // Step 4: Verify everything
        await verifyData();

        // console.log('\n✅ SYNC COMPLETE!\n');
        process.exit(0);
    } catch (error: any) {
        console.error('\n❌ SYNC FAILED:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();