#!/bin/bash

# Quick Build Script - One Command Compilation
# Usage: ./quick_build.sh [linux|windows]

PLATFORM=${1:-linux}

echo "🔨 Quick Build for $PLATFORM"

# Install PyInstaller if not present
python3 -m pip install --user pyinstaller pillow qrcode 2>/dev/null || pip3 install --user pyinstaller pillow qrcode

# Clean old builds
rm -rf build dist *.spec

# Build based on platform
if [ "$PLATFORM" = "windows" ]; then
    echo "Building Windows executable..."
    pyinstaller --onefile --windowed --name=ZorphixRegistration onspot_registration_fixed.py
    echo "✅ Done! Check dist/ZorphixRegistration.exe"
else
    echo "Building Linux executable..."
    pyinstaller --onefile --windowed --name=ZorphixRegistration onspot_registration_fixed.py
    echo "✅ Done! Check dist/ZorphixRegistration"
    chmod +x dist/ZorphixRegistration
fi