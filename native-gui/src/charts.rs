#[cfg(feature = "charts")]
mod backend {
    use egui::ColorImage;
    use crate::types::{FileInfo, DriveInfo};
    use std::collections::HashMap;
    use plotters::prelude::*;

    const CHART_W: u32 = 780;
    const CHART_H: u32 = 360;

    fn render_to<F>(draw: F) -> ColorImage
    where
        F: FnOnce(&DrawingArea<BitMapBackend, plotters::coord::Shift>),
    {
        let mut buf = vec![0u8; (CHART_W * CHART_H * 4) as usize];
        {
            let backend = BitMapBackend::with_buffer(&mut buf, (CHART_W, CHART_H));
            let root = backend.into_drawing_area();
            root.fill(&RGBColor(24, 24, 27)).ok();
            draw(&root);
        }
        ColorImage::from_rgba_unmultiplied([CHART_W as usize, CHART_H as usize], &buf)
    }

    pub fn render_file_types_chart(file_types: &HashMap<String, u64>) -> ColorImage {
        let mut types: Vec<(&str, u64)> = file_types.iter().map(|(k, v)| (k.as_str(), *v)).collect();
        types.sort_by(|a, b| b.1.cmp(&a.1));
        types.truncate(12);

        if types.is_empty() {
            return empty("No file type data");
        }

        let labels: Vec<String> = types.iter().map(|(k, _)| if k.is_empty() { "(none)".into() } else { k.to_string() }).collect();

        render_to(|root| {
            let max_val = types.iter().map(|(_, v)| *v).max().unwrap_or(1);
            let n = types.len();
            let x_max = n as f64;

            let mut chart = ChartBuilder::on(root)
                .caption("File Types by Count", ("sans-serif", 20, &RGBColor(200, 200, 200)))
                .margin(12)
                .x_label_area_size(28)
                .y_label_area_size(100)
                .build_cartesian_2d(0.0..x_max, 0u64..max_val + max_val / 10 + 1)
                .expect("chart");

            chart.configure_mesh()
                .x_label_formatter(&|v: &f64| {
                    let idx = v.round() as usize;
                    if idx < labels.len() { labels[idx].clone() } else { String::new() }
                })
                .x_labels(n)
                .draw()
                .ok();

            let palette = [
                &RGBColor(100, 149, 237), &RGBColor(76, 175, 80),
                &RGBColor(255, 152, 0), &RGBColor(156, 39, 176),
                &RGBColor(244, 67, 54), &RGBColor(0, 188, 212),
                &RGBColor(255, 87, 34), &RGBColor(63, 81, 181),
                &RGBColor(139, 195, 74), &RGBColor(233, 30, 99),
                &RGBColor(96, 125, 139), &RGBColor(255, 193, 7),
            ];

            chart.draw_series(types.iter().enumerate().map(|(i, (_, val))| {
                let c = palette[i % palette.len()];
                let x = i as f64;
                Rectangle::new([(x - 0.35, 0u64), (x + 0.35, *val)], c.filled())
            }))
            .ok();
        })
    }

    pub fn render_largest_files_chart(largest_files: &[FileInfo]) -> ColorImage {
        let mut files: Vec<&FileInfo> = largest_files.iter().collect();
        files.sort_by(|a, b| b.size.cmp(&a.size));
        files.truncate(10);

        if files.is_empty() {
            return empty("No file data");
        }

        let names: Vec<String> = files.iter().map(|f| abbr(&f.name, 28)).collect();

        render_to(|root| {
            let max_sz = files.iter().map(|f| f.size).max().unwrap_or(1);
            let n = files.len();
            let y_max = n as f64;

            let mut chart = ChartBuilder::on(root)
                .caption("Largest Files", ("sans-serif", 20, &RGBColor(200, 200, 200)))
                .margin(12)
                .x_label_area_size(28)
                .y_label_area_size(110)
                .build_cartesian_2d(0u64..max_sz + max_sz / 10 + 1, 0.0..y_max)
                .expect("chart");

            chart.configure_mesh()
                .y_label_formatter(&|v: &f64| {
                    let idx = v.round() as usize;
                    if idx < names.len() { names[idx].clone() } else { String::new() }
                })
                .y_labels(n)
                .x_label_formatter(&|v: &u64| fmt_bytes(*v))
                .draw()
                .ok();

            chart.draw_series(files.iter().enumerate().map(|(i, f)| {
                let frac = f.size as f64 / max_sz as f64;
                let r = (100 + (155.0 * frac) as u8).min(255);
                let g = (100 + (155.0 * (1.0 - frac)) as u8).min(255);
                let y = i as f64;
                Rectangle::new([(0u64, y - 0.35), (f.size, y + 0.35)], RGBColor(r, g, 80).filled())
            }))
            .ok();
        })
    }

