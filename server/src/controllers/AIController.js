/**
 * AI Controller
 * Handles AI-related API endpoints
 */

class AIController {
    constructor(aiService) {
        this.aiService = aiService;
    }

    async analyzeFiles(req, res) {
        try {
            const { files, options } = req.body;
            
            if (!files || !Array.isArray(files)) {
                return res.status(400).json({
                    success: false,
                    error: 'Files array is required'
                });
            }

            const result = await this.aiService.analyzeFiles(files, options);
            
            res.json(result);
        } catch (error) {
            console.error('Error in AI analysis:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getRecommendations(req, res) {
        try {
            const { analysisData } = req.body;
            
            if (!analysisData) {
                return res.status(400).json({
                    success: false,
                    error: 'Analysis data is required'
                });
            }

            const recommendations = await this.aiService.getRecommendations(analysisData);
            
            res.json({
                success: true,
                data: recommendations
            });
        } catch (error) {
            console.error('Error getting recommendations:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async detectPatterns(req, res) {
        try {
            const { files } = req.body;
            
            if (!files || !Array.isArray(files)) {
                return res.status(400).json({
                    success: false,
                    error: 'Files array is required'
                });
            }

            const patterns = await this.aiService.detectPatterns(files);
            
            res.json({
                success: true,
                data: patterns
            });
        } catch (error) {
            console.error('Error detecting patterns:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getStatus(req, res) {
        try {
            const status = this.aiService.getStatus();
            
            res.json({
                success: true,
                data: status
            });
        } catch (error) {
            console.error('Error getting AI status:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async initialize(req, res) {
        try {
            await this.aiService.initialize();
            
            res.json({
                success: true,
                message: 'AI Service initialized successfully'
            });
        } catch (error) {
            console.error('Error initializing AI service:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = AIController;
