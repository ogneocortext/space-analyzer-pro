cmake_minimum_required(VERSION 3.15)
project(NativeScanner CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find Node.js and N-API
find_package(NodeJs REQUIRED)

# Include directories
include_directories(
    ${NODE_INCLUDE_DIRS}
    ${CMAKE_CURRENT_SOURCE_DIR}/src
)

# Source files
set(SOURCES
    src/native_scanner.cpp
)

# Create the library
add_library(${PROJECT_NAME} SHARED ${SOURCES})

# N-API definitions
target_compile_definitions(${PROJECT_NAME} PRIVATE
    NAPI_VERSION=4
    NAPI_DISABLE_CPP_EXCEPTIONS
    _HAS_EXCEPTIONS=0
)

# Windows-specific settings
if(WIN32)
    target_compile_definitions(${PROJECT_NAME} PRIVATE
        NOMINMAX
        WIN32_LEAN_AND_MEAN
    )
    
    # Optimization flags
    target_compile_options(${PROJECT_NAME} PRIVATE
        /O2
        /GL
        /arch:AVX2
        /fp:fast
        /Gw
        /Zc:inline
        /permissive-
        /bigobj
    )
    
    # Linker flags
    target_link_options(${PROJECT_NAME} PRIVATE
        /LTCG
        /OPT:REF
        /OPT:ICF
    )
else()
    # Linux/Mac flags
    target_compile_options(${PROJECT_NAME} PRIVATE
        -O3
        -march=native
        -ffast-math
        -flto
    )
endif()

# Link against Node.js libraries
target_link_libraries(${PROJECT_NAME} ${NODE_LIBRARIES})

# Set output name
set_target_properties(${PROJECT_NAME} PROPERTIES
    PREFIX ""
    OUTPUT_NAME "native_scanner"
    SUFFIX ".node"
)
