use serde::{Deserialize, Serialize};
use std::fmt;

/// Role of a chat message participant
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    System,
    User,
    Assistant,
    Tool,
}

impl fmt::Display for Role {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Role::System => write!(f, "system"),
            Role::User => write!(f, "user"),
            Role::Assistant => write!(f, "assistant"),
            Role::Tool => write!(f, "tool"),
        }
    }
}

/// A single chat message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: Role,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thinking: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

impl ChatMessage {
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: Role::System,
            content: content.into(),
            thinking: None,
            images: None,
            tool_calls: None,
            tool_call_id: None,
        }
    }
    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: Role::User,
            content: content.into(),
            thinking: None,
            images: None,
            tool_calls: None,
            tool_call_id: None,
        }
    }
    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            role: Role::Assistant,
            content: content.into(),
            thinking: None,
            images: None,
            tool_calls: None,
            tool_call_id: None,
        }
    }
    pub fn tool(content: impl Into<String>, tool_call_id: impl Into<String>) -> Self {
        Self {
            role: Role::Tool,
            content: content.into(),
            thinking: None,
            images: None,
            tool_calls: None,
            tool_call_id: Some(tool_call_id.into()),
        }
    }
    pub fn assistant_with_tool_calls(
        content: impl Into<String>,
        tool_calls: Vec<ToolCall>,
    ) -> Self {
        Self {
            role: Role::Assistant,
            content: content.into(),
            thinking: None,
            images: None,
            tool_calls: Some(tool_calls),
            tool_call_id: None,
        }
    }
    pub fn user_with_image(content: impl Into<String>, image_base64: impl Into<String>) -> Self {
        Self {
            role: Role::User,
            content: content.into(),
            thinking: None,
            images: Some(vec![image_base64.into()]),
            tool_calls: None,
            tool_call_id: None,
        }
    }
    pub fn user_with_images(content: impl Into<String>, images: Vec<String>) -> Self {
        Self {
            role: Role::User,
            content: content.into(),
            thinking: None,
            images: Some(images),
            tool_calls: None,
            tool_call_id: None,
        }
    }
}

/// A tool definition to send to Ollama for function calling
#[derive(Debug, Clone, Serialize)]
pub struct ToolDefinition {
    #[serde(rename = "type")]
    pub tool_type: String,
    pub function: FunctionDefinition,
}

#[derive(Debug, Clone, Serialize)]
pub struct FunctionDefinition {
    pub name: String,
    pub description: String,
    pub parameters: ToolParameters,
}

#[derive(Debug, Clone, Serialize)]
pub struct ToolParameters {
    #[serde(rename = "type")]
    pub param_type: String,
    pub properties: serde_json::Value,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub required: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type", default = "default_call_type")]
    pub call_type: String,
    pub function: ToolCallFunction,
}

fn default_call_type() -> String {
    "function".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallFunction {
    #[serde(default)]
    pub index: Option<u32>,
    pub name: String,
    #[serde(deserialize_with = "deserialize_arguments")]
    pub arguments: serde_json::Value,
}

fn deserialize_arguments<'de, D>(deserializer: D) -> Result<serde_json::Value, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    match value {
        serde_json::Value::String(s) if s.is_empty() || s == "{}" => Ok(serde_json::json!({})),
        serde_json::Value::String(s) => serde_json::from_str(&s).map_err(serde::de::Error::custom),
        serde_json::Value::Object(_) => Ok(value),
        _ => Ok(serde_json::json!({})),
    }
}

impl ToolCallFunction {
    pub fn get_argument(&self, key: &str) -> Option<&serde_json::Value> {
        self.arguments.get(key)
    }
}

impl ToolDefinition {
    pub fn new(name: &str, description: &str, parameters: ToolParameters) -> Self {
        Self {
            tool_type: "function".to_string(),
            function: FunctionDefinition {
                name: name.to_string(),
                description: description.to_string(),
                parameters,
            },
        }
    }
}

impl ToolParameters {
    pub fn new(properties: serde_json::Value, required: Vec<String>) -> Self {
        Self {
            param_type: "object".to_string(),
            properties,
            required,
        }
    }
    pub fn empty() -> Self {
        Self {
            param_type: "object".to_string(),
            properties: serde_json::json!({}),
            required: vec![],
        }
    }
}
