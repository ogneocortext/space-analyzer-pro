use eframe::egui::Color32;

// ── Surfaces / backgrounds ──────────────────────────────────────────
pub const BG_APP: Color32 = Color32::from_rgb(8, 11, 18);
pub const BG_HEADER: Color32 = Color32::from_rgb(13, 18, 32);
pub const SURFACE_1: Color32 = Color32::from_rgb(18, 25, 42);
pub const SURFACE_2: Color32 = Color32::from_rgb(24, 34, 56);
pub const SURFACE_3: Color32 = Color32::from_rgb(32, 45, 71);

// Legacy aliases (keep to avoid breaking existing code)
pub const CARD_BG: Color32 = SURFACE_2;
pub const CARD_BORDER: Color32 = Color32::from_rgb(48, 64, 98);
pub const CARD_HOVER: Color32 = SURFACE_3;

// ── Text ────────────────────────────────────────────────────────────
pub const TEXT_PRIMARY: Color32 = Color32::from_rgb(237, 243, 255);
pub const TEXT_SECONDARY: Color32 = Color32::from_rgb(170, 182, 204);
pub const TEXT_MUTED: Color32 = Color32::from_rgb(115, 128, 154);

// ── Accent / brand ──────────────────────────────────────────────────
pub const ACCENT: Color32 = Color32::from_rgb(112, 173, 255);
pub const ACCENT_HOVER: Color32 = Color32::from_rgb(145, 192, 255);
pub const ACCENT_DIM: Color32 = Color32::from_rgb(112, 139, 193);
pub const ACCENT_BG: Color32 = Color32::from_rgb(42, 51, 82);

pub fn accent_soft() -> Color32 {
    Color32::from_rgba_unmultiplied(112, 173, 255, 38)
}

// ── Semantic ────────────────────────────────────────────────────────
pub const SUCCESS: Color32 = Color32::from_rgb(156, 219, 94);
pub const WARNING: Color32 = Color32::from_rgb(243, 214, 107);
pub const ERROR: Color32 = Color32::from_rgb(251, 113, 133);
pub const INFO: Color32 = Color32::from_rgb(147, 197, 253);

// ── Priority colors ─────────────────────────────────────────────────
pub const PRIORITY_CRITICAL: Color32 = ERROR;
pub const PRIORITY_HIGH: Color32 = Color32::from_rgb(255, 196, 87);
pub const PRIORITY_MEDIUM: Color32 = WARNING;
pub const PRIORITY_LOW: Color32 = TEXT_SECONDARY;
