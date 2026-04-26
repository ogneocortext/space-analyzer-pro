# Space Analyzer - Enhanced Build System with Modern Features
# Research-Backed Improvements: SIMD, Work Stealing, Memory Mapping, AI Analysis
# Optimized for Windows 11 + Visual Studio 2026 + C++20

cmake_minimum_required(VERSION 3.25)
project(SpaceAnalyzer VERSION 3.1.0 LANGUAGES CXX)

# Enable modern CMake features
cmake_policy(VERSION 3.25)
cmake_policy(SET CMP0167 NEW)  # FindPkgConfig: Use modern pkg-config

# C++20 Configuration with Modern Features
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Advanced compiler flags with research-based optimizations
if(CMAKE_CXX_COMPILER_ID MATCHES "MSVC")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /W4 /permissive- /Zc:__cplusplus /D_CRT_SECURE_NO_WARNINGS")
    set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} /O2 /DNDEBUG /EHsc /MP /MT")
    set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} /Od /RTC1 /EHsc /MTd")

    # Enable AVX2 for SIMD optimizations
    if(CMAKE_SYSTEM_PROCESSOR MATCHES "AMD64|x64")
        set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /arch:AVX2")
    endif()
elseif(CMAKE_CXX_COMPILER_ID MATCHES "GNU")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -Wextra -Wpedantic")
    set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -O3 -DNDEBUG -mavx2 -mfma")
    set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} -O0 -g")
endif()

# Build configuration options with enhanced features
option(ENABLE_PARALLEL_BUILD "Enable parallel processing optimization" ON)
option(ENABLE_PROFILING "Enable performance profiling" OFF)
option(ENABLE_SECURITY_SCAN "Enable security scanning features" ON)
option(ENABLE_MODERN_CPP "Enable C++20 modern features" ON)
option(ENABLE_SIMD_OPTIMIZATION "Enable SIMD optimizations for batch processing" ON)
option(ENABLE_MEMORY_MAPPING "Enable memory-mapped I/O for large files" ON)
option(ENABLE_AI_ANALYSIS "Enable AI-powered file analysis" ON)
option(ENABLE_WORK_STEALING "Enable work-stealing thread pool" ON)
option(ENABLE_UNIT_TESTS "Build unit tests" OFF)
option(ENABLE_SIMPLE_TESTS "Build simple standalone tests" OFF)
option(ENABLE_COMPREHENSIVE_TESTS "Build comprehensive test suite" OFF)

# Architecture and platform detection
if(CMAKE_SYSTEM_NAME STREQUAL "Windows")
    set(WINDOWS TRUE)
    set(PLATFORM_SUFFIX "-win64")
elseif(CMAKE_SYSTEM_NAME STREQUAL "Linux")
    set(LINUX TRUE)
    set(PLATFORM_SUFFIX "-linux64")
endif()

# Include directories with modern structure
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/src)
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/src/common)
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/src/cpp)
# Note: Root directory headers are included via target-specific includes

# Add core library subdirectory
add_subdirectory(src/common)

# Qt6 configuration for Windows MSVC - Use verified installation path
# Based on CPP Build Guide: Qt6 is installed at C:\Qt\6.10.1\msvc2022_64\
set(QT6_ROOT "C:/Qt/6.10.1/msvc2022_64")
set(CMAKE_PREFIX_PATH "${QT6_ROOT}")
set(Qt6_DIR "${QT6_ROOT}/lib/cmake/Qt6")

# Find Qt6 with comprehensive error handling
if(EXISTS "${QT6_ROOT}")
    find_package(Qt6 COMPONENTS Core Widgets Gui Concurrent Network Test QUIET)
    if(Qt6_FOUND)
        message(STATUS "Qt6 found: ${Qt6_VERSION} at ${QT6_ROOT}")
        message(STATUS "Qt6 Test framework: ${Qt6Test_FOUND}")
    else()
        message(WARNING "Qt6 installation found at ${QT6_ROOT} but CMake package not available")
        message(WARNING "Building console-only version without GUI components")
    endif()
else()
    message(WARNING "Qt6 not found at expected location: ${QT6_ROOT}")
    message(WARNING "Building console-only version without GUI components")
    set(Qt6_FOUND FALSE)
endif()



# Modern C++20 source files (main executable only)
set(CORE_SOURCES
    src/cpp/space-analyzer-main.cpp
    src/cpp/space-scanner.cpp
)

# Enhanced core header for modern features
set(ENHANCED_HEADERS
    src/cpp/space-scanner.h
    src/cpp/enhanced-space-scanner.h
)

