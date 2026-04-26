#!/bin/bash

# Space Analyzer C++ Build Script
# Cross-platform build script for C++ components

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BUILD_TYPE=${BUILD_TYPE:-Release}
BUILD_DIR="build"
INSTALL_PREFIX=${INSTALL_PREFIX:-"/usr/local"}

echo -e "${BLUE}🚀 Space Analyzer C++ Build Script${NC}"
echo -e "${BLUE}=====================================${NC}"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "CMakeLists.txt" ]; then
    print_error "CMakeLists.txt not found. Please run this script from the src/cpp directory."
    exit 1
fi

# Detect platform
PLATFORM=$(uname -s)
case "$PLATFORM" in
    Linux*)
        PLATFORM="Linux"
        ;;
    Darwin*)
        PLATFORM="macOS"
        ;;
    CYGWIN*|MINGW*|MSYS*)
        PLATFORM="Windows"
        ;;
    *)
        print_error "Unsupported platform: $PLATFORM"
        exit 1
        ;;
esac

print_status "Detected platform: $PLATFORM"

# Check dependencies
print_status "Checking build dependencies..."

if command -v cmake >/dev/null 2>&1; then
    CMAKE_VERSION=$(cmake --version | head -n1 | cut -d' ' -f3)
    print_status "CMake found: $CMAKE_VERSION"
else
    print_error "CMake is required but not found. Please install CMake 3.20 or later."
    exit 1
fi

if command -v make >/dev/null 2>&1; then
    print_status "Make found"
else
    print_error "Make is required but not found. Please install make."
    exit 1
fi

# Check C++ compiler
if command -v g++ >/dev/null 2>&1; then
    GCC_VERSION=$(g++ --version | head -n1 | cut -d' ' -f4)
    print_status "GCC found: $GCC_VERSION"
elif command -v clang++ >/dev/null 2>&1; then
    CLANG_VERSION=$(clang++ --version | head -n1 | cut -d' ' -f3)
    print_status "Clang found: $CLANG_VERSION"
else
    print_error "No C++ compiler found. Please install GCC or Clang with C++20 support."
    exit 1
fi

# Create build directory
print_status "Creating build directory..."
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# Configure with CMake
print_status "Configuring project with CMake..."
cmake .. \
    -DCMAKE_BUILD_TYPE="$BUILD_TYPE" \
    -DCMAKE_INSTALL_PREFIX="$INSTALL_PREFIX" \
    -DCMAKE_EXPORT_COMPILE_COMMANDS=ON

if [ $? -ne 0 ]; then
    print_error "CMake configuration failed"
    exit 1
fi

# Build the project
print_status "Building project..."
make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

if [ $? -ne 0 ]; then
    print_error "Build failed"
    exit 1
fi

# Run tests if they exist
if [ -f "bin/space-analyzer-cli" ]; then
    print_status "Running basic test..."
    ./bin/space-analyzer-cli --help > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        print_status "Basic test passed"
    else
        print_warning "Basic test failed"
    fi
fi

# Install if requested
if [ "$1" = "install" ]; then
    print_status "Installing to $INSTALL_PREFIX..."
    
    if [ "$EUID" -ne 0 ]; then
        print_warning "Not running as root. You may need sudo for installation."
    fi
    
    make install
    
    if [ $? -eq 0 ]; then
        print_status "Installation completed"
    else
        print_error "Installation failed"
        exit 1
    fi
fi

# Create package if requested
if [ "$1" = "package" ]; then
    print_status "Creating package..."
    make package
    
    if [ $? -eq 0 ]; then
        print_status "Package created successfully"
        print_status "Package files:"
        find . -name "*.deb" -o -name "*.rpm" -o -name "*.tar.gz" -o -name "*.zip" | while read file; do
            echo "  - $file"
        done
    else
        print_error "Package creation failed"
        exit 1
    fi
fi

# Print summary
echo ""
print_status "Build completed successfully!"
echo ""
print_status "Build Summary:"
echo "  - Platform: $PLATFORM"
echo "  - Build Type: $BUILD_TYPE"
echo "  - Output Directory: $(pwd)/bin"
echo "  - Executable: bin/space-analyzer-cli"
echo ""

if [ -f "bin/space-analyzer-cli" ]; then
    print_status "Usage examples:"
    echo "  ./bin/space-analyzer-cli --help"
    echo "  ./bin/space-analyzer-cli /path/to/directory"
    echo "  ./bin/space-analyzer-cli /path/to/directory --parallel"
    echo "  ./bin/space-analyzer-cli /path/to/directory --json output.json"
    echo ""
fi

print_status "To install system-wide: ./build.sh install"
print_status "To create package: ./build.sh package"