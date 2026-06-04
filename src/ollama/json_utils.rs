//! JSON validation and repair utilities for structured LLM outputs
//!
//! LLMs frequently return malformed JSON: trailing commas, unescaped quotes,
//! markdown wrappers, or explanatory text before/after the JSON object.
//! This module provides repair, extraction, and validation helpers.

/// Attempt to repair common JSON formatting issues
pub fn repair_json(raw: &str) -> String {
    let mut s = raw.to_string();

    // Strip markdown code blocks
    s = strip_markdown(&s);

    // Extract first JSON object/array if embedded in text
    s = extract_json(&s);

    // Fix trailing commas before } or ]
    s = fix_trailing_commas(&s);

    // Fix single quotes used as string delimiters
    s = fix_single_quotes(&s);

    // Fix unescaped newlines in string values
    s = fix_unescaped_newlines(&s);

    // Fix missing commas between key-value pairs
    s = fix_missing_commas(&s);

    // Fix unescaped backslashes in strings
    s = fix_unescaped_backslashes(&s);

    s
}

/// Strip markdown code fences and surrounding text
fn strip_markdown(input: &str) -> String {
    let s = input.trim();

    // Remove ```json ... ``` or ``` ... ```
    if let Some(start) = s.find("```") {
        let after_start = &s[start + 3..];
        // Skip optional language specifier
        let content_start = if after_start.starts_with("json") || after_start.starts_with("JSON") {
            &after_start[4..]
        } else {
            after_start
        };

        if let Some(end) = content_start.rfind("```") {
            return content_start[..end].trim().to_string();
        }
    }

    s.to_string()
}

/// Extract the first complete JSON object or array from text
fn extract_json(input: &str) -> String {
    let trimmed = input.trim();

    // If it already starts with { or [, try to extract the balanced block
    if let Some(start) = trimmed.find('{') {
        if let Some(end) = find_matching_brace(trimmed, start) {
            return trimmed[start..=end].to_string();
        }
    }

    if let Some(start) = trimmed.find('[') {
        if let Some(end) = find_matching_bracket(trimmed, start) {
            return trimmed[start..=end].to_string();
        }
    }

    trimmed.to_string()
}

/// Find the matching closing brace for an opening brace at `start`
fn find_matching_brace(s: &str, start: usize) -> Option<usize> {
    let bytes = s.as_bytes();
    let mut depth = 0;
    let mut in_string = false;
    let mut escaped = false;

    for (i, &b) in bytes.iter().enumerate().skip(start) {
        if escaped {
            escaped = false;
            continue;
        }

        match b {
            b'\\' if in_string => escaped = true,
            b'"' if !escaped => in_string = !in_string,
            b'{' if !in_string => depth += 1,
            b'}' if !in_string => {
                depth -= 1;
                if depth == 0 {
                    return Some(i);
                }
            }
            _ => {}
        }
    }

    None
}

/// Find the matching closing bracket for an opening bracket at `start`
fn find_matching_bracket(s: &str, start: usize) -> Option<usize> {
    let bytes = s.as_bytes();
    let mut depth = 0;
    let mut in_string = false;
    let mut escaped = false;

    for (i, &b) in bytes.iter().enumerate().skip(start) {
        if escaped {
            escaped = false;
            continue;
        }

        match b {
            b'\\' if in_string => escaped = true,
            b'"' if !escaped => in_string = !in_string,
            b'[' if !in_string => depth += 1,
            b']' if !in_string => {
                depth -= 1;
                if depth == 0 {
                    return Some(i);
                }
            }
            _ => {}
        }
    }

    None
}

/// Remove trailing commas before } or ]
fn fix_trailing_commas(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    let mut in_string = false;
    let mut escaped = false;

    while let Some(c) = chars.next() {
        if escaped {
            result.push(c);
            escaped = false;
            continue;
        }

        match c {
            '\\' if in_string => {
                result.push(c);
                escaped = true;
                continue;
            }
            '"' => {
                in_string = !in_string;
                result.push(c);
                continue;
            }
            ',' if !in_string => {
                // Look ahead to see if next non-whitespace is } or ]
                let mut peek = chars.clone();
                let mut next_non_ws = None;
                for _ in 0..20 {
                    if let Some(nc) = peek.next() {
                        if !nc.is_whitespace() {
                            next_non_ws = Some(nc);
                            break;
                        }
                    } else {
                        break;
                    }
                }

                if matches!(next_non_ws, Some('}') | Some(']')) {
                    // Skip this comma (trailing)
                    continue;
                }
                result.push(c);
            }
            _ => result.push(c),
        }
    }

    result
}

