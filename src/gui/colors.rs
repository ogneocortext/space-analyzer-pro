use eframe::egui::Color32;

// Accent / brand
pub const ACCENT: Color32 = Color32::from_rgb(137, 180, 250); // Catppuccin blue
pub const ACCENT_DIM: Color32 = Color32::from_rgb(88, 110, 165);
pub const ACCENT_BG: Color32 = Color32::from_rgb(35, 40, 65);

// Semantic
pub const SUCCESS: Color32 = Color32::from_rgb(166, 227, 161); // Catppuccin green
pub const WARNING: Color32 = Color32::from_rgb(249, 226, 175); // Catppuccin yellow
pub const ERROR: Color32 = Color32::from_rgb(243, 139, 168); // Catppuccin red
pub const INFO: Color32 = Color32::from_rgb(137, 180, 250); // Catppuccin blue

// Surface / backgrounds
pub const CARD_BG: Color32 = Color32::from_rgb(36, 37, 54); // Slightly lighter than base
pub const CARD_BORDER: Color32 = Color32::from_rgb(58, 58, 82);
pub const CARD_HOVER: Color32 = Color32::from_rgb(42, 42, 65);

// Text
pub const TEXT_PRIMARY: Color32 = Color32::from_rgb(205, 214, 244); // Catppuccin text
pub const TEXT_SECONDARY: Color32 = Color32::from_rgb(166, 173, 200);
pub const TEXT_MUTED: Color32 = Color32::from_rgb(108, 112, 134); // Catppuccin overlay

// Priority colors
pub const PRIORITY_CRITICAL: Color32 = Color32::from_rgb(243, 139, 168);
pub const PRIORITY_HIGH: Color32 = Color32::from_rgb(250, 179, 135);
pub const PRIORITY_MEDIUM: Color32 = Color32::from_rgb(249, 226, 175);
pub const PRIORITY_LOW: Color32 = Color32::from_rgb(166, 173, 200);