# GUI sources (Qt6-based enhanced)
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/src/gui/enhanced-space-analyzer-gui.h")
    set(GUI_SOURCES
        src/gui/main.cpp
        src/gui/enhanced-space-analyzer-gui.cpp
        src/gui/enhanced-space-analyzer-gui.h
    )
elseif(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/src/gui/space-analyzer-gui.h")
    set(GUI_SOURCES
        src/gui/main.cpp
        src/gui/space-analyzer-gui.cpp
        src/gui/space-analyzer-gui.h
    )
endif()

# Test sources
set(UNIFIED_TEST_SOURCES
    tests/space-analyzer-unified-tests.cpp
)

# Main executable targets
add_executable(space_analyzer_ai_enhanced ${CORE_SOURCES} ${ENHANCED_HEADERS})

# Include root directory for headers needed by main executable
target_include_directories(space_analyzer_ai_enhanced PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})

# Link main executable to core library
target_link_libraries(space_analyzer_ai_enhanced PRIVATE space_analyzer_core)

# Enhanced Windows linking with security features
if(WINDOWS)
    target_link_libraries(space_analyzer_ai_enhanced PRIVATE
        kernel32
        user32
        advapi32
        shell32
        ole32
        oleaut32
        uuid
        comctl32
        comdlg32
        winspool
        psapi
        version
    )

    # Security and modern Windows features
    if(ENABLE_SECURITY_SCAN)
        target_compile_definitions(space_analyzer_ai_enhanced PRIVATE ENABLE_SECURITY_SCAN)
    endif()

    if(ENABLE_PARALLEL_BUILD)
        target_compile_definitions(space_analyzer_ai_enhanced PRIVATE ENABLE_PARALLEL_BUILD)
    endif()
    
    if(ENABLE_SIMD_OPTIMIZATION)
        target_compile_definitions(space_analyzer_ai_enhanced PRIVATE ENABLE_SIMD_OPTIMIZATION)
    endif()
    
    if(ENABLE_MEMORY_MAPPING)
        target_compile_definitions(space_analyzer_ai_enhanced PRIVATE ENABLE_MEMORY_MAPPING)
    endif()
    
    if(ENABLE_AI_ANALYSIS)
        target_compile_definitions(space_analyzer_ai_enhanced PRIVATE ENABLE_AI_ANALYSIS)
    endif()
    
    if(ENABLE_WORK_STEALING)
        target_compile_definitions(space_analyzer_ai_enhanced PRIVATE ENABLE_WORK_STEALING)
    endif()
endif()

