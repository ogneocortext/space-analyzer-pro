use eframe::egui::Color32;

// Accent / brand
pub const ACCENT: Color32 = Color32::from_rgb(147, 197, 253); // Catppuccin blue
pub const ACCENT_DIM: Color32 = Color32::from_rgb(112, 139, 193);
pub const ACCENT_BG: Color32 = Color32::from_rgb(42, 51, 82);

// Semantic
pub const SUCCESS: Color32 = Color32::from_rgb(190, 242, 100); // Catppuccin green
pub const WARNING: Color32 = Color32::from_rgb(254, 240, 138); // Catppuccin yellow
pub const ERROR: Color32 = Color32::from_rgb(251, 113, 133); // Catppuccin red
pub const INFO: Color32 = Color32::from_rgb(147, 197, 253); // Catppuccin blue

// Surface / backgrounds
pub const CARD_BG: Color32 = Color32::from_rgb(42, 44, 66); // Slightly lighter than base
pub const CARD_BORDER: Color32 = Color32::from_rgb(82, 86, 118);
pub const CARD_HOVER: Color32 = Color32::from_rgb(55, 58, 88);

// Text
pub const TEXT_PRIMARY: Color32 = Color32::from_rgb(232, 238, 255); // Catppuccin text
pub const TEXT_SECONDARY: Color32 = Color32::from_rgb(199, 206, 234);
pub const TEXT_MUTED: Color32 = Color32::from_rgb(148, 163, 184); // Catppuccin overlay

// Priority colors
pub const PRIORITY_CRITICAL: Color32 = Color32::from_rgb(251, 113, 133);
pub const PRIORITY_HIGH: Color32 = Color32::from_rgb(255, 196, 87);
pub const PRIORITY_MEDIUM: Color32 = Color32::from_rgb(254, 240, 138);
pub const PRIORITY_LOW: Color32 = Color32::from_rgb(199, 206, 234);
