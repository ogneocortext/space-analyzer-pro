use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonSchema {
    #[serde(rename = "type")]
    pub schema_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub properties: Option<serde_json::Map<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub items: Option<Box<JsonSchema>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

impl JsonSchema {
    pub fn object(
        properties: serde_json::Map<String, serde_json::Value>,
        required: Vec<String>,
    ) -> Self {
        Self {
            schema_type: "object".to_string(),
            properties: Some(properties),
            items: None,
            required: Some(required),
            description: None,
            extra: serde_json::Map::new(),
        }
    }
    pub fn array(items: JsonSchema) -> Self {
        Self {
            schema_type: "array".to_string(),
            properties: None,
            items: Some(Box::new(items)),
            required: None,
            description: None,
            extra: serde_json::Map::new(),
        }
    }
}
