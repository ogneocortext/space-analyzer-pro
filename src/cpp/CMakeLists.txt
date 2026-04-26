cmake_minimum_required(VERSION 3.20)
project(SpaceAnalyzerCpp VERSION 3.0.0 LANGUAGES CXX)

# Set C++ standard
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Set build type
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

# Compiler-specific options with performance optimizations
if(MSVC)
    add_compile_options(/W4 /WX /utf-8)
    add_compile_definitions(_CRT_SECURE_NO_WARNINGS)
    # Optimized MSVC flags for maximum performance
    add_compile_options(/O2 /Ob2 /DNDEBUG /GL /LTCG /arch:AVX2)
    add_compile_options(/fp:fast /Qpar /Oi)
    # Disable security checks for performance
    add_compile_options(/GS-)
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} /LTCG /OPT:REF /OPT:ICF")
else()
    add_compile_options(-Wall -Wextra -Werror)
    # Aggressive GCC/Clang optimizations
    add_compile_options(-O3 -DNDEBUG -march=native -mtune=native)
    add_compile_options(-flto=full -fomit-frame-pointer)
    add_compile_options(-ffast-math -funroll-loops)
    add_compile_options(-fvectorize -fslp-vectorize)
    # Link-time optimizations
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -flto=full -fuse-linker-plugin")
endif()

# Enable IPO/LTO for better optimization
set(CMAKE_INTERPROCEDURAL_OPTIMIZATION TRUE)

# Find required packages
find_package(Threads REQUIRED)

# Include directories
include_directories(${CMAKE_CURRENT_SOURCE_DIR})

# Source files
set(CORE_SOURCES
    space-analyzer-main.cpp
    space-scanner.cpp
    performance-monitoring.cpp
)

set(HEADERS
    space-scanner.h
    performance-monitoring.h
    cross-platform-abstraction.h
    memory-management.h
)

# Create main executable
add_executable(space-analyzer-cli ${CORE_SOURCES} ${HEADERS})

# Link libraries
target_link_libraries(space-analyzer-cli 
    Threads::Threads
)

# Platform-specific libraries
if(WIN32)
    target_link_libraries(space-analyzer-cli 
        kernel32
        user32
        shell32
        psapi
    )
elseif(UNIX AND NOT APPLE)
    target_link_libraries(space-analyzer-cli 
        pthread
        rt
    )
elseif(APPLE)
    target_link_libraries(space-analyzer-cli 
        pthread
    )
endif()

# Set output directory
set_target_properties(space-analyzer-cli PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin
    RUNTIME_OUTPUT_DIRECTORY_DEBUG ${CMAKE_BINARY_DIR}/bin
    RUNTIME_OUTPUT_DIRECTORY_RELEASE ${CMAKE_BINARY_DIR}/bin
)

# Installation
install(TARGETS space-analyzer-cli
    RUNTIME DESTINATION bin
    COMPONENT Runtime
)

# Custom targets
add_custom_target(run-cpp
    COMMAND space-analyzer-cli ${CMAKE_CURRENT_SOURCE_DIR}/../.. --parallel
    DEPENDS space-analyzer-cli
    WORKING_DIRECTORY ${CMAKE_BINARY_DIR}/bin
    COMMENT "Running C++ Space Analyzer"
)

add_custom_target(test-cpp
    COMMAND space-analyzer-cli ${CMAKE_CURRENT_SOURCE_DIR}/../.. --json test-output.json
    DEPENDS space-analyzer-cli
    WORKING_DIRECTORY ${CMAKE_BINARY_DIR}/bin
    COMMENT "Testing C++ Space Analyzer"
)

# Benchmark target
add_custom_target(benchmark-cpp
    COMMAND space-analyzer-cli ${CMAKE_CURRENT_SOURCE_DIR}/../.. --parallel
    DEPENDS space-analyzer-cli
    WORKING_DIRECTORY ${CMAKE_BINARY_DIR}/bin
    COMMENT "Benchmarking C++ Space Analyzer"
)

# Clean target
add_custom_target(clean-all
    COMMAND ${CMAKE_COMMAND} --build ${CMAKE_BINARY_DIR} --target clean
    COMMAND ${CMAKE_COMMAND} -E remove_directory ${CMAKE_BINARY_DIR}/bin
    COMMENT "Cleaning all build artifacts"
)

# Package configuration
set(CPACK_PACKAGE_NAME "SpaceAnalyzerCpp")
set(CPACK_PACKAGE_VERSION "${PROJECT_VERSION}")
set(CPACK_PACKAGE_DESCRIPTION_SUMMARY "High-performance C++ Space Analyzer")
set(CPACK_PACKAGE_VENDOR "Space Analyzer Pro")
set(CPACK_PACKAGE_CONTACT "support@spaceanalyzer.pro")

if(WIN32)
    set(CPACK_GENERATOR "NSIS;ZIP")
    set(CPACK_NSIS_DISPLAY_NAME "Space Analyzer C++ CLI")
    set(CPACK_NSIS_PACKAGE_NAME "SpaceAnalyzerCpp")
elseif(APPLE)
    set(CPACK_GENERATOR "DragNDrop;TGZ")
else()
    set(CPACK_GENERATOR "DEB;RPM;TGZ")
    set(CPACK_DEBIAN_PACKAGE_DEPENDS "libc6, libgcc1, libstdc++6")
    set(CPACK_RPM_PACKAGE_REQUIRES "glibc, libgcc, libstdc++")
endif()

include(CPack)

# Print configuration summary
message(STATUS "")
message(STATUS "Space Analyzer C++ Configuration Summary:")
message(STATUS "  Version: ${PROJECT_VERSION}")
message(STATUS "  Build Type: ${CMAKE_BUILD_TYPE}")
message(STATUS "  C++ Standard: ${CMAKE_CXX_STANDARD}")
message(STATUS "  Compiler: ${CMAKE_CXX_COMPILER_ID}")
message(STATUS "  Platform: ${CMAKE_SYSTEM_NAME}")
message(STATUS "  Architecture: ${CMAKE_SYSTEM_PROCESSOR}")
message(STATUS "  Install Prefix: ${CMAKE_INSTALL_PREFIX}")
message(STATUS "  Binary Output: ${CMAKE_BINARY_DIR}/bin")
message(STATUS "")