/// Replace single quotes used as string delimiters with double quotes
fn fix_single_quotes(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let chars = input.chars().peekable();
    let mut in_double_string = false;
    let mut escaped = false;

    for c in chars {
        if escaped {
            result.push(c);
            escaped = false;
            continue;
        }

        match c {
            '\\' if in_double_string => {
                result.push(c);
                escaped = true;
                continue;
            }
            '"' if !escaped => {
                in_double_string = !in_double_string;
                result.push(c);
                continue;
            }
            '\'' if !in_double_string => {
                // Replace single quote with double quote
                result.push('"');
                continue;
            }
            _ => result.push(c),
        }
    }

    result
}

/// Escape literal newlines inside string values
fn fix_unescaped_newlines(input: &str) -> String {
    let mut result = String::with_capacity(input.len() + 64);
    let chars = input.chars().peekable();
    let mut in_string = false;
    let mut escaped = false;

    for c in chars {
        if escaped {
            result.push(c);
            escaped = false;
            continue;
        }

        match c {
            '\\' if in_string => {
                result.push(c);
                escaped = true;
                continue;
            }
            '"' => {
                in_string = !in_string;
                result.push(c);
                continue;
            }
            '\n' | '\r' if in_string => {
                result.push_str("\\n");
                continue;
            }
            _ => result.push(c),
        }
    }

    result
}

/// Add missing commas between } {, } [, ] {, ] [, and between values
fn fix_missing_commas(input: &str) -> String {
    let mut result = String::with_capacity(input.len() + 32);
    let chars = input.chars().peekable();
    let mut in_string = false;
    let mut escaped = false;
    let mut prev_char = ' ';

    for c in chars {
        if escaped {
            result.push(c);
            escaped = false;
            prev_char = c;
            continue;
        }

        match c {
            '\\' if in_string => {
                result.push(c);
                escaped = true;
                prev_char = c;
                continue;
            }
            '"' => {
                in_string = !in_string;
                result.push(c);
                prev_char = c;
                continue;
            }
            _ if !in_string => {
                // Check if we need a comma before this character
                if matches!(prev_char, '}' | ']') && matches!(c, '"' | '{' | '[') {
                    result.push(',');
                }
                result.push(c);
                prev_char = c;
            }
            _ => {
                result.push(c);
                prev_char = c;
            }
        }
    }

    result
}

/// Escape bare backslashes in string values that aren't valid escape sequences
fn fix_unescaped_backslashes(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let chars = input.chars().peekable();
    let mut in_string = false;
    let mut just_saw_backslash = false;

    for c in chars {
        match c {
            '"' => {
                if just_saw_backslash && in_string {
                    // Backslash before quote was already escaped, keep it
                    result.push(c);
                    just_saw_backslash = false;
                } else {
                    in_string = !in_string;
                    result.push(c);
                    just_saw_backslash = false;
                }
            }
            '\\' if in_string => {
                if just_saw_backslash {
                    // Double backslash - valid escape
                    result.push_str("\\\\");
                    just_saw_backslash = false;
                } else {
                    just_saw_backslash = true;
                }
            }
            _ if in_string && just_saw_backslash => {
                // Check if this is a valid JSON escape sequence
                let valid_escape =
                    matches!(c, '"' | '\\' | '/' | 'b' | 'f' | 'n' | 'r' | 't' | 'u');
                if valid_escape {
                    result.push('\\');
                    result.push(c);
                } else {
                    // Invalid escape - escape the backslash
                    result.push_str("\\\\");
                    result.push(c);
                }
                just_saw_backslash = false;
            }
            _ => {
                if just_saw_backslash {
                    result.push('\\');
                    just_saw_backslash = false;
                }
                result.push(c);
            }
        }
    }

    if just_saw_backslash {
        result.push('\\');
    }

    result
}

/// Validate that a string is parseable JSON and return the parsed value
pub fn validate_json(input: &str) -> Result<serde_json::Value, String> {
    let repaired = repair_json(input);
    serde_json::from_str(&repaired).map_err(|e| format!("JSON validation failed: {}", e))
}

