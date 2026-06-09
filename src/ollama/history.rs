use std::time::Instant;

use super::chat::{ChatMessage, Role};
use super::requests::TokenUsage;

#[derive(Debug, Clone)]
pub struct ConversationEntry {
    pub message: ChatMessage,
    pub timestamp: Instant,
    pub token_usage: Option<TokenUsage>,
}

impl ConversationEntry {
    pub fn new(message: ChatMessage, token_usage: Option<TokenUsage>) -> Self {
        Self {
            message,
            timestamp: Instant::now(),
            token_usage,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ConversationHistory {
    pub entries: Vec<ConversationEntry>,
    pub max_turns: usize,
    pub system_prompt: Option<String>,
}

impl ConversationHistory {
    pub fn new(max_turns: usize) -> Self {
        Self {
            entries: Vec::with_capacity(max_turns * 2),
            max_turns,
            system_prompt: None,
        }
    }

    pub fn add_message(&mut self, message: ChatMessage, token_usage: Option<TokenUsage>) {
        while self.entries.len() >= self.max_turns * 2 {
            if let Some(pos) = self
                .entries
                .iter()
                .position(|e| !matches!(e.message.role, Role::System))
            {
                self.entries.remove(pos);
            } else {
                break;
            }
        }
        self.entries
            .push(ConversationEntry::new(message, token_usage));
    }

    pub fn get_messages(&self) -> Vec<ChatMessage> {
        let mut messages = Vec::with_capacity(self.entries.len() + 1);
        if let Some(system) = &self.system_prompt {
            messages.push(ChatMessage::system(system));
        }
        for entry in &self.entries {
            messages.push(entry.message.clone());
        }
        messages
    }

    pub fn set_system_prompt(&mut self, prompt: String) {
        self.system_prompt = Some(prompt);
    }
    pub fn clear(&mut self) {
        self.entries.clear();
    }
    pub fn total_tokens(&self) -> u32 {
        self.entries
            .iter()
            .filter_map(|e| e.token_usage.as_ref())
            .map(|u| u.total_tokens())
            .sum()
    }
    pub fn turn_count(&self) -> usize {
        self.entries
            .iter()
            .filter(|e| matches!(e.message.role, Role::User))
            .count()
    }
}
