use egui::{self, Color32, CornerRadius, Stroke, Style, Visuals};

pub mod palette {
    use egui::Color32;

    pub const BG_DEEPEST: Color32 = Color32::from_rgb(10, 10, 13);
    pub const BG_DARK: Color32 = Color32::from_rgb(18, 18, 24);
    pub const BG_SURFACE: Color32 = Color32::from_rgb(26, 26, 34);
    pub const BG_ELEVATED: Color32 = Color32::from_rgb(34, 34, 44);
    pub const BG_HOVER: Color32 = Color32::from_rgb(42, 42, 54);
    pub const BG_ACTIVE: Color32 = Color32::from_rgb(50, 50, 64);

    pub const ACCENT_CYAN: Color32 = Color32::from_rgb(0, 200, 220);
    pub const ACCENT_BLUE: Color32 = Color32::from_rgb(80, 150, 255);
    pub const ACCENT_PURPLE: Color32 = Color32::from_rgb(160, 100, 255);
    pub const ACCENT_TEAL: Color32 = Color32::from_rgb(0, 180, 180);

    pub const TEXT_PRIMARY: Color32 = Color32::from_rgb(235, 235, 240);
    pub const TEXT_SECONDARY: Color32 = Color32::from_rgb(180, 180, 190);
    pub const TEXT_MUTED: Color32 = Color32::from_rgb(120, 120, 130);
    pub const TEXT_ACCENT: Color32 = Color32::from_rgb(100, 180, 255);

    pub const SUCCESS: Color32 = Color32::from_rgb(0, 200, 120);
    pub const WARNING: Color32 = Color32::from_rgb(255, 180, 40);
    pub const ERROR: Color32 = Color32::from_rgb(240, 80, 70);
    pub const INFO: Color32 = Color32::from_rgb(80, 170, 255);

    pub const BORDER_SUBTLE: Color32 = Color32::from_rgb(40, 40, 50);
    pub const BORDER_ACCENT: Color32 = Color32::from_rgb(60, 100, 180);
}

pub fn install(cc: &eframe::CreationContext) {
    let ctx = &cc.egui_ctx;
    ctx.set_pixels_per_point(1.3);

    let mut visuals = Visuals::dark();
    visuals.dark_mode = true;

    visuals.window_fill = palette::BG_DARK;
    visuals.panel_fill = palette::BG_DARK;
    visuals.extreme_bg_color = palette::BG_DEEPEST;
    visuals.faint_bg_color = palette::BG_SURFACE;

    visuals.override_text_color = Some(palette::TEXT_PRIMARY);
    visuals.hyperlink_color = palette::ACCENT_BLUE;

    visuals.selection = egui::style::Selection {
        bg_fill: palette::ACCENT_BLUE.linear_multiply(0.35),
        stroke: Stroke::new(1.0, palette::ACCENT_BLUE),
    };

    // Buttons / interactive — more distinct from static labels
    visuals.widgets.inactive.bg_fill = palette::BG_ELEVATED;
    visuals.widgets.inactive.fg_stroke = Stroke::new(1.0, palette::TEXT_SECONDARY);
    visuals.widgets.inactive.bg_stroke = Stroke::new(1.0, palette::BORDER_SUBTLE);
    visuals.widgets.inactive.corner_radius = CornerRadius::same(6);
    visuals.widgets.inactive.expansion = 2.0;

    visuals.widgets.hovered.bg_fill = palette::BG_HOVER;
    visuals.widgets.hovered.fg_stroke = Stroke::new(1.5, palette::ACCENT_BLUE);
    visuals.widgets.hovered.bg_stroke = Stroke::new(1.0, palette::ACCENT_BLUE.linear_multiply(0.5));
    visuals.widgets.hovered.corner_radius = CornerRadius::same(6);
    visuals.widgets.hovered.expansion = 2.0;

    visuals.widgets.active.bg_fill = palette::BG_ACTIVE;
    visuals.widgets.active.fg_stroke = Stroke::new(2.0, palette::ACCENT_BLUE);
    visuals.widgets.active.bg_stroke = Stroke::new(1.0, palette::ACCENT_BLUE);
    visuals.widgets.active.corner_radius = CornerRadius::same(6);
    visuals.widgets.active.expansion = 2.0;

    visuals.widgets.open.bg_fill = palette::BG_ELEVATED;
    visuals.widgets.open.corner_radius = CornerRadius::same(6);

    // Non-interactive (labels, grids) — keep subtle
    visuals.widgets.noninteractive.bg_fill = palette::BG_SURFACE;
    visuals.widgets.noninteractive.fg_stroke = Stroke::new(1.0, palette::TEXT_MUTED);
    visuals.widgets.noninteractive.corner_radius = CornerRadius::same(4);
    visuals.widgets.noninteractive.bg_stroke = Stroke::new(1.0, palette::BORDER_SUBTLE);

    visuals.window_shadow = egui::epaint::Shadow {
        offset: [0, 4].into(), blur: 8, spread: 0,
        color: Color32::from_black_alpha(80),
    };
    visuals.popup_shadow = egui::epaint::Shadow {
        offset: [0, 6].into(), blur: 12, spread: 0,
        color: Color32::from_black_alpha(60),
    };

    visuals.resize_corner_size = 8.0;
    visuals.button_frame = true;
    visuals.collapsing_header_frame = true;
    visuals.warn_fg_color = palette::WARNING;
    visuals.error_fg_color = palette::ERROR;
    visuals.code_bg_color = palette::BG_ELEVATED;
    visuals.clip_rect_margin = 2.0;

    ctx.set_visuals(visuals);

    // ── Typography & spacing — visual hierarchy ──────
    let mut style: Style = (*ctx.global_style()).clone();

    style.text_styles.insert(
        egui::TextStyle::Heading,
        egui::FontId::new(20.0, egui::FontFamily::Proportional),
    );
    style.text_styles.insert(
        egui::TextStyle::Body,
        egui::FontId::new(14.0, egui::FontFamily::Proportional),
    );
    style.text_styles.insert(
        egui::TextStyle::Button,
        egui::FontId::new(14.0, egui::FontFamily::Proportional),
    );
    style.text_styles.insert(
        egui::TextStyle::Monospace,
        egui::FontId::new(13.0, egui::FontFamily::Monospace),
    );
    style.text_styles.insert(
        egui::TextStyle::Small,
        egui::FontId::new(11.0, egui::FontFamily::Proportional),
    );

    // Generous spacing
    style.spacing.scroll = egui::style::ScrollStyle::solid();
    style.spacing.item_spacing = egui::vec2(10.0, 8.0);
    style.spacing.button_padding = egui::vec2(14.0, 8.0);
    style.spacing.indent = 16.0;
    style.spacing.menu_margin = egui::Margin::symmetric(8, 4);

    ctx.set_global_style(style);
}

