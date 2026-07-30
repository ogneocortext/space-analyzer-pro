use eframe::egui;

use super::colors;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Tone {
    Neutral,
    Accent,
    Success,
    Warning,
    Danger,
}

impl Tone {
    pub fn fill(self) -> egui::Color32 {
        match self {
            Tone::Neutral => colors::SURFACE_2,
            Tone::Accent => colors::ACCENT,
            Tone::Success => colors::SUCCESS,
            Tone::Warning => colors::WARNING,
            Tone::Danger => colors::ERROR,
        }
    }

    pub fn text(self) -> egui::Color32 {
        match self {
            Tone::Neutral => colors::TEXT_SECONDARY,
            Tone::Accent => colors::ACCENT,
            Tone::Success => colors::SUCCESS,
            Tone::Warning => colors::WARNING,
            Tone::Danger => colors::ERROR,
        }
    }

    pub fn soft_bg(self) -> egui::Color32 {
        match self {
            Tone::Neutral => colors::SURFACE_2,
            Tone::Accent => colors::accent_soft(),
            Tone::Success => colors::SUCCESS.linear_multiply(0.18),
            Tone::Warning => colors::WARNING.linear_multiply(0.18),
            Tone::Danger => colors::ERROR.linear_multiply(0.18),
        }
    }
}

pub fn app_card<R>(
    ui: &mut egui::Ui,
    add_contents: impl FnOnce(&mut egui::Ui) -> R,
) -> egui::InnerResponse<R> {
    egui::Frame::new()
        .fill(colors::SURFACE_2)
        .stroke(egui::Stroke::new(
            1.0,
            egui::Color32::from_rgba_unmultiplied(48, 64, 98, 140),
        ))
        .corner_radius(egui::CornerRadius::same(10))
        .inner_margin(egui::Margin::symmetric(14, 12))
        .outer_margin(egui::Margin::same(0))
        .shadow(egui::Shadow {
            offset: [0, 1],
            blur: 4,
            spread: 0,
            color: egui::Color32::from_rgba_unmultiplied(0, 0, 0, 40),
        })
        .show(ui, add_contents)
}

pub fn section_header(ui: &mut egui::Ui, icon: Option<&str>, text: &str) {
    ui.add_space(2.0);
    ui.horizontal(|ui| {
        if let Some(icon_str) = icon {
            ui.label(
                egui::RichText::new(icon_str)
                    .size(15.0)
                    .color(colors::ACCENT),
            );
            ui.add_space(2.0);
        }
        ui.label(
            egui::RichText::new(text)
                .size(14.0)
                .strong()
                .color(colors::TEXT_PRIMARY),
        );
    });
    ui.add_space(2.0);
}

pub fn status_badge(ui: &mut egui::Ui, label: &str, tone: Tone) {
    egui::Frame::NONE
        .fill(tone.soft_bg())
        .corner_radius(egui::CornerRadius::same(8))
        .inner_margin(egui::Margin::symmetric(10, 4))
        .stroke(egui::Stroke::new(
            1.0,
            egui::Color32::from_rgba_unmultiplied(
                tone.text().r(),
                tone.text().g(),
                tone.text().b(),
                60,
            ),
        ))
        .show(ui, |ui| {
            ui.label(
                egui::RichText::new(label)
                    .size(11.0)
                    .strong()
                    .color(tone.text()),
            );
        });
}

pub fn primary_button(ui: &mut egui::Ui, label: &str) -> egui::Response {
    let btn = egui::Button::new(
        egui::RichText::new(label)
            .color(colors::BG_APP)
            .strong()
            .size(13.0),
    )
    .fill(colors::ACCENT)
    .corner_radius(egui::CornerRadius::same(8))
    .min_size(egui::vec2(0.0, 34.0));

    ui.add(btn)
}

pub fn primary_button_small(ui: &mut egui::Ui, label: &str) -> egui::Response {
    ui.add(
        egui::Button::new(
            egui::RichText::new(label)
                .color(colors::BG_APP)
                .strong()
                .size(12.0),
        )
        .fill(colors::ACCENT)
        .corner_radius(egui::CornerRadius::same(6))
        .min_size(egui::vec2(0.0, 28.0)),
    )
}

pub fn secondary_button(ui: &mut egui::Ui, label: &str) -> egui::Response {
    let btn = egui::Button::new(
        egui::RichText::new(label)
            .color(colors::TEXT_PRIMARY)
            .size(13.0),
    )
    .fill(colors::SURFACE_2)
    .stroke(egui::Stroke::new(
        1.0,
        egui::Color32::from_rgba_unmultiplied(48, 64, 98, 160),
    ))
    .corner_radius(egui::CornerRadius::same(8))
    .min_size(egui::vec2(0.0, 34.0));

    ui.add(btn)
}

