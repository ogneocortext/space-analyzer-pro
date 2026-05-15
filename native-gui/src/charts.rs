//! Interactive egui-native charts with hover tooltips and click-to-filter

use egui::{Color32, Response, Sense, Ui, Vec2};
use crate::types::{FileInfo, DriveInfo};
use std::collections::HashMap;

const CHART_HEIGHT: f32 = 280.0;
const BAR_GAP: f32 = 4.0;
const LABEL_HEIGHT: f32 = 60.0;
const TITLE_HEIGHT: f32 = 24.0;

const BAR_COLORS: [Color32; 12] = [
    Color32::from_rgb(100, 149, 237), // Cornflower blue
    Color32::from_rgb(76, 175, 80),   // Green
    Color32::from_rgb(255, 152, 0),   // Orange
    Color32::from_rgb(156, 39, 176),  // Purple
    Color32::from_rgb(244, 67, 54),   // Red
    Color32::from_rgb(0, 188, 212),   // Cyan
    Color32::from_rgb(255, 87, 34),   // Deep orange
    Color32::from_rgb(63, 81, 181),   // Indigo
    Color32::from_rgb(139, 195, 74),  // Light green
    Color32::from_rgb(233, 30, 99),   // Pink
    Color32::from_rgb(96, 125, 139),  // Blue grey
    Color32::from_rgb(255, 193, 7),   // Amber
];

/// Result of rendering an interactive chart
pub struct ChartResult {
    pub response: Response,
    pub clicked_bar: Option<String>,
    pub hovered_bar: Option<String>,
}

/// Render an interactive bar chart for file types
/// Returns the clicked extension (if any) for filtering
pub fn file_types_chart(
    ui: &mut Ui,
    file_types: &HashMap<String, u64>,
    extension_sizes: &HashMap<String, u64>,
    total_files: u64,
    show_by_size: bool,
) -> ChartResult {
    let mut types: Vec<(String, u64, u64)> = file_types.iter()
        .map(|(k, v)| (k.clone(), *v, extension_sizes.get(k).copied().unwrap_or(0)))
        .collect();
    
    if show_by_size {
        types.sort_by(|a, b| b.2.cmp(&a.2));
    } else {
        types.sort_by(|a, b| b.1.cmp(&a.1));
    }
    types.truncate(15);

    if types.is_empty() {
        ui.label("No file type data");
        return ChartResult { response: ui.allocate_response(Vec2::ZERO, Sense::hover()), clicked_bar: None, hovered_bar: None };
    }

    let title = if show_by_size { "File Types by Size" } else { "File Types by Count" };
    ui.label(egui::RichText::new(title).size(14.0).strong());
    ui.add_space(4.0);

    let max_val = if show_by_size {
        types.iter().map(|(_, _, s)| *s).max().unwrap_or(1)
    } else {
        types.iter().map(|(_, c, _)| *c).max().unwrap_or(1)
    };

    let available_width = ui.available_width();
    let bar_width = ((available_width - BAR_GAP * (types.len() as f32 + 1.0)) / types.len() as f32).max(20.0);
    let chart_area_height = CHART_HEIGHT - LABEL_HEIGHT;

    let (rect, response) = ui.allocate_exact_size(Vec2::new(available_width, CHART_HEIGHT), Sense::click_and_drag());

    let mut clicked_bar = None;
    let mut hovered_bar = None;
    let mut tooltip_text = String::new();

    ui.painter().rect_filled(rect, 2.0, Color32::from_rgb(30, 30, 35));

    for (i, (ext, count, size)) in types.iter().enumerate() {
        let x = rect.min.x + BAR_GAP + i as f32 * (bar_width + BAR_GAP);
        let value = if show_by_size { *size } else { *count };
        let bar_height = (value as f32 / max_val as f32 * chart_area_height).min(chart_area_height);
        let bar_rect = egui::Rect::from_min_max(
            egui::pos2(x, rect.max.y - LABEL_HEIGHT - bar_height),
            egui::pos2(x + bar_width, rect.max.y - LABEL_HEIGHT),
        );

        let color = BAR_COLORS[i % BAR_COLORS.len()];
        let is_hovered = response.hover_pos().map_or(false, |p| bar_rect.contains(p));

        if is_hovered {
            ui.painter().rect_filled(bar_rect, 2.0, color.lighten(0.3));
            hovered_bar = Some(ext.clone());
            
            let pct = if show_by_size {
                format!("{:.1}% of space", *size as f64 / (total_files.max(1) as f64) * 100.0)
            } else {
                format!("{:.1}% of files", *count as f64 / (total_files.max(1) as f64) * 100.0)
            };
            tooltip_text = format!(".{}\n{} files\n{}\n{}", 
                ext, count, format_bytes(*size), pct);
        } else {
            ui.painter().rect_filled(bar_rect, 2.0, color);
        }

        // X-axis label
        let label = if ext.len() > 4 { format!(".{}", &ext[..3]) } else { format!(".{}", ext) };
        let text_color = if is_hovered { Color32::WHITE } else { Color32::from_gray(160) };
        ui.painter().text(
            egui::pos2(x + bar_width / 2.0, rect.max.y - LABEL_HEIGHT + 8.0),
            egui::Align2::CENTER_TOP,
            label,
            egui::FontId::proportional(9.0),
            text_color,
        );

        if response.clicked() && is_hovered {
            clicked_bar = Some(ext.clone());
        }
    }

    if !tooltip_text.is_empty() {
        ui.ctx().output_mut(|o| o.cursor_icon = egui::CursorIcon::PointingHand);
        egui::show_tooltip_text(ui.ctx(), egui::Id::new("chart_tooltip"), &tooltip_text);
    }

    ChartResult { response, clicked_bar, hovered_bar }
}

