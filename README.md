# Zorphix App - Technical Logic & Architecture

## Overview
The Zorphix App is an offline-first event management application built with React Native and Expo. It allows event organizers to manage registrations, verify participants via QR codes, and sync on-spot data to a central Firebase server. The core philosophy is **Local-First**: all critical operations (scanning, searching, registering) happen against a local SQLite database to ensure zero latency and offline reliability.

## Core Logic & Data Flow

### 1. Offline-First Architecture
*   **Local Database**: The app uses `expo-sqlite` to maintain a complete copy of participant data on the device.
*   **Source of Truth**: For the duration of the event, the local SQLite database acts as the immediate source of truth for verification.
*   **Performance**: Searching and QR scanning query the local SQL database, providing instant results regardless of network conditions.

### 2. Authentication System
*   **Local Auth**: Authentication is handled locally. The app verifies credentials against a pre-defined list of admin accounts stored within the application code.
*   **Role-Based Access**:
    *   **Master Admin** (`admin@zorphix.com`): Has global access, including the ability to perform a one-time bulk import from Excel.
    *   **Event Admins**: Restricted context to their specific events (e.g., Pixel Reforge, AlgoPulse).
    *   **On-Spot Desk**: Simplified interface purely for registering users.

### 3. Data Ingestion Strategy
Data enters the local system in two primary ways:
*   **One-Time Excel Import**: The Master Admin seeds the database by importing a master list `.xlsx` file. This populates the local SQLite database with all pre-registered web participants.
*   **On-Spot Registration**: New participants are registered directly via the app forms. These records are saved locally with a `sync_status` of `0` (Unsynced).

### 4. Synchronization Logic (Push-Only)
The app implements a specific "Push-Only" sync strategy to handle on-spot data:
*   **Direction**: Local Device → Firebase.
*   **Trigger**: The "Sync" button in the header.
*   **Process**:
    1.  The app queries the local SQLite database for records marked as `Unsynced` (sync_status = 0).
    2.  These records are uploaded to the Firestore `local_registrations` collection (or the main collection for imported data).
    3.  Once successfully uploaded, the local records are marked as `Synced`.
*   **Note**: The app does *not* pull data down from Firebase during the event to prevent overwriting local verification states or dealing with merge conflicts in real-time.

### 5. Verification System
*   **QR Scanning**:
    *   **Individual Mode**: Scans a participant's QR code, looks up their UID in the local SQLite db, and marks them as "Participated".
    *   **Team Mode**: Allows rapid scanning of multiple members to associate them with a single Team ID.
*   **Payment Verification**: Checks the `payment_verified` flag in the local database to grant or deny entry.

### 6. Export & Peer Share
*   **Excel Export**: The entire local database can be exported to an `.xlsx` file for backup or reporting.
*   **Import from Peers**: Devices can share their database state via generated QR codes or file sharing to keep multiple admin devices relatively consistent without relying on the central server.