# GUI Application (Win32-based, no Qt6 required)
if(GUI_SOURCES AND EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/src/gui/CMakeLists.txt")
    add_subdirectory(src/gui)
else()
    message(STATUS "Win32 GUI sources not found")
endif()

# Unified test executable
if(ENABLE_SIMPLE_TESTS OR ENABLE_COMPREHENSIVE_TESTS)
    add_executable(space_analyzer_tests ${UNIFIED_TEST_SOURCES} ${ENHANCED_HEADERS})

    if(WINDOWS)
        target_link_libraries(space_analyzer_tests PRIVATE
            kernel32
            user32
            advapi32
            shell32
            ole32
            oleaut32
            uuid
            comctl32
            comdlg32
            winspool
            psapi
            version
        )
    endif()

    # Add compile definitions based on enabled test levels
    if(ENABLE_COMPREHENSIVE_TESTS)
        target_compile_definitions(space_analyzer_tests PRIVATE ENABLE_ADVANCED_TESTS ENABLE_INTEGRATION_TESTS)
    elseif(ENABLE_SIMPLE_TESTS)
        target_compile_definitions(space_analyzer_tests PRIVATE ENABLE_BASIC_TESTS)
    endif()

    # Enhanced test features
    if(ENABLE_SIMD_OPTIMIZATION)
        target_compile_definitions(space_analyzer_tests PRIVATE ENABLE_SIMD_OPTIMIZATION)
    endif()

    if(ENABLE_MEMORY_MAPPING)
        target_compile_definitions(space_analyzer_tests PRIVATE ENABLE_MEMORY_MAPPING)
    endif()

    if(ENABLE_AI_ANALYSIS)
        target_compile_definitions(space_analyzer_tests PRIVATE ENABLE_AI_ANALYSIS)
    endif()
endif()

# Qt6 GUI Test executable (handled by src/gui/CMakeLists.txt)
# The test_qt6_gui_automated target is defined in src/gui/CMakeLists.txt
# to avoid duplicate target definitions
if(Qt6_FOUND AND Qt6Test_FOUND)
    option(ENABLE_QT6_GUI_TESTS "Build Qt6 GUI automated tests" ON)
    
    if(ENABLE_QT6_GUI_TESTS)
        message(STATUS "Qt6 GUI automated tests: ENABLED (via src/gui/CMakeLists.txt)")
        
        # Enable testing framework
        enable_testing()
        
        # Add test if the target exists
        if(TARGET test_qt6_gui_automated)
            add_test(NAME Qt6GUITest COMMAND test_qt6_gui_automated)
        endif()
    endif()
else()
    message(STATUS "Qt6 GUI automated tests: DISABLED (Qt6 Test not found)")
endif()

# Unit tests (legacy compatibility)
if(ENABLE_UNIT_TESTS)
    enable_testing()
    add_executable(space_analyzer_tests tests/test-space-analyzer.cpp)
    target_link_libraries(space_analyzer_tests PRIVATE space_analyzer_ai_enhanced)
    add_test(NAME SpaceAnalyzerTest COMMAND space_analyzer_tests)
endif()

# Modern install targets
install(TARGETS space_analyzer_ai_enhanced
    RUNTIME DESTINATION bin
)

if(TARGET space_analyzer_tests)
    install(TARGETS space_analyzer_tests
        RUNTIME DESTINATION bin
    )
endif()

install(FILES README.md
    DESTINATION share/doc/space-analyzer
)

# Build information and diagnostics with enhanced features
message(STATUS "")
message(STATUS "🚀 Space Analyzer Enhanced Build System")
message(STATUS "=========================================")
message(STATUS "CMake Version: ${CMAKE_VERSION}")
message(STATUS "Build Type: ${CMAKE_BUILD_TYPE}")
message(STATUS "Platform: ${CMAKE_SYSTEM_NAME} ${CMAKE_SYSTEM_PROCESSOR}")
message(STATUS "Compiler: ${CMAKE_CXX_COMPILER_ID} ${CMAKE_CXX_COMPILER_VERSION}")
message(STATUS "C++ Standard: ${CMAKE_CXX_STANDARD}")
message(STATUS "Architecture: ${CMAKE_SYSTEM_PROCESSOR}")
message(STATUS "")
message(STATUS "⚙️  Build Configuration:")
message(STATUS "  Parallel Build: ${ENABLE_PARALLEL_BUILD}")
message(STATUS "  Profiling: ${ENABLE_PROFILING}")
message(STATUS "  Security Scan: ${ENABLE_SECURITY_SCAN}")
message(STATUS "  Modern C++: ${ENABLE_MODERN_CPP}")
message(STATUS "  SIMD Optimization: ${ENABLE_SIMD_OPTIMIZATION}")
message(STATUS "  Memory Mapping: ${ENABLE_MEMORY_MAPPING}")
message(STATUS "  AI Analysis: ${ENABLE_AI_ANALYSIS}")
message(STATUS "  Work Stealing: ${ENABLE_WORK_STEALING}")
message(STATUS "  Unit Tests: ${ENABLE_UNIT_TESTS}")
message(STATUS "  Unified Tests: ${ENABLE_SIMPLE_TESTS} (basic) / ${ENABLE_COMPREHENSIVE_TESTS} (full)")
if(TARGET test_qt6_gui_automated)
    message(STATUS "  Qt6 GUI Tests: ENABLED")
else()
    message(STATUS "  Qt6 GUI Tests: DISABLED")
endif()
if(TARGET SpaceAnalyzerGUI)
    message(STATUS "  GUI Application: ENABLED (Win32)")
else()
    message(STATUS "  GUI Application: DISABLED")
endif()
message(STATUS "")
message(STATUS "🔬 Research-Based Enhancements:")
message(STATUS "  ✓ C++20 std::jthread for automatic thread management")
message(STATUS "  ✓ Lock-free concurrent data structures")
message(STATUS "  ✓ SIMD optimizations for batch file operations")
message(STATUS "  ✓ Memory-mapped I/O for large file processing")
message(STATUS "  ✓ Work-stealing thread pool for load balancing")
message(STATUS "  ✓ AI-powered file complexity and security analysis")
message(STATUS "  ✓ Hierarchical caching strategies")
message(STATUS "")
message(STATUS "📁 Output Directory: ${CMAKE_BINARY_DIR}")
message(STATUS "=========================================")
message(STATUS "")