pub fn secondary_button_small(ui: &mut egui::Ui, label: &str) -> egui::Response {
    ui.add(
        egui::Button::new(
            egui::RichText::new(label)
                .color(colors::TEXT_PRIMARY)
                .size(12.0),
        )
        .fill(colors::SURFACE_2)
        .stroke(egui::Stroke::new(
            1.0,
            egui::Color32::from_rgba_unmultiplied(48, 64, 98, 140),
        ))
        .corner_radius(egui::CornerRadius::same(6))
        .min_size(egui::vec2(0.0, 28.0)),
    )
}

pub fn danger_button(ui: &mut egui::Ui, label: &str) -> egui::Response {
    let btn = egui::Button::new(
        egui::RichText::new(label)
            .color(colors::BG_APP)
            .strong()
            .size(13.0),
    )
    .fill(colors::ERROR)
    .corner_radius(egui::CornerRadius::same(8))
    .min_size(egui::vec2(0.0, 36.0));

    ui.add(btn)
}

pub fn danger_button_small(ui: &mut egui::Ui, label: &str) -> egui::Response {
    ui.add(
        egui::Button::new(
            egui::RichText::new(label)
                .color(colors::BG_APP)
                .strong()
                .size(12.0),
        )
        .fill(colors::ERROR)
        .corner_radius(egui::CornerRadius::same(6))
        .min_size(egui::vec2(0.0, 28.0)),
    )
}

/// Tiny button used for inline actions (export, view, open, etc.)
pub fn tiny_button(ui: &mut egui::Ui, label: &str) -> egui::Response {
    ui.add(
        egui::Button::new(
            egui::RichText::new(label)
                .color(colors::TEXT_SECONDARY)
                .size(11.0),
        )
        .fill(colors::SURFACE_2)
        .stroke(egui::Stroke::new(
            1.0,
            egui::Color32::from_rgba_unmultiplied(48, 64, 98, 120),
        ))
        .corner_radius(egui::CornerRadius::same(4))
        .min_size(egui::vec2(0.0, 22.0)),
    )
}

pub fn empty_state(
    ui: &mut egui::Ui,
    icon: &str,
    title: &str,
    description: &str,
    primary_action: Option<(&str, &mut dyn FnMut())>,
) -> egui::Response {
    let mut clicked = None;
    let response = egui::Frame::new()
        .fill(colors::SURFACE_1)
        .stroke(egui::Stroke::new(
            1.0,
            egui::Color32::from_rgba_unmultiplied(48, 64, 98, 100),
        ))
        .corner_radius(egui::CornerRadius::same(12))
        .inner_margin(egui::Margin::symmetric(16, 24))
        .show(ui, |ui| {
            ui.set_min_height(140.0);
            ui.vertical_centered(|ui| {
                ui.add_space(4.0);

                egui::Frame::new()
                    .fill(colors::accent_soft())
                    .corner_radius(egui::CornerRadius::same(12))
                    .inner_margin(egui::Margin::same(10))
                    .show(ui, |ui| {
                        ui.label(egui::RichText::new(icon).size(20.0).color(colors::ACCENT));
                    });

                ui.add_space(8.0);
                ui.label(
                    egui::RichText::new(title)
                        .text_style(egui::TextStyle::Name("SectionTitle".into()))
                        .strong()
                        .color(colors::TEXT_PRIMARY),
                );

                ui.add_space(4.0);
                ui.label(
                    egui::RichText::new(description)
                        .color(colors::TEXT_SECONDARY)
                        .small(),
                );

                ui.add_space(10.0);

                if let Some((label, action)) = primary_action {
                    if primary_button(ui, label).clicked() {
                        clicked = Some(action);
                    }
                }
            });
        })
        .response;

    if let Some(action) = clicked {
        action();
    }
    response
}

