use eframe::egui;

use super::types::{Notification, NotificationLevel};
use super::ui_helpers;
use crate::file_relations::analyze_file_dependencies;

/// Render toast notifications in the top-right corner
pub fn render_notifications(ui: &mut egui::Ui, notifications: &[Notification]) {
    if notifications.is_empty() {
        return;
    }

    let mut y_offset = 10.0;

    for notif in notifications {
        let age = notif.created_at.elapsed().as_secs_f64();
        let alpha = if age > 4.0 {
            ((5.0 - age) * 255.0).clamp(0.0, 255.0) as u8
        } else {
            255
        };

        let bg_color = egui::Color32::from_rgba_unmultiplied(40, 40, 40, alpha);
        let text_color = notif.color();

        let notif_text = format!("{} {}", notif.icon(), notif.message);
        let ctx = ui.ctx().clone();

        egui::Area::new(egui::Id::new(("notification", notif.id)))
            .anchor(egui::Align2::RIGHT_TOP, [-10.0, y_offset])
            .show(&ctx, |ui| {
                egui::Frame::NONE
                    .fill(bg_color)
                    .corner_radius(egui::CornerRadius::same(8))
                    .inner_margin(12.0)
                    .show(ui, |ui| {
                        ui.set_min_width(280.0);
                        ui.style_mut().wrap_mode = Some(egui::TextWrapMode::Truncate);
                        ui.label(egui::RichText::new(notif_text).color(text_color).strong());
                    });
            });

        y_offset += 45.0;
    }
}

/// Push a toast notification
pub fn push_notification(
    notifications: &mut Vec<Notification>,
    counter: &mut u64,
    message: impl Into<String>,
    level: NotificationLevel,
) {
    *counter += 1;
    notifications.push(Notification::new(message, level));
    // Keep only the last 5 notifications
    if notifications.len() > 5 {
        notifications.remove(0);
    }
}

/// Render the destructive-action impact preview modal.
pub fn render_impact_preview(
    ui: &mut egui::Ui,
    is_open: &mut bool,
    path_input: &mut String,
    report: &mut Option<crate::file_relations::DependencyReport>,
) {
    if !*is_open {
        return;
    }

    let mut should_close = false;
    let mut should_analyze = false;

    egui::Modal::new(egui::Id::new("impact_preview"))
        .frame(
            egui::Frame::new()
                .fill(super::colors::CARD_BG)
                .corner_radius(12.0),
        )
        .show(ui.ctx(), |ui| {
            ui.vertical(|ui| {
                ui.label(
                    egui::RichText::new("Preview Impact")
                        .size(18.0)
                        .strong()
                        .color(super::colors::ACCENT),
                );
                ui.add_space(8.0);
                ui.label(
                    egui::RichText::new(
                        "See what depends on this file before deleting or moving it.",
                    )
                    .size(12.0)
                    .color(super::colors::TEXT_SECONDARY),
                );
                ui.add_space(12.0);
                ui.horizontal(|ui| {
                    ui.label("File path:");
                    ui.text_edit_singleline(path_input);
                    if ui_helpers::primary_button_small(ui, "Analyze").clicked() {
                        should_analyze = true;
                    }
                });
                ui.add_space(12.0);

                if should_analyze && !path_input.is_empty() {
                    *report = Some(analyze_file_dependencies(path_input));
                }

                if let Some(ref r) = report {
                    ui.separator();
                    ui.label(
                        egui::RichText::new("Impact Report")
                            .size(14.0)
                            .strong()
                            .color(super::colors::TEXT_PRIMARY),
                    );
                    ui.add_space(6.0);
                    for line in r.summary.lines() {
                        ui.label(egui::RichText::new(line).size(12.0));
                    }
                    ui.add_space(6.0);
                    if !r.symlink_sources.is_empty() {
                        ui.label(
                            egui::RichText::new("Symlinks pointing here:")
                                .size(12.0)
                                .color(super::colors::WARNING),
                        );
                        for s in r.symlink_sources.iter().take(10) {
                            ui.label(egui::RichText::new(format!("  {}", s.path)).size(11.0));
                        }
                    }
                    if !r.same_stem_files.is_empty() {
                        ui.label(
                            egui::RichText::new("Same-name files:")
                                .size(12.0)
                                .color(super::colors::INFO),
                        );
                        for s in r.same_stem_files.iter().take(10) {
                            ui.label(egui::RichText::new(format!("  {}", s.path)).size(11.0));
                        }
                    }
                }

                ui.add_space(16.0);
                if ui_helpers::secondary_button_small(ui, "Close").clicked() {
                    should_close = true;
                }
            });
        });

    if should_close {
        *is_open = false;
    }
}
