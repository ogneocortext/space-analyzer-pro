//! Professional Vector Icons for Space Analyzer Pro
use egui::{Color32, Painter, Pos2, Rect, Shape, Stroke, Vec2};

pub const ICON_STROKE: f32 = 2.0;

pub fn draw_icon(painter: &Painter, icon: &str, rect: Rect, color: Color32) {
    match icon {
        "scan" => draw_folder(painter, rect, color),
        "history" => draw_history(painter, rect, color),
        "disk" => draw_disk(painter, rect, color),
        "system" => draw_system(painter, rect, color),
        "trend" => draw_trend(painter, rect, color),
        "workflow" => draw_workflow(painter, rect, color),
        "filetype" => draw_filetype(painter, rect, color),
        "predict" => draw_predict(painter, rect, color),
        "pattern" => draw_pattern(painter, rect, color),
        "tool" => draw_tool(painter, rect, color),
        "quick" => draw_quick(painter, rect, color),
        "model" => draw_model(painter, rect, color),
        "index" => draw_index(painter, rect, color),
        "security" => draw_security(painter, rect, color),
        "cleanup" => draw_cleanup(painter, rect, color),
        "performance" => draw_performance(painter, rect, color),
        "check" => draw_check(painter, rect, color),
        "warning" => draw_warning(painter, rect, color),
        _ => draw_default(painter, rect, color),
    }
}

fn draw_folder(p: &Painter, r: Rect, _c: Color32) {
    let cx = r.center().x;
    let cy = r.center().y;
    let w = r.width() * 0.6;
    let h = r.height() * 0.5;
    let fc = Color32::from_rgb(41, 128, 185);
    p.rect_filled(Rect::from_center_size(Pos2::new(cx, cy + 1.0), Vec2::new(w, h)), 4.0, fc);
    p.rect_filled(Rect::from_center_size(Pos2::new(cx - w * 0.3, cy - h * 0.4), Vec2::new(w * 0.5, h * 0.5)), 4.0, fc);
}

fn draw_history(p: &Painter, r: Rect, color: Color32) {
    let c = r.center();
    let rad = r.width().min(r.height()) * 0.35;
    p.circle_filled(c, rad, Color32::from_rgb(52, 152, 219));
    p.circle_filled(c, rad * 0.6, Color32::WHITE);
    p.add(Shape::line_segment([c, c + Vec2::new(0.0, -rad * 0.4)], Stroke::new(2.0, color)));
    p.add(Shape::line_segment([c, c + Vec2::new(rad * 0.3, 0.0)], Stroke::new(2.0, color)));
}

fn draw_disk(p: &Painter, r: Rect, color: Color32) {
    let c = r.center();
    let w = r.width() * 0.7;
    let h = r.height() * 0.5;
    p.rect_filled(Rect::from_center_size(c, Vec2::new(w, h)), 6.0, Color32::from_gray(65));
    let sh = h * 0.4;
    p.rect_filled(Rect::from_center_size(c, Vec2::new(w * 0.8, sh)), 3.0, Color32::from_gray(45));
    for i in 0..3 {
        let y = c.y - sh * 0.3 + i as f32 * sh * 0.5;
        p.add(Shape::line_segment([c + Vec2::new(-w * 0.35, y), c + Vec2::new(w * 0.35, y)], Stroke::new(1.0, Color32::from_gray(80))));
    }
}

fn draw_system(p: &Painter, r: Rect, color: Color32) {
    let c = r.center();
    let w = r.width() * 0.6;
    let h = r.height() * 0.4;
    p.rect_filled(Rect::from_center_size(c, Vec2::new(w, h)), 4.0, Color32::from_gray(40));
    p.rect_filled(Rect::from_center_size(c - Vec2::new(0.0, h * 0.25), Vec2::new(w * 0.7, h * 0.4)), 2.0, Color32::from_gray(30));
    p.rect_filled(Rect::from_center_size(c + Vec2::new(0.0, h * 0.3), Vec2::new(w * 0.4, h * 0.25)), 4.0, Color32::from_gray(55));
}

fn draw_trend(p: &Painter, r: Rect, _color: Color32) {
    let s = r.width().min(r.height());
    p.rect_filled(r, 4.0, Color32::from_rgb(30, 50, 30));
    let pts = [r.min + Vec2::new(4.0, s - 4.0), r.min + Vec2::new(s * 0.3, s * 0.4), r.min + Vec2::new(s * 0.6, s * 0.6), r.max - Vec2::new(4.0, 4.0)];
    for i in 0..pts.len()-1 { p.add(Shape::line_segment([pts[i], pts[i+1]], Stroke::new(ICON_STROKE, Color32::from_rgb(50, 200, 100)))); }
}

fn draw_workflow(p: &Painter, r: Rect, color: Color32) {
    let c = r.center();
    let rad = r.width().min(r.height()) * 0.4;
    p.circle_filled(c, rad, Color32::from_rgb(155, 89, 182));
    for i in 0..8 {
        let a = std::f32::consts::PI * 2.0 * i as f32 / 8.0;
        let inn = c + Vec2::new((rad - 1.5) * a.cos(), (rad - 1.5) * a.sin());
        let out = c + Vec2::new((rad + 2.0) * a.cos(), (rad + 2.0) * a.sin());
        p.add(Shape::line_segment([inn, out], Stroke::new(ICON_STROKE, color)));
    }
}

