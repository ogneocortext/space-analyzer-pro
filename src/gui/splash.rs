use eframe::egui;

use super::colors;

/// Render the welcome splash screen shown on app startup.
///
/// Fades in over the first ~60 frames and auto-dismisses after 120 frames
/// (≈2 s at 60 fps), or immediately when the user clicks "Get Started"
/// or presses Enter.
pub fn render_welcome_splash(ui: &mut egui::Ui, startup_frame: u64, show_welcome: &mut bool) {
    let fade = (startup_frame as f32 / 60.0).clamp(0.0, 1.0);
    let bg_color = egui::Color32::from_rgb(99, 102, 241);
    let accent_color = egui::Color32::from_rgb(168, 85, 247);
    let splash_bg = ui.style().visuals.extreme_bg_color;

    // Allow Enter / Space to dismiss
    if ui.input(|i| i.key_pressed(egui::Key::Enter) || i.key_pressed(egui::Key::Space)) {
        *show_welcome = false;
    }

    egui::Frame::NONE.fill(splash_bg).show(ui, |ui| {
        ui.vertical_centered(|ui| {
            ui.add_space(ui.available_height() * 0.18);

            let icon_size = 96.0 + (fade * 16.0);
            let (rect, _) =
                ui.allocate_exact_size(egui::vec2(icon_size, icon_size), egui::Sense::hover());
            let center = rect.center();
            let painter = ui.painter_at(rect);

            let bg_rect = egui::Rect::from_center_size(center, egui::vec2(icon_size, icon_size));
            painter.rect_filled(bg_rect, 18.0, bg_color);

            let ring_pad = icon_size * 0.22;
            painter.circle_stroke(
                center,
                (icon_size - ring_pad) * 0.5,
                egui::Stroke::new(5.0, egui::Color32::WHITE),
            );
            let ring2_pad = icon_size * 0.35;
            painter.circle_stroke(
                center,
                (icon_size - ring2_pad) * 0.5,
                egui::Stroke::new(5.0, egui::Color32::WHITE),
            );
            let center_size = icon_size * 0.18;
            painter.circle_filled(
                center,
                center_size * 0.5,
                egui::Color32::from_rgb(6, 182, 212),
            );

            ui.add_space(28.0);

            let mut title_job = egui::text::LayoutJob::default();
            title_job.append(
                "Space Analyzer ",
                0.0,
                egui::TextFormat {
                    font_id: egui::FontId::proportional(42.0),
                    color: egui::Color32::WHITE.gamma_multiply(fade),
                    ..Default::default()
                },
            );
            title_job.append(
                "Pro",
                0.0,
                egui::TextFormat {
                    font_id: egui::FontId::proportional(42.0),
                    color: accent_color.gamma_multiply(fade),
                    ..Default::default()
                },
            );
            ui.label(title_job);

            ui.add_space(8.0);

            ui.label(
                egui::RichText::new(format!(
                    "v{}  ·  Native Windows Desktop",
                    env!("CARGO_PKG_VERSION")
                ))
                .size(14.0)
                .color(colors::TEXT_MUTED.gamma_multiply(fade)),
            );

            ui.add_space(32.0);

            ui.horizontal(|ui| {
                ui.spacing_mut().item_spacing.x = 10.0;
                for pill in [
                    "8 GUI Tabs",
                    "12+ LLM Tools",
                    "GPU Accelerated",
                    "SQLite Embedded",
                ] {
                    let pill_size = egui::vec2(130.0, 30.0);
                    let (pill_rect, _) = ui.allocate_exact_size(pill_size, egui::Sense::hover());
                    ui.painter().rect_stroke(
                        pill_rect,
                        14.0,
                        egui::Stroke::new(1.0, colors::ACCENT_DIM),
                        egui::StrokeKind::Inside,
                    );
                    ui.painter().text(
                        pill_rect.center(),
                        egui::Align2::CENTER_CENTER,
                        pill,
                        egui::FontId::proportional(11.0),
                        colors::ACCENT.gamma_multiply(fade),
                    );
                }
            });

            ui.add_space(40.0);

            if fade > 0.3 {
                let btn = egui::Button::new(
                    egui::RichText::new("  Get Started  ")
                        .size(15.0)
                        .strong()
                        .color(egui::Color32::WHITE),
                )
                .fill(colors::ACCENT)
                .corner_radius(20.0);
                if ui.add(btn).clicked() {
                    *show_welcome = false;
                }
                ui.add_space(8.0);
                ui.label(
                    egui::RichText::new("or press Enter")
                        .size(10.0)
                        .italics()
                        .color(colors::TEXT_MUTED),
                );
            }

            ui.add_space(ui.available_height() * 0.0);
            ui.vertical_centered(|ui| {
                ui.label(
                    egui::RichText::new("F5 = scan  ·  Ctrl+S = save settings  ·  ? = help")
                        .size(11.0)
                        .color(colors::TEXT_MUTED.gamma_multiply(0.7 * fade)),
                );
            });
        });
    });
}
