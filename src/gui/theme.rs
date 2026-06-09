use eframe::egui;

/// Apply a custom dark theme with accent colors (Catppuccin Mocha inspired)
pub fn apply_custom_theme(ctx: &egui::Context) {
    let mut style = (*ctx.global_style()).clone();

    // Custom colors — Catppuccin Mocha palette
    let mut visuals = egui::Visuals::dark();
    visuals.widgets.noninteractive.bg_fill = egui::Color32::from_rgb(30, 30, 46);
    visuals.widgets.noninteractive.fg_stroke =
        egui::Stroke::new(1.0, egui::Color32::from_rgb(205, 214, 244));
    visuals.widgets.inactive.bg_fill = egui::Color32::from_rgb(42, 42, 62);
    visuals.widgets.inactive.fg_stroke =
        egui::Stroke::new(1.0, egui::Color32::from_rgb(186, 194, 222));
    visuals.widgets.hovered.bg_fill = egui::Color32::from_rgb(58, 58, 90);
    visuals.widgets.hovered.fg_stroke =
        egui::Stroke::new(1.0, egui::Color32::from_rgb(205, 214, 244));
    visuals.widgets.active.bg_fill = egui::Color32::from_rgb(88, 91, 132);
    visuals.widgets.active.fg_stroke =
        egui::Stroke::new(1.0, egui::Color32::from_rgb(205, 214, 244));
    visuals.selection.bg_fill = egui::Color32::from_rgb(137, 180, 250);
    visuals.selection.stroke = egui::Stroke::new(1.0, egui::Color32::from_rgb(137, 180, 250));
    visuals.extreme_bg_color = egui::Color32::from_rgb(24, 24, 37);
    visuals.faint_bg_color = egui::Color32::from_rgb(27, 27, 38);
    visuals.window_fill = egui::Color32::from_rgb(30, 30, 46);
    visuals.window_stroke = egui::Stroke::new(1.0, egui::Color32::from_rgb(58, 58, 82));

    style.visuals = visuals;

    // Spacing — generous for readability
    style.spacing.item_spacing = egui::vec2(10.0, 8.0);
    style.spacing.window_margin = egui::Margin::same(16);
    style.spacing.button_padding = egui::vec2(12.0, 6.0);
    style.spacing.indent = 20.0;

    // Rounding — consistent, slightly more rounded
    style.visuals.widgets.noninteractive.corner_radius = egui::CornerRadius::same(6);
    style.visuals.widgets.inactive.corner_radius = egui::CornerRadius::same(6);
    style.visuals.widgets.hovered.corner_radius = egui::CornerRadius::same(8);
    style.visuals.widgets.active.corner_radius = egui::CornerRadius::same(8);
    style.visuals.widgets.open.corner_radius = egui::CornerRadius::same(8);

    ctx.set_global_style(style);
}

#[allow(dead_code)]
pub fn install_icon_fonts(_ctx: &egui::Context) {
    // Icons are bundled via iconflow crate at compile time — no runtime font installation needed
}
