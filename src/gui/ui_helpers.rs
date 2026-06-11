use eframe::egui;

use super::colors;

/// Render a styled card frame with background, border, and padding.
pub fn card_frame(_style: &egui::Style) -> egui::Frame {
    egui::Frame::NONE
        .fill(colors::CARD_BG)
        .stroke(egui::Stroke::new(1.0, colors::CARD_BORDER))
        .corner_radius(egui::CornerRadius::same(12))
        .inner_margin(egui::Margin::symmetric(18, 14))
        .outer_margin(egui::Margin::symmetric(0, 6))
        .shadow(egui::Shadow::NONE)
}

/// Render a section header with optional icon and strong text.
pub fn section_heading(ui: &mut egui::Ui, icon: Option<char>, text: &str) {
    ui.add_space(4.0);
    ui.horizontal(|ui| {
        if let Some(ch) = icon {
            ui.label(
                egui::RichText::new(ch.to_string())
                    .size(15.0)
                    .color(colors::ACCENT),
            );
        }
        ui.label(
            egui::RichText::new(text)
                .size(15.0)
                .strong()
                .color(colors::TEXT_PRIMARY),
        );
    });
    ui.add_space(2.0);
}

/// Render a stat card: large value + label underneath, inside a card.
pub fn stat_card(ui: &mut egui::Ui, label: &str, value: &str, accent: egui::Color32) {
    card_frame(ui.style()).show(ui, |ui| {
        ui.vertical(|ui| {
            ui.label(egui::RichText::new(value).size(22.0).strong().color(accent));
            ui.label(
                egui::RichText::new(label)
                    .size(11.0)
                    .color(colors::TEXT_SECONDARY),
            );
        });
    });
}

/// Render a colored badge (pill-shaped label).
pub fn badge(ui: &mut egui::Ui, text: &str, bg: egui::Color32) {
    egui::Frame::NONE
        .fill(bg)
        .corner_radius(egui::CornerRadius::same(10))
        .inner_margin(egui::Margin::symmetric(8, 2))
        .show(ui, |ui| {
            ui.label(
                egui::RichText::new(text)
                    .size(10.0)
                    .strong()
                    .color(egui::Color32::BLACK),
            );
        });
}

/// Render a horizontal gauge bar (0.0..=1.0) with color coding.
pub fn gauge_bar(ui: &mut egui::Ui, value: f32, width: f32, height: f32) {
    let (color, bg) = if value > 0.9 {
        (colors::ERROR, colors::ERROR.linear_multiply(0.2))
    } else if value > 0.7 {
        (colors::WARNING, colors::WARNING.linear_multiply(0.2))
    } else if value > 0.5 {
        (
            colors::PRIORITY_HIGH,
            colors::PRIORITY_HIGH.linear_multiply(0.2),
        )
    } else {
        (colors::SUCCESS, colors::SUCCESS.linear_multiply(0.2))
    };

    let (response, painter) = ui.allocate_painter(egui::vec2(width, height), egui::Sense::hover());
    let rect = response.rect;

    // Background
    painter.rect_filled(rect, egui::CornerRadius::same(4), bg);

    // Fill
    let fill_width = (rect.width() * value.clamp(0.0, 1.0)).max(0.0);
    if fill_width > 0.0 {
        let fill_rect = egui::Rect::from_min_size(rect.min, egui::vec2(fill_width, rect.height()));
        painter.rect_filled(fill_rect, egui::CornerRadius::same(4), color);
    }
}

/// Render a small horizontal gauge with label and percentage text.
pub fn labeled_gauge(ui: &mut egui::Ui, label: &str, value: f32, detail: Option<&str>) {
    ui.vertical(|ui| {
        ui.horizontal(|ui| {
            ui.label(
                egui::RichText::new(label)
                    .size(12.0)
                    .color(colors::TEXT_PRIMARY),
            );
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                let color = if value > 0.9 {
                    colors::ERROR
                } else if value > 0.7 {
                    colors::WARNING
                } else {
                    colors::SUCCESS
                };
                ui.label(
                    egui::RichText::new(format!("{:.1}%", value * 100.0))
                        .size(11.0)
                        .color(color)
                        .strong(),
                );
            });
        });
        gauge_bar(ui, value, ui.available_width(), 8.0);
        if let Some(d) = detail {
            ui.label(egui::RichText::new(d).size(10.0).color(colors::TEXT_MUTED));
        }
    });
}

/// Create a RichText icon from emoji character
pub fn icon_text(codepoint: u32, _family: &str, size: f32, color: egui::Color32) -> egui::RichText {
    let glyph = char::from_u32(codepoint).unwrap_or('?');
    egui::RichText::new(glyph.to_string())
        .size(size)
        .color(color)
}

/// Get just the icon character as a string
pub fn icon_char(codepoint: u32) -> char {
    char::from_u32(codepoint).unwrap_or('?')
}