fn draw_filetype(p: &Painter, r: Rect, color: Color32) {
    let s = r.width().min(r.height());
    p.rect_filled(r, 4.0, Color32::WHITE);
    p.add(Shape::line_segment([r.min + Vec2::new(s * 0.7, 0.0), r.min + Vec2::new(s * 0.7, s * 0.7)], Stroke::new(ICON_STROKE, Color32::from_gray(120))));
    p.add(Shape::line_segment([r.min + Vec2::new(s * 0.7, s * 0.7), r.min + Vec2::new(s, 0.0)], Stroke::new(ICON_STROKE, Color32::from_gray(120))));
    for i in 0..4 {
        let y = r.min.y + 8.0 + i as f32 * 6.0;
        p.add(Shape::line_segment([r.min + Vec2::new(6.0, y), r.min + Vec2::new(s - 6.0, y)], Stroke::new(1.0, Color32::from_gray(120))));
    }
}

fn draw_predict(p: &Painter, r: Rect, color: Color32) {
    let c = r.center();
    let rad = r.width().min(r.height()) * 0.35;
    p.circle_filled(c, rad, Color32::from_rgb(155, 89, 182));
    for i in 0..5 {
        let a = std::f32::consts::PI * 0.4 + std::f32::consts::PI * 2.0 * i as f32 / 5.0;
        let inn = c + Vec2::new(rad * 0.4 * a.cos(), rad * 0.4 * a.sin());
        let out = c + Vec2::new(rad * 0.6 * a.cos(), rad * 0.6 * a.sin());
        p.add(Shape::line_segment([inn, out], Stroke::new(ICON_STROKE + 0.5, Color32::from_rgb(243, 156, 18))));
    }
}

fn draw_pattern(p: &Painter, r: Rect, color: Color32) {
    let c = r.center();
    let rad = r.width().min(r.height()) * 0.35;
    p.add(Shape::circle_stroke(c, rad, Stroke::new(ICON_STROKE, color)));
    p.add(Shape::line_segment([c + Vec2::new(rad * 0.3, rad * 0.3), r.max - Vec2::new(4.0, 4.0)], Stroke::new(ICON_STROKE, color)));
}

fn draw_tool(p: &Painter, r: Rect, color: Color32) {
    let c = r.center();
    let s = r.width().min(r.height());
    p.rect_filled(Rect::from_center_size(c, Vec2::new(s * 0.15, s * 0.6)), 3.0, Color32::from_rgb(180, 180, 180));
    p.add(Shape::convex_polygon(vec![c + Vec2::new(0.0, -s * 0.3), c + Vec2::new(-s * 0.12, -s * 0.12), c + Vec2::new(s * 0.12, -s * 0.12)], Color32::from_rgb(180, 180, 180), Stroke::NONE));
}

fn draw_quick(p: &Painter, r: Rect, color: Color32) {
    let s = r.width().min(r.height());
    let pts = vec![r.min + Vec2::new(s * 0.2, 0.0), r.min + Vec2::new(s * 0.5, s * 0.3), r.min + Vec2::new(s * 0.2, s * 0.3), r.min + Vec2::new(s * 0.4, s), r.max - Vec2::new(s * 0.3, 0.0), r.max - Vec2::new(s * 0.5, s * 0.7), r.max - Vec2::new(s * 0.2, s * 0.7)];
    p.add(Shape::convex_polygon(pts, Color32::from_rgb(255, 150, 0), Stroke::NONE));
}

fn draw_model(p: &Painter, r: Rect, color: Color32) {
    let c = r.center();
    let rad = r.width().min(r.height()) * 0.4;
    p.circle_filled(c, rad, Color32::from_rgb(180, 100, 180));
    p.add(Shape::line_segment([c + Vec2::new(0.0, -rad), c + Vec2::new(0.0, -rad * 1.5)], Stroke::new(ICON_STROKE, color)));
    p.circle_filled(c + Vec2::new(0.0, -rad * 1.7), rad * 0.3, color);
    p.circle_filled(c + Vec2::new(-rad * 0.25, -rad * 0.1), rad * 0.15, Color32::WHITE);
    p.circle_filled(c + Vec2::new(rad * 0.25, -rad * 0.1), rad * 0.15, Color32::WHITE);
    p.circle_filled(c + Vec2::new(-rad * 0.25, -rad * 0.1), rad * 0.07, Color32::from_rgb(52, 152, 219));
    p.circle_filled(c + Vec2::new(rad * 0.25, -rad * 0.1), rad * 0.07, Color32::from_rgb(52, 152, 219));
}

