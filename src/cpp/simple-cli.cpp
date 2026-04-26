#include <iostream>
#include <fstream>
#include <string>
#include <vector>

// Simple directory traversal without filesystem for compatibility
#include <windows.h>

int main(int argc, char* argv[]) {
    std::cout << "🚀 Space Analyzer C++ CLI v3.0\n";
    std::cout << "================================\n";
    
    if (argc < 2) {
        std::cout << "Usage: space-analyzer-cli <directory>\n";
        std::cout << "Example: space-analyzer-cli C:\\Projects\n";
        return 1;
    }
    
    std::string directory = argv[1];
    
    if (!fs::exists(directory)) {
        std::cout << "❌ Error: Directory does not exist: " << directory << "\n";
        return 1;
    }
    
    std::cout << "📁 Analyzing: " << directory << "\n";
    
    try {
        size_t totalFiles = 0;
        size_t totalSize = 0;
        size_t totalDirs = 0;
        
        for (const auto& entry : fs::recursive_directory_iterator(directory)) {
            if (entry.is_regular_file()) {
                totalFiles++;
                totalSize += entry.file_size();
            } else if (entry.is_directory()) {
                totalDirs++;
            }
        }
        
        std::cout << "\n📊 Results:\n";
        std::cout << "  Total Files: " << totalFiles << "\n";
        std::cout << "  Total Directories: " << totalDirs << "\n";
        std::cout << "  Total Size: " << (totalSize / (1024.0 * 1024.0)) << " MB\n";
        std::cout << "✅ Analysis complete!\n";
        
        return 0;
        
    } catch (const std::exception& e) {
        std::cout << "❌ Error: " << e.what() << "\n";
        return 1;
    }
}