use crate::model::Model;
use crate::helper::Helper;
use egui;
use egui::{Color32, Pos2, Stroke, Shape, Painter};

pub struct View2d {
    pub scale: f32,
    pub x_offset: f32,
    pub y_offset: f32,
}

impl View2d {
    pub fn new() -> Self {
        Self {
            scale: 1.0,
            x_offset: 0.0,
            y_offset: 0.0,
        }
    }

    pub fn fit(&mut self, model: &Model, view_rect: egui::Rect) {
        let bounds = model.get_2d_bounds();
        let model_width = bounds.x_max - bounds.x_min;
        let model_height = bounds.y_max - bounds.y_min;

        let view_width = view_rect.width();
        let view_height = view_rect.height();

        if model_width > 0.0 && model_height > 0.0 {
            self.scale = (view_width / model_width).min(view_height / model_height) / 1.2;
        } else {
            self.scale = 1.0;
        }

        self.x_offset = view_rect.center().x;
        self.y_offset = view_rect.center().y;
    }

    pub fn draw_model(&mut self, model: &Model, helper: &Helper, painter: &Painter) {
        let view_rect = painter.clip_rect();
        
        // Clear background
        painter.rect_filled(view_rect, 0.0, Color32::from_rgb(204, 228, 255));

        self.draw_faces(model, painter);
        self.draw_segments(model, painter);
        self.draw_points(model, painter);
        self.draw_helper(helper, painter);
    }

    fn draw_helper(&self, helper: &Helper, painter: &Painter) {
        if let (Some(fx), Some(fy), Some(cx), Some(cy)) = (helper.first_x, helper.first_y, helper.current_x, helper.current_y) {
            if helper.first_point.is_some() || helper.first_segment.is_some() || helper.first_face.is_some() {
                let p1 = self.to_screen(fx, fy);
                let p2 = self.to_screen(cx, cy);
                painter.line_segment([p1, p2], Stroke::new(4.0, Color32::GREEN));

                if let Some(ref label) = helper.label {
                    let circle_pos = Pos2::new(p2.x, p2.y - 16.0);
                    painter.circle_filled(circle_pos, 18.0, Color32::from_rgb(135, 206, 235)); // skyblue
                    painter.circle_stroke(circle_pos, 18.0, Stroke::new(1.0, Color32::BLACK));
                    painter.text(
                        circle_pos,
                        egui::Align2::CENTER_CENTER,
                        label,
                        egui::FontId::proportional(20.0),
                        Color32::BLACK,
                    );
                }
            }
        }
    }

    pub fn to_screen(&self, xf: f32, yf: f32) -> Pos2 {
        Pos2::new(
            self.x_offset + xf * self.scale,
            self.y_offset - yf * self.scale, // y is inverted in JS
        )
    }

    pub fn from_screen(&self, pos: Pos2) -> (f32, f32) {
        let xf = (pos.x - self.x_offset) / self.scale;
        let yf = (self.y_offset - pos.y) / self.scale;
        (xf, yf)
    }

    fn draw_faces(&self, model: &Model, painter: &Painter) {
        for (i, face) in model.faces.iter().enumerate() {
            let pts_indices = model.get_face_vertices_ccw(i);
            if pts_indices.is_empty() { continue; }

            let mut points = Vec::new();
            let mut cx = 0.0;
            let mut cy = 0.0;
            for &idx in &pts_indices {
                let p = &model.points[idx];
                let pos = self.to_screen(p.xf, p.yf);
                points.push(pos);
                cx += pos.x;
                cy += pos.y;
            }
            cx /= points.len() as f32;
            cy /= points.len() as f32;

            let color = if face.hover {
                Color32::from_rgb(224, 255, 255) // lightcyan
            } else if face.select != 0 {
                Color32::from_rgb(255, 192, 203) // pink
            } else {
                Color32::from_rgb(173, 216, 230) // lightblue
            };

            painter.add(Shape::convex_polygon(points, color, Stroke::new(1.0, Color32::BLACK)));

            // Label
            painter.circle_filled(Pos2::new(cx, cy), 12.0, Color32::from_rgb(224, 255, 255));
            painter.text(
                Pos2::new(cx, cy),
                egui::Align2::CENTER_CENTER,
                i.to_string(),
                egui::FontId::proportional(18.0),
                Color32::BLACK,
            );
        }
    }

    fn draw_segments(&self, model: &Model, painter: &Painter) {
        for (i, s) in model.segments.iter().enumerate() {
            let p1 = self.to_screen(s.p1.xf, s.p1.yf);
            let p2 = self.to_screen(s.p2.xf, s.p2.yf);
            let mid = Pos2::new((p1.x + p2.x) / 2.0, (p1.y + p2.y) / 2.0);

            let stroke_width = if s.hover { 6.0 } else { 3.0 };
            let color = match s.select {
                1 => Color32::RED,
                2 => Color32::from_rgb(255, 165, 0), // orange
                _ => if s.hover { Color32::BLUE } else { Color32::from_rgb(135, 206, 235) }, // skyblue
            };

            painter.line_segment([p1, p2], Stroke::new(stroke_width, color));

            // Arrow
            let angle = (p2.y - p1.y).atan2(p2.x - p1.x);
            let arrow_length = 20.0;
            let arrow_angle = std::f32::consts::PI / 7.0;
            let p_arrow1 = Pos2::new(
                p2.x - arrow_length * (angle + arrow_angle).cos(),
                p2.y - arrow_length * (angle + arrow_angle).sin(),
            );
            let p_arrow2 = Pos2::new(
                p2.x - arrow_length * (angle - arrow_angle).cos(),
                p2.y - arrow_length * (angle - arrow_angle).sin(),
            );
            painter.add(Shape::convex_polygon(vec![p2, p_arrow1, p_arrow2], color, Stroke::NONE));

            // Circle & Label
            let circle_color = match s.select {
                1 => Color32::RED,
                2 => Color32::from_rgb(255, 165, 0),
                _ => if s.hover { Color32::BLUE } else { Color32::from_rgb(144, 238, 144) }, // lightgreen
            };
            painter.circle_filled(mid, if s.hover { 12.0 } else { 8.0 }, circle_color);
            painter.text(
                mid,
                egui::Align2::CENTER_CENTER,
                i.to_string(),
                egui::FontId::proportional(18.0),
                if s.hover { Color32::WHITE } else { Color32::BLACK },
            );
        }
    }

    fn draw_points(&self, model: &Model, painter: &Painter) {
        for (i, p) in model.points.iter().enumerate() {
            let pos = self.to_screen(p.xf, p.yf);
            let color = match p.select {
                1 => Color32::RED,
                2 => Color32::from_rgb(255, 165, 0),
                _ => if p.hover { Color32::BLUE } else { Color32::from_rgb(135, 206, 235) },
            };

            painter.circle_filled(pos, if p.hover { 12.0 } else { 8.0 }, color);
            painter.text(
                pos,
                egui::Align2::CENTER_CENTER,
                i.to_string(),
                egui::FontId::proportional(18.0),
                if p.hover { Color32::WHITE } else { Color32::BLACK },
            );
        }
    }
}
