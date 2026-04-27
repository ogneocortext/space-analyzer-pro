const path = require('path');
const { existsSync, statSync } = require('fs');
const crypto = require('crypto');
const { exec } = require('child_process');
const fg = require('fast-glob');
const { fileTypeFromFile } = require('file-type');
const diskusage = require('diskusage');
const filesize = require('filesize');

/**
 * Find project root directory
 * @param {string} startDir - Starting directory
 * @returns {string} Project root directory
 */
function findProjectRoot(startDir) {
    let currentDir = startDir;
    for (let i = 0; i < 10; i++) {
        const packageJsonPath = path.join(currentDir, 'package.json');
        const srcDir = path.join(currentDir, 'src');
        const cliDir = path.join(currentDir, 'cli');
        
        if (existsSync(packageJsonPath) && existsSync(srcDir) && existsSync(cliDir)) {
            return currentDir;
        }
        
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) break;
        currentDir = parentDir;
    }
    return path.dirname(__dirname);
}

/**
 * Validate if a path is safe
 * @param {string} p - Path to validate
 * @returns {boolean} Whether path is valid
 */
function isValidPath(p) {
    if (!p) return false;
    const dangerousPatterns = [/\.\.\./];
    return !dangerousPatterns.some(pattern => pattern.test(p));
}

/**
 * Generate file hash
 * @param {string} filePath - File path
 * @param {number} size - File size
 * @param {number} mtime - Modification time
 * @returns {string} File hash
 */
function generateFileHash(filePath, size, mtime) {
    const data = `${filePath}:${size}:${mtime}`;
    return crypto.createHash('md5').update(data).digest('hex').substring(0, 16);
}

/**
 * Find C++ executable for Rust CLI
 * @returns {Promise<string|null>} Path to executable or null
 */
async function findCppExecutable() {
    const possiblePaths = [
        path.join(__dirname, '..', 'bin', 'cpp-wrapper.exe'),
        path.join(__dirname, '..', 'bin', 'cpp-wrapper'),
        path.join(__dirname, '..', 'native', 'scanner', 'target', 'release', 'scanner.exe'),
        path.join(__dirname, '..', 'native', 'scanner', 'target', 'release', 'scanner')
    ];

    for (const execPath of possiblePaths) {
        if (existsSync(execPath)) {
            try {
                await new Promise((resolve, reject) => {
                    exec(`"${execPath}" --version`, (error) => {
                        if (error) reject(error);
                        else resolve(execPath);
                    });
                });
                return execPath;
            } catch (error) {
                console.log(`⚠️ Executable test failed for ${execPath}:`, error.message);
            }
        }
    }

    return null;
}

/**
 * Get directory files quickly using fast-glob
 * @param {string} directoryPath - Directory path
 * @param {Function} generateFileHash - Function to generate file hash
 * @returns {Promise<Array>} Array of file info
 */
async function getDirectoryFilesQuick(directoryPath, generateFileHash) {
    const { promises: fsPromises } = require('fs');
    const startTime = Date.now();

    try {
        // Use fast-glob for efficient file scanning
        const patterns = [
            '**/*',
            '!**/node_modules/**',
            '!**/.git/**',
            '!**/__pycache__/**',
            '!**/.next/**',
            '!**/dist/**',
            '!**/build/**',
            '!**/target/**'
        ];

        const filePaths = await fg(patterns, {
            cwd: directoryPath,
            absolute: true,
            onlyFiles: true,
            deep: 10
        });

        const files = [];
        for (const filePath of filePaths) {
            try {
                const stats = await fsPromises.stat(filePath);
                files.push({
                    path: filePath,
                    size: stats.size,
                    hash: generateFileHash(filePath, stats.size, stats.mtime.getTime()),
                    lastModified: stats.mtime.toISOString()
                });
            } catch (e) {
                // Skip files we can't access
            }
        }

        const duration = Date.now() - startTime;
        console.log(`⚡ Quick scan complete: ${files.length} files in ${duration}ms`);
        return files;
    } catch (error) {
        console.error('❌ Fast-glob scan failed, falling back to manual scan:', error.message);
        // Fallback to manual scan if fast-glob fails
        return getDirectoryFilesManual(directoryPath, generateFileHash);
    }
}

/**
 * Manual fallback for directory scanning
 * @param {string} directoryPath - Directory path
 * @param {Function} generateFileHash - Function to generate file hash
 * @returns {Promise<Array>} Array of file info
 */
async function getDirectoryFilesManual(directoryPath, generateFileHash) {
    const { promises: fsPromises } = require('fs');
    const files = [];
    const startTime = Date.now();

    const walk = async (dir, maxDepth = 10, currentDepth = 0) => {
        if (currentDepth >= maxDepth) return;

        try {
            const entries = await fsPromises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                try {
                    if (entry.isDirectory()) {
                        // Skip common exclusion directories
                        if (!['node_modules', '.git', '__pycache__', '.next', 'dist', 'build', 'target'].includes(entry.name) &&
                            !entry.name.startsWith('.') &&
                            currentDepth < maxDepth - 1) {
                            await walk(fullPath, maxDepth, currentDepth + 1);
                        }
                    } else {
                        const stats = await fsPromises.stat(fullPath);
                        files.push({
                            path: fullPath,
                            size: stats.size,
                            hash: generateFileHash(fullPath, stats.size, stats.mtime.getTime()),
                            lastModified: stats.mtime.toISOString()
                        });
                    }
                } catch (e) {
                    // Skip files we can't access
                }
            }
        } catch (e) {
            console.error(`❌ Failed to read directory ${dir}:`, e.message);
        }
    };

    await walk(directoryPath);
    const duration = Date.now() - startTime;
    console.log(`⚡ Manual scan complete: ${files.length} files in ${duration}ms`);
    return files;
}

/**
 * Get file type from magic numbers
 * @param {string} filePath - File path
 * @returns {Promise<Object|null>} File type info or null
 */
async function getFileType(filePath) {
    try {
        const type = await fileTypeFromFile(filePath);
        return type;
    } catch (error) {
        return null;
    }
}

/**
 * Get disk usage information
 * @param {string} path - Path to check
 * @returns {Promise<Object>} Disk usage info
 */
async function getDiskUsage(path) {
    try {
        const info = await diskusage.check(path);
        return {
            free: info.free,
            total: info.total,
            used: info.total - info.free,
            percentage: ((info.total - info.free) / info.total) * 100
        };
    } catch (error) {
        console.error('❌ Failed to get disk usage:', error.message);
        return null;
    }
}

/**
 * Format bytes to human readable string
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
    return filesize(bytes, { round: 2 });
}

module.exports = {
    findProjectRoot,
    isValidPath,
    generateFileHash,
    findCppExecutable,
    getDirectoryFilesQuick,
    getFileType,
    getDiskUsage,
    formatBytes
};