// ── Helper widgets ──────────────────────────────────────────

/// Card-like section with heading, rounded border, inner padding
pub fn section(ui: &mut egui::Ui, heading: &str, add_contents: impl FnOnce(&mut egui::Ui)) {
    egui::Frame::NONE
        .fill(palette::BG_SURFACE)
        .corner_radius(8)
        .stroke(Stroke::new(1.0, palette::BORDER_SUBTLE))
        .inner_margin(egui::Margin::symmetric(14, 12))
        .show(ui, |ui| {
            ui.colored_label(palette::TEXT_ACCENT, heading);
            ui.add_space(4.0);
            add_contents(ui);
        });
}

/// Key-value metric label
pub fn metric(ui: &mut egui::Ui, label: &str, value: impl std::fmt::Display) {
    ui.horizontal(|ui| {
        ui.colored_label(palette::TEXT_MUTED, format!("{}:", label));
        ui.colored_label(palette::TEXT_SECONDARY, value.to_string());
    });
}

/// Accent-themed primary button (blue)
pub fn btn_primary(ui: &mut egui::Ui, text: &str) -> egui::Response {
    ui.add(
        egui::Button::new(text)
            .fill(palette::ACCENT_BLUE.linear_multiply(0.25))
            .stroke(Stroke::new(1.0, palette::ACCENT_BLUE))
            .corner_radius(6),
    )
}

/// Green success/action button
pub fn btn_success(ui: &mut egui::Ui, text: &str) -> egui::Response {
    ui.add(
        egui::Button::new(text)
            .fill(palette::SUCCESS.linear_multiply(0.2))
            .stroke(Stroke::new(1.0, palette::SUCCESS))
            .corner_radius(6),
    )
}

/// Red destructive button
pub fn btn_danger(ui: &mut egui::Ui, text: &str) -> egui::Response {
    ui.add(
        egui::Button::new(text)
            .fill(palette::ERROR.linear_multiply(0.2))
            .stroke(Stroke::new(1.0, palette::ERROR))
            .corner_radius(6),
    )
}

/// Heading with accent color — use as section title
pub fn heading(ui: &mut egui::Ui, text: &str) {
    ui.colored_label(palette::TEXT_ACCENT, text);
    ui.add_space(2.0);
}

/// Sub-heading — lighter color, smaller
pub fn sub_heading(ui: &mut egui::Ui, text: &str) {
    ui.colored_label(palette::TEXT_SECONDARY, text);
    ui.add_space(2.0);
}