    pub fn render_drives_chart(drives: &[DriveInfo]) -> ColorImage {
        if drives.is_empty() {
            return empty("No drive data");
        }

        let names: Vec<String> = drives.iter().map(|d| abbr(&d.mount_point, 15)).collect();

        render_to(|root| {
            let max_sp = drives.iter().map(|d| d.total_space).max().unwrap_or(1);
            let n = drives.len();
            let y_max = n as f64;

            let mut chart = ChartBuilder::on(root)
                .caption("Drive Usage", ("sans-serif", 20, &RGBColor(200, 200, 200)))
                .margin(12)
                .x_label_area_size(28)
                .y_label_area_size(80)
                .build_cartesian_2d(0u64..max_sp + max_sp / 10 + 1, 0.0..y_max)
                .expect("chart");

            chart.configure_mesh()
                .y_label_formatter(&|v: &f64| {
                    let idx = v.round() as usize;
                    if idx < names.len() { names[idx].clone() } else { String::new() }
                })
                .y_labels(n)
                .x_label_formatter(&|v: &u64| fmt_bytes(*v))
                .draw()
                .ok();

            chart.draw_series(drives.iter().enumerate().map(|(i, d)| {
                let used = d.total_space - d.available_space;
                let frac = used as f64 / d.total_space as f64;
                let color = if frac > 0.9 {
                    RGBColor(244, 67, 54)
                } else if frac > 0.75 {
                    RGBColor(255, 152, 0)
                } else {
                    RGBColor(76, 175, 80)
                };
                let y = i as f64;
                Rectangle::new([(0u64, y - 0.35), (used, y + 0.35)], color.filled())
            }))
            .ok();

            chart.draw_series(drives.iter().enumerate().map(|(i, d)| {
                let y = i as f64;
                Rectangle::new(
                    [(d.available_space, y - 0.35), (d.total_space, y + 0.35)],
                    RGBColor(60, 60, 65).filled(),
                )
            }))
            .ok();
        })
    }

    fn empty(msg: &str) -> ColorImage {
        render_to(|root| {
            root.draw_text(
                msg,
                &("sans-serif", 18).into_font().color(&RGBColor(100, 100, 100)),
                (CHART_W as i32 / 2, CHART_H as i32 / 2),
            )
            .ok();
        })
    }

    fn fmt_bytes(s: u64) -> String {
        let units = ["B", "KB", "MB", "GB", "TB"];
        let mut v = s as f64;
        let mut i = 0;
        while v >= 1024.0 && i < units.len() - 1 { v /= 1024.0; i += 1; }
        if i == 0 { format!("{s} {}", units[i]) } else { format!("{:.1} {}", v, units[i]) }
    }

    fn abbr(name: &str, max: usize) -> String {
        if name.len() <= max { name.into() } else { format!("{}...", &name[..max.saturating_sub(3)]) }
    }
}

#[cfg(not(feature = "charts"))]
mod backend {
    use egui::ColorImage;
    use crate::types::{FileInfo, DriveInfo};
    use std::collections::HashMap;

    pub fn render_file_types_chart(_: &HashMap<String, u64>) -> ColorImage { ColorImage::new([0, 0]) }
    pub fn render_largest_files_chart(_: &[FileInfo]) -> ColorImage { ColorImage::new([0, 0]) }
    pub fn render_drives_chart(_: &[DriveInfo]) -> ColorImage { ColorImage::new([0, 0]) }
}

pub use backend::*;
