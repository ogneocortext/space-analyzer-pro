use eframe::egui;

use crate::gui::colors;

/// Refined dark system-monitor theme.
pub fn apply_custom_theme(ctx: &egui::Context) {
    let mut visuals = egui::Visuals::dark();

    visuals.panel_fill = colors::BG_APP;
    visuals.window_fill = colors::SURFACE_1;
    visuals.extreme_bg_color = colors::BG_APP;
    visuals.faint_bg_color = colors::SURFACE_1;

    // Subtle shadow for windows/popups
    visuals.window_shadow = egui::Shadow {
        offset: [0, 4],
        blur: 16,
        spread: 0,
        color: egui::Color32::from_rgba_unmultiplied(0, 0, 0, 80),
    };
    visuals.popup_shadow = egui::Shadow {
        offset: [0, 2],
        blur: 8,
        spread: 0,
        color: egui::Color32::from_rgba_unmultiplied(0, 0, 0, 60),
    };

    // Non-interactive (labels, disabled)
    visuals.widgets.noninteractive.bg_fill = colors::SURFACE_1;
    visuals.widgets.noninteractive.bg_stroke =
        egui::Stroke::new(1.0, egui::Color32::from_rgba_unmultiplied(48, 64, 98, 100));
    visuals.widgets.noninteractive.fg_stroke = egui::Stroke::new(1.0, colors::TEXT_SECONDARY);
    visuals.widgets.noninteractive.corner_radius = egui::CornerRadius::same(6);

    // Inactive
    visuals.widgets.inactive.bg_fill = colors::SURFACE_2;
    visuals.widgets.inactive.bg_stroke =
        egui::Stroke::new(1.0, egui::Color32::from_rgba_unmultiplied(48, 64, 98, 140));
    visuals.widgets.inactive.fg_stroke = egui::Stroke::new(1.0, colors::TEXT_PRIMARY);
    visuals.widgets.inactive.corner_radius = egui::CornerRadius::same(8);
    visuals.widgets.inactive.weak_bg_fill = colors::SURFACE_2;

    // Hovered — clear lift effect
    visuals.widgets.hovered.bg_fill = colors::SURFACE_3;
    visuals.widgets.hovered.bg_stroke = egui::Stroke::new(
        1.5,
        egui::Color32::from_rgba_unmultiplied(112, 173, 255, 160),
    );
    visuals.widgets.hovered.fg_stroke = egui::Stroke::new(1.0, colors::TEXT_PRIMARY);
    visuals.widgets.hovered.corner_radius = egui::CornerRadius::same(8);
    visuals.widgets.hovered.weak_bg_fill = colors::SURFACE_3;
    visuals.widgets.hovered.expansion = 1.0;

    // Active / pressed — tighter radius, pressed-in feel
    visuals.widgets.active.bg_fill = colors::ACCENT;
    visuals.widgets.active.fg_stroke = egui::Stroke::new(1.0, colors::BG_APP);
    visuals.widgets.active.corner_radius = egui::CornerRadius::same(6);
    visuals.widgets.active.weak_bg_fill = colors::ACCENT;

    // Selection
    visuals.selection.bg_fill = colors::accent_soft();
    visuals.selection.stroke = egui::Stroke::new(1.0, colors::ACCENT);

    // Window / popup stroke — subtle
    visuals.window_stroke =
        egui::Stroke::new(1.0, egui::Color32::from_rgba_unmultiplied(48, 64, 98, 180));

    let mut style = (*ctx.global_style()).clone();
    style.visuals = visuals;

    // Spacing — 8px-based system, tighter for density
    style.spacing.item_spacing = egui::vec2(8.0, 8.0);
    style.spacing.button_padding = egui::vec2(14.0, 8.0);
    style.spacing.interact_size = egui::vec2(44.0, 36.0);
    style.spacing.window_margin = egui::Margin::same(16);
    style.spacing.menu_margin = egui::Margin::same(8);
    style.spacing.indent = 20.0;

    // Text styles — refined hierarchy
    let mut map = style.text_styles.clone();
    map.insert(egui::TextStyle::Heading, egui::FontId::proportional(20.0));
    map.insert(
        egui::TextStyle::Name("PageTitle".into()),
        egui::FontId::proportional(24.0),
    );
    map.insert(
        egui::TextStyle::Name("SectionTitle".into()),
        egui::FontId::proportional(14.0),
    );
    map.insert(egui::TextStyle::Body, egui::FontId::proportional(13.0));
    map.insert(egui::TextStyle::Small, egui::FontId::proportional(11.0));
    map.insert(egui::TextStyle::Button, egui::FontId::proportional(13.0));
    map.insert(egui::TextStyle::Monospace, egui::FontId::monospace(12.0));
    style.text_styles = map;

    ctx.set_global_style(style);
}

/// Install Phosphor icon fonts. Kept separate so it can be called once.
pub fn install_icon_fonts(ctx: &egui::Context) {
    let mut fonts = egui::FontDefinitions::default();
    egui_phosphor::add_to_fonts(&mut fonts, egui_phosphor::Variant::Regular);
    ctx.set_fonts(fonts);
}
