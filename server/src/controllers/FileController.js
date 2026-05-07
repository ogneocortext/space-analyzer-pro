/**
 * File Controller
 * Handles file-related API endpoints
 */

class FileController {
    constructor(fileScannerService, fileRepository) {
        this.fileScanner = fileScannerService;
        this.fileRepository = fileRepository;
    }

    async browseDirectory(req, res) {
        try {
            const { path: directoryPath } = req.query;
            
            if (!directoryPath) {
                return res.status(400).json({
                    success: false,
                    error: 'Directory path is required'
                });
            }

            const files = await this.fileScanner.scanDirectory(directoryPath);
            
            res.json({
                success: true,
                data: files
            });
        } catch (error) {
            console.error('Error browsing directory:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getFileDetails(req, res) {
        try {
            const { path: filePath } = req.query;
            
            if (!filePath) {
                return res.status(400).json({
                    success: false,
                    error: 'File path is required'
                });
            }

            const details = await this.fileScanner.getFileDetails(filePath);
            
            res.json({
                success: true,
                data: details
            });
        } catch (error) {
            console.error('Error getting file details:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async searchFiles(req, res) {
        try {
            const { query, path: searchPath } = req.query;
            
            if (!query) {
                return res.status(400).json({
                    success: false,
                    error: 'Search query is required'
                });
            }

            const results = await this.fileScanner.searchFiles(query, searchPath);
            
            res.json({
                success: true,
                data: results
            });
        } catch (error) {
            console.error('Error searching files:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async uploadFile(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No file uploaded'
                });
            }

            const fileData = {
                name: req.file.originalname,
                size: req.file.size,
                path: req.file.path,
                mimetype: req.file.mimetype,
                uploadedAt: new Date()
            };

            // Save file metadata to repository
            await this.fileRepository.saveFile(fileData);
            
            res.json({
                success: true,
                data: fileData
            });
        } catch (error) {
            console.error('Error uploading file:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async deleteFile(req, res) {
        try {
            const { path: filePath } = req.query;
            
            if (!filePath) {
                return res.status(400).json({
                    success: false,
                    error: 'File path is required'
                });
            }

            await this.fileScanner.deleteFile(filePath);
            
            res.json({
                success: true,
                message: 'File deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting file:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getFileStats(req, res) {
        try {
            const { path: directoryPath } = req.query;
            
            if (!directoryPath) {
                return res.status(400).json({
                    success: false,
                    error: 'Directory path is required'
                });
            }

            const stats = await this.fileScanner.getDirectoryStats(directoryPath);
            
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Error getting file stats:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = FileController;
