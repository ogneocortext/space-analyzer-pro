use std::sync::OnceLock;

/// Sanitize error messages for user display (SEC-003)
/// Removes or masks sensitive information like file paths, URLs, tokens, etc.
pub fn sanitize_error_message(message: &str) -> String {
    // Precompile regex patterns once (avoid re-compilation on every call)
    static RE_URL: OnceLock<regex::Regex> = OnceLock::new();
    static RE_WIN_PATH: OnceLock<regex::Regex> = OnceLock::new();
    static RE_UNIX_PATH: OnceLock<regex::Regex> = OnceLock::new();
    static RE_API_KEY: OnceLock<regex::Regex> = OnceLock::new();
    static RE_EMAIL: OnceLock<regex::Regex> = OnceLock::new();

    let url_re = RE_URL.get_or_init(|| regex::Regex::new(r"https?://[^:]+:[^@]+@").unwrap());
    let win_re = RE_WIN_PATH.get_or_init(|| regex::Regex::new(r"[A-Z]:\\Users\\[^\\]+\\").unwrap());
    let unix_re = RE_UNIX_PATH.get_or_init(|| regex::Regex::new(r"/home/[^/]+/").unwrap());
    let key_re = RE_API_KEY.get_or_init(|| regex::Regex::new(r"(?i)(api[_-]?key|token|secret)\s*[:=]\s*[A-Za-z0-9+/=_-]{16,}").unwrap());
    let email_re = RE_EMAIL.get_or_init(|| regex::Regex::new(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}").unwrap());

    let mut sanitized = message.to_string();
    sanitized = url_re.replace_all(&sanitized, "http://***@").to_string();
    sanitized = win_re.replace_all(&sanitized, "C:\\Users\\***\\").to_string();
    sanitized = unix_re.replace_all(&sanitized, "/home/***/").to_string();
    sanitized = key_re.replace_all(&sanitized, "$1: ***").to_string();
    sanitized = email_re.replace_all(&sanitized, "***@***.***").to_string();

    if sanitized.len() > 500 {
        sanitized.truncate(490);
        sanitized.push_str("... (truncated)");
    }

    sanitized
}