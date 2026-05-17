//! Ollama AI client for Space Analyzer Pro
//! 
//! Provides optional integration with local Ollama LLM for AI-powered
//! file analysis, cleanup recommendations, and natural language queries.
//! Works completely offline - no cloud services required.

use serde::{Deserialize, Serialize};

/// Ollama API client
pub struct OllamaClient {
    base_url: String,
    model: String,
    client: reqwest::Client,
}

/// Ollama chat message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

/// Ollama chat request
#[derive(Debug, Clone, Serialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub stream: bool,
    pub options: Option<OllamaOptions>,
}

/// Ollama model options
#[derive(Debug, Clone, Serialize)]
pub struct OllamaOptions {
    pub num_gpu: i32,
    pub temperature: f32,
}

/// Ollama chat response
#[derive(Debug, Clone, Deserialize)]
pub struct ChatResponse {
    pub message: ChatMessage,
    pub done: bool,
}

/// Ollama model info
#[derive(Debug, Clone, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub size: u64,
    pub digest: String,
    pub modified_at: String,
}

/// Ollama models list response
#[derive(Debug, Clone, Deserialize)]
pub struct ModelsResponse {
    pub models: Vec<ModelInfo>,
}

impl OllamaClient {
    /// Create new Ollama client
    pub fn new(base_url: &str, model: &str) -> Self {
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            model: model.to_string(),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .unwrap_or_default(),
        }
    }

    /// Check if Ollama is available
    pub async fn is_available(&self) -> bool {
        self.client
            .get(format!("{}/api/tags", self.base_url))
            .send()
            .await
            .is_ok()
    }

    /// List available models
    pub async fn list_models(&self) -> Result<Vec<ModelInfo>, String> {
        let response = self.client
            .get(format!("{}/api/tags", self.base_url))
            .send()
            .await
            .map_err(|e| format!("Failed to connect to Ollama: {}", e))?;

        let models: ModelsResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse models response: {}", e))?;

        Ok(models.models)
    }

    /// Send a chat message and get response
    pub async fn chat(&self, messages: Vec<ChatMessage>) -> Result<String, String> {
        let request = ChatRequest {
            model: self.model.clone(),
            messages,
            stream: false,
            options: Some(OllamaOptions {
                num_gpu: -1,
                temperature: 0.3,
            }),
        };

        let response = self.client
            .post(format!("{}/api/chat", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Failed to send chat request: {}", e))?;

        let chat_response: ChatResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse chat response: {}", e))?;

        Ok(chat_response.message.content)
    }

    /// Analyze scan results and provide recommendations
    pub async fn analyze_scan(&self, scan_summary: &str) -> Result<String, String> {
        let system_prompt = "You are a disk space analysis expert. Analyze the provided scan results and give actionable recommendations for freeing up space. Be concise and specific. Format your response with bullet points.";

        let messages = vec![
            ChatMessage {
                role: "system".to_string(),
                content: system_prompt.to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: format!("Here are my disk scan results:\n\n{}", scan_summary),
            },
        ];

        self.chat(messages).await
    }

    /// Get cleanup recommendations for specific file types
    pub async fn recommend_cleanup(&self, file_types: &str, total_size: &str) -> Result<String, String> {
        let system_prompt = "You are a file cleanup expert. Given the file type distribution and total size, recommend which files can be safely removed or archived. Consider development artifacts, caches, logs, and temporary files.";

        let messages = vec![
            ChatMessage {
                role: "system".to_string(),
                content: system_prompt.to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: format!(
                    "File types: {}\nTotal size: {}\n\nWhat can I safely clean up?",
                    file_types, total_size
                ),
            },
        ];

        self.chat(messages).await
    }

    /// Answer natural language questions about scan results
    pub async fn answer_question(&self, question: &str, scan_context: &str) -> Result<String, String> {
        let system_prompt = "You are a helpful assistant that answers questions about disk space analysis. Use the provided scan context to give accurate answers.";

        let messages = vec![
            ChatMessage {
                role: "system".to_string(),
                content: system_prompt.to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: format!(
                    "Scan context:\n{}\n\nQuestion: {}",
                    scan_context, question
                ),
            },
        ];

        self.chat(messages).await
    }
}