/// Render an interactive horizontal bar chart for largest files
pub fn largest_files_chart(ui: &mut Ui, largest_files: &[FileInfo]) -> ChartResult {
    let mut files: Vec<&FileInfo> = largest_files.iter().collect();
    files.sort_by(|a, b| b.size.cmp(&a.size));
    files.truncate(12);

    if files.is_empty() {
        ui.label("No file data");
        return ChartResult { response: ui.allocate_response(Vec2::ZERO, Sense::hover()), clicked_bar: None, hovered_bar: None };
    }

    ui.label(egui::RichText::new("Largest Files").size(14.0).strong());
    ui.add_space(4.0);

    let max_sz = files.iter().map(|f| f.size).max().unwrap_or(1);
    let row_height = 22.0;
    let chart_height = files.len() as f32 * row_height + 20.0;

    let (rect, response) = ui.allocate_exact_size(Vec2::new(ui.available_width(), chart_height), Sense::click_and_drag());

    let mut clicked_bar = None;
    let mut hovered_bar = None;
    let mut tooltip_text = String::new();

    ui.painter().rect_filled(rect, 2.0, Color32::from_rgb(30, 30, 35));

    for (i, f) in files.iter().enumerate() {
        let y = rect.min.y + 10.0 + i as f32 * row_height;
        let frac = f.size as f64 / max_sz as f64;
        let bar_width = (frac * (rect.width() - 140.0)) as f32;

        let bar_rect = egui::Rect::from_min_max(
            egui::pos2(rect.min.x + 130.0, y),
            egui::pos2(rect.min.x + 130.0 + bar_width.max(4.0), y + row_height - 4.0),
        );

        let is_hovered = response.hover_pos().map_or(false, |p| bar_rect.contains(p));
        let r = (100 + (155.0 * frac) as u8).min(255);
        let g = (100 + (155.0 * (1.0 - frac)) as u8).min(255);
        let color = Color32::from_rgb(r, g, 80);

        if is_hovered {
            ui.painter().rect_filled(bar_rect, 2.0, color.lighten(0.3));
            hovered_bar = Some(f.name.clone());
            tooltip_text = format!("{}\n{}\n{}", f.name, format_bytes(f.size), f.path);
        } else {
            ui.painter().rect_filled(bar_rect, 2.0, color);
        }

        // File name label
        let name = if f.name.len() > 16 { format!("{}...", &f.name[..13]) } else { f.name.clone() };
        ui.painter().text(
            egui::pos2(rect.min.x + 125.0, y + row_height / 2.0),
            egui::Align2::RIGHT_CENTER,
            name,
            egui::FontId::proportional(10.0),
            if is_hovered { Color32::WHITE } else { Color32::from_gray(180) },
        );

        // Size label at end of bar
        ui.painter().text(
            egui::pos2(bar_rect.max.x + 4.0, y + row_height / 2.0),
            egui::Align2::LEFT_CENTER,
            format_bytes(f.size),
            egui::FontId::proportional(9.0),
            Color32::from_gray(140),
        );

        if response.clicked() && is_hovered {
            clicked_bar = Some(f.path.clone());
        }
    }

    if !tooltip_text.is_empty() {
        ui.ctx().output_mut(|o| o.cursor_icon = egui::CursorIcon::PointingHand);
        egui::show_tooltip_text(ui.ctx(), egui::Id::new("chart_tooltip"), &tooltip_text);
    }

    ChartResult { response, clicked_bar, hovered_bar }
}