/// Validate JSON against a minimal schema (checks required keys exist)
pub fn validate_json_schema(
    value: &serde_json::Value,
    required_keys: &[&str],
) -> Result<(), String> {
    if let Some(obj) = value.as_object() {
        for key in required_keys {
            if !obj.contains_key(*key) {
                return Err(format!("Missing required key: {}", key));
            }
        }
        Ok(())
    } else {
        Err("Expected JSON object".to_string())
    }
}

/// Attempt to parse JSON with automatic repair and retry
/// Returns (parsed_value, was_repaired)
pub fn parse_with_repair<T: serde::de::DeserializeOwned>(raw: &str) -> Result<(T, bool), String> {
    // First try direct parse
    if let Ok(value) = serde_json::from_str::<T>(raw.trim()) {
        return Ok((value, false));
    }

    // Try with repair
    let repaired = repair_json(raw);
    let value = serde_json::from_str::<T>(&repaired)
        .map_err(|e| format!("JSON parse failed even after repair: {}", e))?;

    Ok((value, true))
}

/// Extract and validate JSON from an LLM response with detailed error reporting
pub fn extract_and_validate(
    raw_response: &str,
    required_keys: &[&str],
) -> Result<serde_json::Value, String> {
    let value = validate_json(raw_response)?;
    validate_json_schema(&value, required_keys)?;
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_markdown() {
        assert_eq!(
            strip_markdown("```json\n{\"key\": \"value\"}\n```"),
            "{\"key\": \"value\"}"
        );
        assert_eq!(
            strip_markdown("```\n{\"key\": \"value\"}\n```"),
            "{\"key\": \"value\"}"
        );
    }

    #[test]
    fn test_fix_trailing_commas() {
        assert_eq!(
            fix_trailing_commas("{\"a\": 1, \"b\": 2,}"),
            "{\"a\": 1, \"b\": 2}"
        );
        assert_eq!(fix_trailing_commas("[1, 2, 3,]"), "[1, 2, 3]");
    }

    #[test]
    fn test_extract_json() {
        assert_eq!(
            extract_json("Here is the result:\n{\"key\": \"value\"}\nHope this helps!"),
            "{\"key\": \"value\"}"
        );
    }

    #[test]
    fn test_repair_json_combined() {
        let input = "```json\n{\"name\": \"test\", \"items\": [1, 2, 3,],}\n```";
        let repaired = repair_json(input);
        assert!(repaired.contains("\"name\": \"test\""));
        assert!(!repaired.ends_with(",}"));
    }

    #[test]
    fn test_validate_json() {
        let result = validate_json("{\"key\": \"value\"}");
        assert!(result.is_ok());
        assert_eq!(result.unwrap()["key"], "value");
    }

    #[test]
    fn test_validate_json_schema() {
        let value: serde_json::Value =
            serde_json::from_str("{\"title\": \"test\", \"priority\": \"high\"}").unwrap();
        assert!(validate_json_schema(&value, &["title", "priority"]).is_ok());
        assert!(validate_json_schema(&value, &["title", "missing"]).is_err());
    }

    #[test]
    fn test_parse_with_repair_direct() {
        let (value, was_repaired) = parse_with_repair::<serde_json::Value>("{\"a\": 1}").unwrap();
        assert!(!was_repaired);
        assert_eq!(value["a"], 1);
    }

    #[test]
    fn test_parse_with_repair_repaired() {
        let input = "```json\n{\"a\": 1,}\n```";
        let (value, was_repaired) = parse_with_repair::<serde_json::Value>(input).unwrap();
        assert!(was_repaired);
        assert_eq!(value["a"], 1);
    }

    #[test]
    fn test_fix_unescaped_newlines() {
        let input = "{\"text\": \"hello\nworld\"}";
        let fixed = fix_unescaped_newlines(input);
        assert!(fixed.contains("\\n"));
        assert!(serde_json::from_str::<serde_json::Value>(&fixed).is_ok());
    }

    #[test]
    fn test_fix_missing_commas() {
        let input = "{\"a\": 1}{\"b\": 2}";
        let fixed = fix_missing_commas(input);
        assert_eq!(fixed, "{\"a\": 1},{\"b\": 2}");
    }
}
