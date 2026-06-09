use serde::{Deserialize, Serialize};

fn deserialize_null_to_default<'de, D, T>(deserializer: D) -> Result<T, D::Error>
where
    T: Default + Deserialize<'de>,
    D: serde::Deserializer<'de>,
{
    let opt = Option::<T>::deserialize(deserializer)?;
    Ok(opt.unwrap_or_default())
}

#[derive(Debug, Clone, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub size: u64,
    pub digest: String,
    pub modified_at: String,
    #[serde(default)]
    pub details: Option<ModelDetails>,
    #[serde(default)]
    pub capabilities: Vec<String>,
    #[serde(default)]
    pub remote_host: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ModelDetails {
    #[serde(default)]
    pub parent_model: String,
    #[serde(default)]
    pub format: String,
    #[serde(default)]
    pub family: String,
    #[serde(default, deserialize_with = "deserialize_null_to_default")]
    pub families: Vec<String>,
    #[serde(default)]
    pub parameter_size: String,
    #[serde(default)]
    pub quantization_level: String,
    #[serde(default)]
    pub context_length: Option<u32>,
    #[serde(default)]
    pub embedding_length: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ModelsResponse {
    pub models: Vec<ModelInfo>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct VersionResponse {
    pub version: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PsResponse {
    pub models: Vec<RunningModel>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RunningModel {
    pub name: String,
    pub model: String,
    pub size: u64,
    pub size_vram: u64,
    pub expires_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ShowModelResponse {
    #[serde(default)]
    pub modelfile: Option<String>,
    #[serde(default)]
    pub parameters: Option<String>,
    #[serde(default)]
    pub template: Option<String>,
    #[serde(default)]
    pub details: Option<ModelDetails>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PullRequest {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PullResponse {
    pub status: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PullProgress {
    pub status: String,
    #[serde(default)]
    pub digest: Option<String>,
    #[serde(default)]
    pub total: Option<u64>,
    #[serde(default)]
    pub completed: Option<u64>,
}

impl PullProgress {
    pub fn progress_pct(&self) -> f64 {
        match (self.completed, self.total) {
            (Some(c), Some(t)) if t > 0 => c as f64 / t as f64 * 100.0,
            _ => 0.0,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct CopyModelRequest {
    pub source: String,
    pub destination: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeleteModelRequest {
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CreateModelRequest {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modelfile: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
}
