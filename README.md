# Zorphix App

A production-ready React Native Expo application for event management, featuring a premium Black & Gold design.

## Features

- **Authentication**: Secure Login with credentials (`admin` / `zorphix`).
- **Premium UI**: Custom Black and Gold theme with smooth transitions.
- **Local Database**: SQLite integration to store registration data locally.
- **QR Scanner**: Built-in camera scanner for event entry.
- **Registration**: Form to capture Name, Email, and Phone number.
- **Data Management**: View local records directly in the app.

## Prerequisites

- Node.js (LTS recommended)
- Expo Go app (SDK 54 compatible)

## Getting Started

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Start the application:**
    ```bash
    npx expo start --tunnel
    ```

3.  **Run on Device:**
    - Scan the QR code with your iOS Camera app (or Expo Go on Android).

## Usage

- **Login**: Use Username: `admin`, Password: `zorphix`.
- **Home**: Browse events, view the local database, or try the sync button.
- **Event Details**: Click an event to see details.
    - **Scan QR**: Opens the camera to scan codes.
    - **Register New**: Opens the form to add a new user to the local database.

## Troubleshooting

### iOS Connection Issues
If you see "ngrok tunnel took too long to connect":
1.  **Retry**: Run `npx expo start --tunnel` again.
2.  **Check Internet**: Ensure stable connection.
3.  **Local Host**: Run `npx expo start --host lan` and copy the URL (`exp://...`) into Safari on your iPhone.