/// Render an interactive drive usage chart
pub fn drives_chart(ui: &mut Ui, drives: &[DriveInfo]) -> ChartResult {
    if drives.is_empty() {
        ui.label("No drive data");
        return ChartResult { response: ui.allocate_response(Vec2::ZERO, Sense::hover()), clicked_bar: None, hovered_bar: None };
    }

    ui.label(egui::RichText::new("Drive Usage").size(14.0).strong());
    ui.add_space(4.0);

    let row_height = 36.0;
    let chart_height = drives.len() as f32 * row_height + 10.0;

    let (rect, response) = ui.allocate_exact_size(Vec2::new(ui.available_width(), chart_height), Sense::click_and_drag());

    let mut clicked_bar = None;
    let mut hovered_bar = None;
    let mut tooltip_text = String::new();

    ui.painter().rect_filled(rect, 2.0, Color32::from_rgb(30, 30, 35));

    for (i, d) in drives.iter().enumerate() {
        let y = rect.min.y + 5.0 + i as f32 * row_height;
        let used = d.total_space - d.available_space;
        let frac = used as f64 / d.total_space.max(1) as f64;
        let bar_width = (frac * (rect.width() - 100.0)) as f32;

        let total_bar_rect = egui::Rect::from_min_max(
            egui::pos2(rect.min.x + 90.0, y),
            egui::pos2(rect.min.x + rect.width() - 10.0, y + row_height - 8.0),
        );

        let used_bar_rect = egui::Rect::from_min_max(
            egui::pos2(rect.min.x + 90.0, y),
            egui::pos2(rect.min.x + 90.0 + bar_width.max(4.0), y + row_height - 8.0),
        );

        let is_hovered = response.hover_pos().map_or(false, |p| total_bar_rect.contains(p));

        // Background (free space)
        ui.painter().rect_filled(total_bar_rect, 3.0, Color32::from_rgb(50, 50, 55));

        // Used space
        let used_color = if frac > 0.9 {
            Color32::from_rgb(244, 67, 54)
        } else if frac > 0.75 {
            Color32::from_rgb(255, 152, 0)
        } else {
            Color32::from_rgb(76, 175, 80)
        };

        if is_hovered {
            ui.painter().rect_filled(used_bar_rect, 3.0, used_color.lighten(0.2));
            hovered_bar = Some(d.mount_point.clone());
            tooltip_text = format!("{}\nUsed: {}\nFree: {}\nTotal: {}\n{:.1}% used",
                d.mount_point, format_bytes(used), format_bytes(d.available_space),
                format_bytes(d.total_space), frac * 100.0);
        } else {
            ui.painter().rect_filled(used_bar_rect, 3.0, used_color);
        }

        // Drive label
        ui.painter().text(
            egui::pos2(rect.min.x + 85.0, y + row_height / 2.0),
            egui::Align2::RIGHT_CENTER,
            &d.mount_point,
            egui::FontId::proportional(11.0),
            if is_hovered { Color32::WHITE } else { Color32::from_gray(180) },
        );

        // Percentage label inside bar
        if bar_width > 40.0 {
            ui.painter().text(
                egui::pos2(used_bar_rect.center().x, used_bar_rect.center().y),
                egui::Align2::CENTER_CENTER,
                format!("{:.0}%", frac * 100.0),
                egui::FontId::proportional(10.0),
                Color32::WHITE,
            );
        }

        if response.clicked() && is_hovered {
            clicked_bar = Some(d.mount_point.clone());
        }
    }

    if !tooltip_text.is_empty() {
        ui.ctx().output_mut(|o| o.cursor_icon = egui::CursorIcon::PointingHand);
        egui::show_tooltip_text(ui.ctx(), egui::Id::new("chart_tooltip"), &tooltip_text);
    }

    ChartResult { response, clicked_bar, hovered_bar }
}

fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut i = 0;
    while size >= 1024.0 && i < UNITS.len() - 1 { size /= 1024.0; i += 1; }
    if i == 0 { format!("{} {}", bytes, UNITS[i]) } else { format!("{:.1} {}", size, UNITS[i]) }
}