fn draw_index(p: &Painter, r: Rect, color: Color32) {
    let s = r.width().min(r.height());
    p.rect_filled(r, 4.0, Color32::WHITE);
    p.add(Shape::line_segment([r.min + Vec2::new(s * 0.7, 0.0), r.min + Vec2::new(s * 0.7, s * 0.7)], Stroke::new(ICON_STROKE, Color32::from_gray(120))));
    p.add(Shape::line_segment([r.min + Vec2::new(s * 0.7, s * 0.7), r.min + Vec2::new(s, 0.0)], Stroke::new(ICON_STROKE, Color32::from_gray(120))));
    for i in 0..4 {
        let y = r.min.y + 8.0 + i as f32 * 6.0;
        p.add(Shape::line_segment([r.min + Vec2::new(6.0, y), r.min + Vec2::new(s - 6.0, y)], Stroke::new(1.0, Color32::from_gray(120))));
    }
}

fn draw_security(p: &Painter, r: Rect, color: Color32) {
    let s = r.width().min(r.height());
    let c = r.center();
    let p1 = c + Vec2::new(0.0, -s * 0.35); let p2 = r.max - Vec2::new(s * 0.15, s * 0.15); let p3 = r.max - Vec2::new(s * 0.15, s * 0.4); let p4 = r.min + Vec2::new(s * 0.15, s * 0.4); let p5 = r.min + Vec2::new(s * 0.15, s * 0.15);
    p.add(Shape::convex_polygon(vec![p1, p2, p3], color, Stroke::NONE));
    p.add(Shape::convex_polygon(vec![p1, p3, p4], color, Stroke::NONE));
    p.add(Shape::convex_polygon(vec![p1, p4, p5], color, Stroke::NONE));
    p.add(Shape::line_segment([c + Vec2::new(-s * 0.1, c.y), c + Vec2::new(0.0, c.y + s * 0.15)], Stroke::new(ICON_STROKE + 1.0, Color32::WHITE)));
    p.add(Shape::line_segment([c + Vec2::new(0.0, c.y + s * 0.15), c + Vec2::new(s * 0.15, c.y - s * 0.05)], Stroke::new(ICON_STROKE + 1.0, Color32::WHITE)));
}

fn draw_cleanup(p: &Painter, r: Rect, color: Color32) {
    let s = r.width().min(r.height());
    let c = r.center();
    p.rect_filled(Rect::from_center_size(c + Vec2::new(0.0, s * 0.15), Vec2::new(s * 0.15, s * 0.5)), 4.0, Color32::from_rgb(139, 69, 19));
    for i in -4..=4 {
        let x = i as f32 * s * 0.08;
        p.add(Shape::line_segment([c + Vec2::new(x, s * 0.4), c + Vec2::new(x, s)], Stroke::new(2.0, Color32::from_rgb(139, 69, 19))));
    }
}

fn draw_performance(p: &Painter, r: Rect, color: Color32) {
    let s = r.width().min(r.height());
    p.add(Shape::line_segment([r.min + Vec2::new(s * 0.2, 0.0), r.min + Vec2::new(s * 0.2, s)], Stroke::new(3.0, Color32::from_gray(80))));
    p.rect_filled(Rect::from_center_size(r.min + Vec2::new(s * 0.4, s * 0.2), Vec2::new(s * 0.35, s * 0.18)), 3.0, Color32::from_rgb(231, 76, 60));
    p.rect_filled(Rect::from_center_size(r.min + Vec2::new(s * 0.6, s * 0.35), Vec2::new(s * 0.35, s * 0.18)), 3.0, Color32::from_rgb(52, 152, 219));
}

fn draw_check(p: &Painter, r: Rect, color: Color32) {
    let s = r.width().min(r.height());
    let c = r.center();
    p.add(Shape::line_segment([c + Vec2::new(-s * 0.25, 0.0), c + Vec2::new(0.0, s * 0.15)], Stroke::new(ICON_STROKE + 1.0, Color32::from_rgb(46, 204, 113))));
    p.add(Shape::line_segment([c + Vec2::new(0.0, s * 0.15), c + Vec2::new(s * 0.25, -s * 0.15)], Stroke::new(ICON_STROKE + 1.0, Color32::from_rgb(46, 204, 113))));
}

fn draw_warning(p: &Painter, r: Rect, color: Color32) {
    let s = r.width().min(r.height());
    let c = r.center();
    let p1 = c + Vec2::new(0.0, -s * 0.35); let p2 = r.min + Vec2::new(s * 0.5, s * 0.2); let p3 = r.max - Vec2::new(s * 0.5, s * 0.2);
    p.add(Shape::convex_polygon(vec![p1, p2, p3], Color32::from_rgb(243, 156, 18), Stroke::NONE));
    p.add(Shape::line_segment([c + Vec2::new(0.0, s * 0.1), c + Vec2::new(0.0, s * 0.25)], Stroke::new(ICON_STROKE + 1.0, Color32::WHITE)));
    p.circle_filled(c + Vec2::new(0.0, s * 0.32), 2.5, Color32::WHITE);
}

fn draw_default(p: &Painter, r: Rect, color: Color32) {
    let c = r.center();
    let rad = r.width().min(r.height()) * 0.4;
    p.circle_filled(c, rad, Color32::from_gray(100));
}