pub fn inline_alert(
    ui: &mut egui::Ui,
    tone: Tone,
    title: &str,
    description: &str,
    action_label: Option<&str>,
) -> Option<egui::Response> {
    let mut clicked = None;
    let response = egui::Frame::new()
        .fill(tone.soft_bg())
        .stroke(egui::Stroke::new(
            1.0,
            egui::Color32::from_rgba_unmultiplied(
                tone.text().r(),
                tone.text().g(),
                tone.text().b(),
                60,
            ),
        ))
        .corner_radius(egui::CornerRadius::same(8))
        .inner_margin(egui::Margin::symmetric(12, 10))
        .show(ui, |ui| {
            ui.vertical(|ui| {
                ui.horizontal(|ui| {
                    ui.label(
                        egui::RichText::new(title)
                            .size(12.0)
                            .strong()
                            .color(tone.text()),
                    );
                });
                ui.add_space(2.0);
                ui.label(
                    egui::RichText::new(description)
                        .size(11.0)
                        .color(colors::TEXT_SECONDARY),
                );
                if let Some(label) = action_label {
                    ui.add_space(6.0);
                    if primary_button(ui, label).clicked() {
                        clicked = Some(ui.response().clone());
                    }
                }
            });
        })
        .response;

    clicked.or(Some(response))
}

/// Render a styled card frame with background, border, and subtle shadow.
pub fn card_frame(_style: &egui::Style) -> egui::Frame {
    egui::Frame::NONE
        .fill(colors::CARD_BG)
        .stroke(egui::Stroke::new(
            1.0,
            egui::Color32::from_rgba_unmultiplied(48, 64, 98, 120),
        ))
        .corner_radius(egui::CornerRadius::same(10))
        .inner_margin(egui::Margin::symmetric(14, 10))
        .outer_margin(egui::Margin::same(0))
        .shadow(egui::Shadow {
            offset: [0, 1],
            blur: 4,
            spread: 0,
            color: egui::Color32::from_rgba_unmultiplied(0, 0, 0, 30),
        })
}

/// Render a section header with optional Phosphor icon and strong text.
pub fn section_heading(ui: &mut egui::Ui, icon: Option<&'static str>, text: &str) {
    ui.add_space(2.0);
    ui.horizontal(|ui| {
        if let Some(icon_str) = icon {
            ui.label(
                egui::RichText::new(icon_str)
                    .size(13.0)
                    .color(colors::ACCENT),
            );
            ui.add_space(2.0);
        }
        ui.label(
            egui::RichText::new(text)
                .size(12.0)
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
            ui.add_space(2.0);
            ui.label(egui::RichText::new(value).size(22.0).strong().color(accent));
            ui.label(
                egui::RichText::new(label)
                    .size(11.0)
                    .color(colors::TEXT_SECONDARY),
            );
            ui.add_space(2.0);
        });
    });
}

/// Render a colored badge (pill-shaped label).
pub fn badge(ui: &mut egui::Ui, text: &str, bg: egui::Color32) {
    egui::Frame::NONE
        .fill(bg.linear_multiply(0.2))
        .corner_radius(egui::CornerRadius::same(6))
        .inner_margin(egui::Margin::symmetric(8, 3))
        .stroke(egui::Stroke::new(1.0, bg.linear_multiply(0.4)))
        .show(ui, |ui| {
            ui.label(egui::RichText::new(text).size(10.0).strong().color(bg));
        });
}

/// Render a horizontal gauge bar (0.0..=1.0) with color coding.
pub fn gauge_bar(ui: &mut egui::Ui, value: f32, width: f32, height: f32) {
    let (color, bg) = if value > 0.9 {
        (colors::ERROR, colors::ERROR.linear_multiply(0.15))
    } else if value > 0.7 {
        (colors::WARNING, colors::WARNING.linear_multiply(0.15))
    } else if value > 0.5 {
        (
            colors::PRIORITY_HIGH,
            colors::PRIORITY_HIGH.linear_multiply(0.15),
        )
    } else {
        (colors::SUCCESS, colors::SUCCESS.linear_multiply(0.15))
    };

    let (response, painter) = ui.allocate_painter(egui::vec2(width, height), egui::Sense::hover());
    let rect = response.rect;
    let radius = egui::CornerRadius::same((height / 2.0) as u8);

    // Background
    painter.rect_filled(rect, radius, bg);

    // Fill
    let fill_width = (rect.width() * value.clamp(0.0, 1.0)).max(0.0);
    if fill_width > 0.0 {
        let fill_rect = egui::Rect::from_min_size(rect.min, egui::vec2(fill_width, rect.height()));
        painter.rect_filled(fill_rect, radius, color);
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
        gauge_bar(ui, value, ui.available_width(), 6.0);
        if let Some(d) = detail {
            ui.add_space(1.0);
            ui.label(egui::RichText::new(d).size(10.0).color(colors::TEXT_MUTED));
        }
    });
}

/// Create a RichText icon from Phosphor icon string
pub fn icon_text(icon: &'static str, size: f32, color: egui::Color32) -> egui::RichText {
    egui::RichText::new(icon).size(size).color(color)
}
