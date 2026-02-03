#!/bin/bash

# Zorphix On-Spot Registration - Linux Build Script
# This script builds the application into a standalone Linux binary

echo "======================================"
echo "Zorphix Registration - Build Script"
echo "======================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

echo "✓ Python 3 found"

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is not installed. Please install pip3 first."
    exit 1
fi

echo "✓ pip3 found"

# Install dependencies
echo ""
echo "📦 Installing required dependencies..."
pip3 install --user pillow qrcode pyinstaller

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✓ Dependencies installed"

# Clean previous builds
echo ""
echo "🧹 Cleaning previous builds..."
rm -rf build/ dist/ __pycache__/ *.spec

# Build the application
echo ""
echo "🔨 Building application..."
echo "   This may take a few minutes..."

pyinstaller --onefile \
    --windowed \
    --name="ZorphixRegistration" \
    --hidden-import=PIL._tkinter_finder \
    --hidden-import=tkinter \
    --hidden-import=tkinter.ttk \
    --hidden-import=tkinter.messagebox \
    --hidden-import=tkinter.filedialog \
    onspot_registration_fixed.py

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

# Check if executable was created
if [ -f "dist/ZorphixRegistration" ]; then
    echo ""
    echo "✅ Build successful!"
    echo ""
    echo "📁 Your executable is located at:"
    echo "   $(pwd)/dist/ZorphixRegistration"
    echo ""
    echo "🚀 To run the application:"
    echo "   cd dist"
    echo "   ./ZorphixRegistration"
    echo ""
    echo "📝 Note: Make sure to keep the database and backup files"
    echo "   in the same directory as the executable."
    echo ""
else
    echo "❌ Executable not found in dist/ folder"
    exit 1
fi