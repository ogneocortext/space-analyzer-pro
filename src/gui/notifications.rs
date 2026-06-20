use eframe::egui;

use super::types::{FileAction, FileActionType, Notification, NotificationLevel};

/// Render file action confirmation dialog
pub fn render_file_action_confirm(
    ui: &mut egui::Ui,
    file_action_confirm_open: &mut bool,
    pending_file_action: &mut Option<FileAction>,
    notifications: &mut Vec<Notification>,
    notification_counter: &mut u64,
) {
    if !*file_action_confirm_open {
        return;
    }

    let action = pending_file_action.clone();
    if let Some(action) = action {
        let is_trash = action.action == FileActionType::MoveToTrash;
        let title = if is_trash {
            "Move to Trash"
        } else {
            "Delete File"
        };
        let msg = format!("Are you sure you want to {} '{}'", title, action.path);

        egui::Modal::new(egui::Id::new("file_action_confirm"))
            .frame(
                egui::Frame::new()
                    .fill(super::colors::CARD_BG)
                    .corner_radius(12.0),
            )
            .show(ui.ctx(), |ui| {
                ui.vertical(|ui| {
                    ui.label(
                        egui::RichText::new(title)
                            .size(18.0)
                            .strong()
                            .color(super::colors::ERROR),
                    );
                    ui.add_space(8.0);
                    ui.label(egui::RichText::new(&msg).color(super::colors::TEXT_SECONDARY));
                    ui.add_space(16.0);
                    ui.horizontal(|ui| {
                        let confirm_btn = egui::Button::new(
                            egui::RichText::new("Confirm")
                                .strong()
                                .color(egui::Color32::WHITE),
                        )
                        .fill(super::colors::ERROR);
                        if ui.add(confirm_btn).clicked() {
                            let path = action.path.clone();
                            match action.action {
                                FileActionType::MoveToTrash => {
                                    if let Err(e) = trash::delete(&path) {
                                        push_notification(
                                            notifications,
                                            notification_counter,
                                            format!("Failed to trash: {}", e),
                                            NotificationLevel::Error,
                                        );
                                    } else {
                                        push_notification(
                                            notifications,
                                            notification_counter,
                                            format!("Moved to trash: {}", path),
                                            NotificationLevel::Success,
                                        );
                                    }
                                }
                                FileActionType::Delete => {
                                    if let Err(e) = std::fs::remove_file(&path) {
                                        push_notification(
                                            notifications,
                                            notification_counter,
                                            format!("Failed: {}", e),
                                            NotificationLevel::Error,
                                        );
                                    } else {
                                        push_notification(
                                            notifications,
                                            notification_counter,
                                            format!("Deleted: {}", path),
                                            NotificationLevel::Success,
                                        );
                                    }
                                }
                            }
                            *file_action_confirm_open = false;
                            *pending_file_action = None;
                        }

                        if ui.button("Cancel").clicked() {
                            *file_action_confirm_open = false;
                            *pending_file_action = None;
                        }
                    });
                });
            });
    }
}

/// Render toast notifications in the top-right corner
pub fn render_notifications(ui: &mut egui::Ui, notifications: &[Notification]) {
    if notifications.is_empty() {
        return;
    }

    let mut y_offset = 10.0;

    for notif in notifications {
        let age = notif.created_at.elapsed().as_secs_f64();
        let alpha = if age > 4.0 {
            ((5.0 - age) * 255.0) as u8
        } else {
            255
        };

        let bg_color = egui::Color32::from_rgba_premultiplied(40, 40, 40, alpha);
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
