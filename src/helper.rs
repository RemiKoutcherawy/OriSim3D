use std::time::SystemTime;
use crate::model::Model;
use crate::command::Command;

pub struct Helper {
    pub first_x: Option<f32>,
    pub first_y: Option<f32>,
    pub current_x: Option<f32>,
    pub current_y: Option<f32>,
    pub first_point: Option<usize>,
    pub first_segment: Option<usize>,
    pub first_face: Option<usize>,
    pub time: SystemTime,
    pub label: Option<String>,
}

impl Helper {
    pub fn new() -> Self {
        println!("helper");
        Self {
            first_x: None,
            first_y: None,
            current_x: None,
            current_y: None,
            first_point: None,
            first_segment: None,
            first_face: None,
            time: SystemTime::now(),
            label: None,
        }
    }

    pub fn out(&mut self) {
        self.first_x = None;
        self.first_y = None;
        self.current_x = None;
        self.current_y = None;
        self.first_point = None;
        self.first_segment = None;
        self.first_face = None;
        self.label = None;
    }

    pub fn down(&mut self, points: &[usize], segments: &[usize], faces: &[usize], x: f32, y: f32) {
        if !points.is_empty() {
            self.first_point = Some(points[0]);
        } else if !segments.is_empty() {
            self.first_segment = Some(segments[0]);
        } else if !faces.is_empty() {
            self.first_face = Some(faces[0]);
        } else {
            self.first_point = None;
            self.first_segment = None;
            self.first_face = None;
        }
        self.time = SystemTime::now();
        self.first_x = Some(x);
        self.current_x = Some(x);
        self.first_y = Some(y);
        self.current_y = Some(y);
    }

    pub fn move_event(&mut self, model: &mut Model, points: &[usize], segments: &[usize], faces: &[usize], x: f32, y: f32) {
        model.hover_2d_3d(points, segments, faces);
        if let Some(first_point_idx) = self.first_point {
            if first_point_idx < model.points.len() {
                model.points[first_point_idx].hover = true;
                
                // From Point with selected segment(s)
                let sel_segments: Vec<usize> = model.segments.iter().enumerate()
                    .filter(|(_, s)| s.select == 1)
                    .map(|(i, _)| i)
                    .collect();
                
                if !sel_segments.is_empty() {
                    let s_idx = sel_segments[0];
                    // Deselect other segments
                    for &idx in &sel_segments {
                        if idx != s_idx {
                            model.segments[idx].select = 0;
                        }
                    }
                    
                    let p_idx = first_point_idx;
                    model.points[p_idx].select = 1;
                    
                    let s = &model.segments[s_idx];
                    let p = &model.points[p_idx];
                    
                    // Signed distance from first point to segment
                    let dist_to_first = (p.xf - s.p1.xf) * (s.p2.yf - s.p1.yf) - (p.yf - s.p1.yf) * (s.p2.xf - s.p1.xf);
                    // Signed distance from current point to segment
                    let dist_to_current = (x - s.p1.xf) * (s.p2.yf - s.p1.yf) - (y - s.p1.yf) * (s.p2.xf - s.p1.xf);
                    
                    if dist_to_first != 0.0 {
                        let ratio = (dist_to_current / dist_to_first).abs();
                        let mut angle = (ratio - 1.0) * 180.0 * (-dist_to_first.signum());
                        angle = (angle / 10.0).round() * 10.0;
                        
                        let label_str = if (angle.abs() - 10.0).abs() < 10.0 {
                            "00".to_string()
                        } else {
                            format!("{:.0}", angle)
                        };
                        self.label = Some(label_str);
                    }
                }
            }
        } else if let Some(first_segment_idx) = self.first_segment {
            if first_segment_idx < model.segments.len() {
                model.segments[first_segment_idx].hover = true;
            }
        } else if let Some(first_face_idx) = self.first_face {
            if first_face_idx < model.faces.len() {
                if let Some(cur_x) = self.current_x {
                    if x - cur_x > 0.0 {
                        for f in &mut model.faces {
                            if f.select == 1 { f.offset += 1.0; }
                        }
                    } else if x - cur_x < 0.0 {
                        for f in &mut model.faces {
                            if f.select == 1 { f.offset -= 1.0; }
                        }
                    }
                }
            }
        }
        self.current_x = Some(x);
        self.current_y = Some(y);
    }

    pub fn up(&mut self, model: &mut Model, command: &mut Command, x: f32, y: f32) {
        let (points, segments, faces) = model.search2d(x, y);

        if let Some(p1_idx) = self.first_point {
            if !points.is_empty() {
                let p2_idx = points[0];
                if p1_idx == p2_idx {
                    // Click on same point: toggle select
                    model.points[p1_idx].select = (model.points[p1_idx].select + 1) % 3;
                    if model.points[p1_idx].select == 2 {
                        // model.adjust(model.points[p1_idx]); // Need to implement adjust
                    }
                } else {
                    // Two different points
                    if model.get_segment(p1_idx, p2_idx).is_some() {
                        command.command(&format!("across2d {} {}", p1_idx, p2_idx), model);
                    } else {
                        command.command(&format!("by2d {} {}", p1_idx, p2_idx), model);
                    }
                }
            } else if !segments.is_empty() && self.label.is_none() {
                // Perpendicular
                command.command(&format!("perpendicular2d {} {}", segments[0], p1_idx), model);
            } else if let Some(ref label) = self.label {
                // Rotate
                let sel_segments: Vec<usize> = model.segments.iter().enumerate()
                    .filter(|(_, s)| s.select == 1).map(|(i, _)| i).collect();
                if !sel_segments.is_empty() {
                    let s_idx = sel_segments[0];
                    let sel_points: Vec<String> = model.points.iter().enumerate()
                        .filter(|(_, p)| p.select == 1).map(|(i, _)| i.to_string()).collect();
                    let adj_points: Vec<String> = model.points.iter().enumerate()
                        .filter(|(_, p)| p.select == 2).map(|(i, _)| i.to_string()).collect();
                    
                    if adj_points.is_empty() {
                        command.command(&format!("t 1000 rotate {} {} {};", s_idx, label, sel_points.join(" ")), model);
                    } else {
                        command.command(&format!("t 1000 rotate {} {} {} a {};", s_idx, label, sel_points.join(" "), adj_points.join(" ")), model);
                    }
                }
            }
        }
        else if let Some(s1_idx) = self.first_segment {
            if !segments.is_empty() && segments[0] == s1_idx {
                model.segments[s1_idx].select = (model.segments[s1_idx].select + 1) % 3;
            } else if !points.is_empty() {
                command.command(&format!("perpendicular2d {} {}", s1_idx, points[0]), model);
            } else if !segments.is_empty() {
                command.command(&format!("bisector2d {} {}", s1_idx, segments[0]), model);
            }
        } else if let Some(f1_idx) = self.first_face {
            if !faces.is_empty() && faces[0] == f1_idx {
                model.click_2d_3d(&points, &segments, &faces);
            } else {
                for p in &mut model.points { p.select = 0; }
                for s in &mut model.segments { s.select = 0; }
                for f in &mut model.faces { f.select = 0; }
            }
        }
        self.out();
    }
}
