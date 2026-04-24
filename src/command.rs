use crate::model::{Model, State};
use crate::interpolator::{Interpolator, InterpolatorFn};
use crate::vec3::Vec3;

pub struct Command {
    // Le modèle est normalement passé par référence ou possédé. 
    // En JS il est stocké dans la classe.
    pub token_todo: Vec<String>,
    pub i_token: usize,
    pub instructions: Vec<String>,
    // Time interpolated
    pub tpi: f32,
    pub tni: f32,
    // Goal for fit
    pub scale: f32,
    pub delta_x: f32,
    pub delta_y: f32,
    pub interpolator: InterpolatorFn,
    pub duration: f64,
    pub t_start: f64,
    
    idx_before: usize,
}

impl Command {
    pub fn new() -> Self {
        Command {
            token_todo: Vec::new(),
            i_token: 0,
            instructions: Vec::new(),
            tpi: 0.0,
            tni: 1.0,
            scale: 1.0,
            delta_x: 0.0,
            delta_y: 0.0,
            interpolator: Interpolator::LINEAR,
            duration: 0.0,
            t_start: 0.0,
            idx_before: 0,
        }
    }

    pub fn command(&mut self, cde: &str, model: &mut Model) {
        // En Rust, performance.now() n'est pas standard, 
        // on supposera que l'appelant gère le temps ou on utilisera instant.
        
        if cde.starts_with('d') || cde.starts_with("define") {
            self.token_todo.clear();
            self.i_token = 0;
            self.instructions.clear();
            // model.done = []; // Si Model a un historique
        } else if cde == "u" || cde == "undo" {
            model.state = State::Undo;
            return;
        }

        let tokens = self.tokenize(cde);
        self.token_todo.extend(tokens);
    }

    pub fn tokenize(&self, input: &str) -> Vec<String> {
        let mut text = input.to_string();
        // Remove comments
        while let Some(start) = text.find("//") {
            if let Some(end) = text[start..].find('\n') {
                text.replace_range(start..start + end, " ");
            } else {
                text.truncate(start);
            }
        }
        
        let text = text.replace(')', " eoc ")
                      .replace('(', " ")
                      .replace(';', " eoc ")
                      .replace('\n', " eoc ");

        text.split_whitespace()
            .map(|s| s.to_string())
            .filter(|s| !s.is_empty())
            .collect()
    }

    pub fn anim(&mut self, model: &mut Model, now_ms: f64) -> bool {
        if model.state == State::Pause {
            return false;
        }

        if model.state == State::Run {
            if self.i_token >= self.token_todo.len() {
                return false;
            }

            self.idx_before = self.i_token;
            let token = &self.token_todo[self.i_token];
            if token == "t" || token == "time" {
                self.i_token += 1;
                if self.i_token < self.token_todo.len() {
                    self.duration = self.token_todo[self.i_token].parse::<f64>().unwrap_or(0.0);
                    self.i_token += 1;
                }
                self.t_start = now_ms;
                self.tpi = 0.0;
                
                // Logic for inserting eoc if needed
                self.ensure_eoc_after_time();

                model.state = State::Anim;
                return true;
            }

            self.execute(self.i_token, model);
            self.done_instructions(self.idx_before, self.i_token);
            return true;
        }

        if model.state == State::Undo {
            // model.pop_undo();
            // Simplified for now as model.rs doesn't show pop_undo clearly
            model.state = State::Run; 
            return true;
        }

        if model.state == State::Anim {
            let mut tn = ((now_ms - self.t_start) / self.duration) as f32;
            if tn > 1.0 { tn = 1.0; }
            self.tni = (self.interpolator)(tn);

            let i_begin_anim = self.i_token;
            while self.i_token < self.token_todo.len() && self.token_todo[self.i_token] != "eoc" {
                self.execute(self.i_token, model);
            }

            self.tpi = self.tni;

            if tn >= 1.0 {
                self.tni = 1.0;
                self.tpi = 0.0;
                self.done_instructions(self.idx_before, self.i_token);
                model.state = State::Run;
                return true;
            }

            self.i_token = i_begin_anim;
            return true;
        }

        false
    }

    fn ensure_eoc_after_time(&mut self) {
        let mut next_t = None;
        let mut next_eoc = None;
        for i in self.i_token..self.token_todo.len() {
            if (self.token_todo[i] == "t" || self.token_todo[i] == "time") && next_t.is_none() {
                next_t = Some(i);
            }
            if self.token_todo[i] == "eoc" && next_eoc.is_none() {
                next_eoc = Some(i);
            }
        }

        match (next_t, next_eoc) {
            (Some(nt), Some(ne)) => {
                if ne > nt {
                    self.token_todo.insert(nt, "eoc".to_string());
                }
            }
            (Some(nt), None) => {
                self.token_todo.insert(nt, "eoc".to_string());
            }
            (None, None) => {
                self.token_todo.push("eoc".to_string());
            }
            _ => {}
        }
    }

    fn done_instructions(&mut self, idx_before: usize, idx_after: usize) {
        if idx_after > idx_before && idx_after <= self.token_todo.len() {
            let done_commands = self.token_todo[idx_before..idx_after].join(" ");
            if !done_commands.is_empty() && done_commands != "eoc" {
                if done_commands != "undo" {
                    self.instructions.push(done_commands);
                } else if !self.instructions.is_empty() {
                    self.instructions.pop();
                }
            }
        }
    }

    pub fn execute(&mut self, mut idx: usize, model: &mut Model) {
        let token_list = &self.token_todo;
        if idx >= token_list.len() { return; }

        let cmd = &token_list[idx];

        if cmd == "d" || cmd == "define" {
            idx += 1;
            let width = if idx < token_list.len() { token_list[idx].parse::<f32>().unwrap_or(200.0) } else { 200.0 };
            if idx < token_list.len() && token_list[idx].parse::<f32>().is_ok() { idx += 1; }
            let height = if idx < token_list.len() { token_list[idx].parse::<f32>().unwrap_or(200.0) } else { 200.0 };
            if idx < token_list.len() && token_list[idx].parse::<f32>().is_ok() { idx += 1; }
            model.init(width, height);
        }
        else if cmd == "by3d" {
            idx += 1;
            let p1_idx = token_list[idx].parse::<usize>().unwrap_or(0); idx += 1;
            let p2_idx = token_list[idx].parse::<usize>().unwrap_or(0); idx += 1;
            if p1_idx < model.points.len() && p2_idx < model.points.len() {
                model.add_segment(p1_idx, p2_idx);
            }
        }
        else if cmd == "by2d" {
            idx += 1;
            let p1_idx = token_list[idx].parse::<usize>().unwrap_or(0); idx += 1;
            let p2_idx = token_list[idx].parse::<usize>().unwrap_or(0); idx += 1;
            if p1_idx < model.points.len() && p2_idx < model.points.len() {
                model.add_segment(p1_idx, p2_idx);
            }
        }
        else if cmd == "c3d" || cmd == "across3d" || cmd == "cross3d" {
            idx += 1;
            let p1_idx = token_list[idx].parse::<usize>().unwrap_or(0); idx += 1;
            let p2_idx = token_list[idx].parse::<usize>().unwrap_or(0); idx += 1;
            if p1_idx < model.points.len() && p2_idx < model.points.len() {
                model.add_segment(p1_idx, p2_idx);
            }
        }
        else if cmd == "c2d" || cmd == "across2d" {
            idx += 1;
            let p1_idx = token_list[idx].parse::<usize>().unwrap_or(0); idx += 1;
            let p2_idx = token_list[idx].parse::<usize>().unwrap_or(0); idx += 1;
            if p1_idx < model.points.len() && p2_idx < model.points.len() {
                model.add_segment(p1_idx, p2_idx);
            }
        }
        else if cmd == "p2d" || cmd == "perpendicular2d" {
            idx += 1;
            idx += 2;
        }
        else if cmd == "p3d" || cmd == "perpendicular3d" {
            idx += 1;
            idx += 2;
        }
        else if cmd == "bisector2d" {
            idx += 1;
            idx += 2;
        }
        else if cmd == "bisector3d" {
            idx += 1;
            idx += 2;
        }
        else if cmd == "bisector2dPoints" {
            idx += 1;
            idx += 3;
        }
        else if cmd == "bisector3dPoints" {
            idx += 1;
            idx += 3;
        }
        else if cmd == "splitSegment2d" {
            idx += 1;
            idx += 3;
        }
        else if cmd == "r" || cmd == "rotate" {
            idx += 1;
            let s_idx = token_list[idx].parse::<usize>().unwrap_or(0);
            idx += 1;
            let angle = token_list[idx].parse::<f32>().unwrap_or(0.0) * (self.tni - self.tpi);
            idx += 1;
            let _list = self.list_indices(token_list, &mut idx);
            if s_idx < model.segments.len() {
                let s = model.segments[s_idx];
                let axis = Vec3::sub(Vec3::new(s.p2.x, s.p2.y, s.p2.z), Vec3::new(s.p1.x, s.p1.y, s.p1.z));
                let axis = Vec3::normalize(axis);
                
                // Rotation relative à p1 du segment
                let origin = Vec3::new(s.p1.x, s.p1.y, s.p1.z);
                model.translate(&Vec3::new(-origin.x, -origin.y, -origin.z));
                model.rotate(&axis, angle * std::f32::consts::PI / 180.0);
                model.translate(&origin);
            }
        }
        else if cmd == "mop" || cmd == "moveOnPoint" {
            idx += 1;
            let p0_idx = token_list[idx].parse::<usize>().unwrap_or(0);
            idx += 1;
            let list = self.list_indices(token_list, &mut idx);
            if p0_idx < model.points.len() {
                let p0 = model.points[p0_idx];
                for &p_idx in &list {
                    if p_idx < model.points.len() {
                        model.points[p_idx].x = p0.x;
                        model.points[p_idx].y = p0.y;
                        model.points[p_idx].z = p0.z;
                    }
                }
            }
        }
        else if cmd == "mos" || cmd == "moveOnSegment" {
            idx += 1;
            idx += 2;
        }
        else if cmd == "m" || cmd == "move" {
            idx += 1;
            let dx = token_list[idx].parse::<f32>().unwrap_or(0.0) * (self.tni - self.tpi); idx += 1;
            let dy = token_list[idx].parse::<f32>().unwrap_or(0.0) * (self.tni - self.tpi); idx += 1;
            let dz = token_list[idx].parse::<f32>().unwrap_or(0.0) * (self.tni - self.tpi); idx += 1;
            let list = self.list_indices(token_list, &mut idx);
            model.move_points(dx, dy, dz, &list);
        }
        else if cmd == "flat" {
            idx += 1;
            let list = self.list_indices(token_list, &mut idx);
            for &p_idx in &list {
                if p_idx < model.points.len() {
                    model.points[p_idx].z = 0.0;
                }
            }
        }
        else if cmd == "a" || cmd == "adjust" {
            idx += 1;
            let _list = self.list_indices(token_list, &mut idx);
            // model.adjust_list(...)
        }
        else if cmd == "check" {
            idx += 1;
        }
        else if cmd == "o" || cmd == "offset" {
            idx += 1;
            let dz = token_list[idx].parse::<i32>().unwrap_or(0); idx += 1;
            let list = self.list_indices(token_list, &mut idx);
            model.offset(dz, &list);
        }
        else if cmd == "tx" {
            idx += 1;
            // view3d.angleX = ...
            idx += 1;
        }
        else if cmd == "ty" {
            idx += 1;
            idx += 1;
        }
        else if cmd == "tz" {
            idx += 1;
            idx += 1;
        }
        else if cmd == "z" || cmd == "zoom" {
            idx += 1;
            idx += 1;
            if idx < token_list.len() && token_list[idx].parse::<f32>().is_ok() { idx += 1; }
            if idx < token_list.len() && token_list[idx].parse::<f32>().is_ok() { idx += 1; }
        }
        else if cmd == "fit" {
            idx += 1;
        }
        else if cmd == "il" { self.interpolator = Interpolator::LINEAR; idx += 1; }
        else if cmd == "ib" { self.interpolator = Interpolator::BOUNCE; idx += 1; }
        else if cmd == "io" { self.interpolator = Interpolator::OVERSHOOT; idx += 1; }
        else if cmd == "ia" { self.interpolator = Interpolator::ANTICIPATE; idx += 1; }
        else if cmd == "iao" { self.interpolator = Interpolator::ANTICIPATE_OVERSHOOT; idx += 1; }
        else if cmd == "iad" { self.interpolator = Interpolator::ACCELERATE_DECELERATE; idx += 1; }
        else if cmd == "iso" { self.interpolator = Interpolator::SPRING_OVERSHOOT; idx += 1; }
        else if cmd == "isb" { self.interpolator = Interpolator::SPRING_BOUNCE; idx += 1; }
        else if cmd == "igb" { self.interpolator = Interpolator::GRAVITY_BOUNCE; idx += 1; }
        else if cmd == "selectPoints" || cmd == "sp" {
            idx += 1;
            let list = self.list_indices(token_list, &mut idx);
            for (i, p) in model.points.iter_mut().enumerate() {
                p.select = if list.contains(&i) { 1 } else { 0 };
            }
        }
        else if cmd == "selectSegments" || cmd == "ss" {
            idx += 1;
            let list = self.list_indices(token_list, &mut idx);
            for (i, s) in model.segments.iter_mut().enumerate() {
                s.select = if list.contains(&i) { 1 } else { 0 };
            }
        }
        else if cmd == "labels" { idx += 1; model.labels = !model.labels; }
        else if cmd == "textures" { idx += 1; model.textures = !model.textures; }
        else if cmd == "overlay" { idx += 1; model.overlay = !model.overlay; }
        else if cmd == "lines" { idx += 1; model.lines = !model.lines; }
        else if cmd == "eoc" { idx += 1; }
        else {
            // Syntax error logic
            idx += 1;
            while idx < token_list.len() && token_list[idx] != "eoc" {
                idx += 1;
            }
            if idx < token_list.len() { idx += 1; }
        }

        self.i_token = idx;
    }

    fn list_indices(&self, token_list: &[String], idx: &mut usize) -> Vec<usize> {
        let mut list = Vec::new();
        while *idx < token_list.len() {
            if let Ok(val) = token_list[*idx].parse::<usize>() {
                list.push(val);
                *idx += 1;
            } else {
                break;
            }
        }
        list
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Model;

    #[test]
    fn test_tokenize() {
        let cde = Command::new();
        let text = "
    d 200 200
    c 0 1 c 0 3 c 0 2; c 1 3 // List of commands
    // Comment
    t 500 ty 180;
    t 1000 r 35 179 8 17 3) // Pas mal
";
        let tokens = cde.tokenize(text);
        // Analysons text par ligne:
        // L1: \n -> eoc
        // L2: d 200 200 \n -> d 200 200 eoc
        // L3: c 0 1 c 0 3 c 0 2; c 1 3 // List of commands \n -> c 0 1 c 0 3 c 0 2 eoc c 1 3 eoc
        // L4: // Comment \n -> eoc
        // L5: t 500 ty 180; \n -> t 500 ty 180 eoc eoc
        // L6: t 1000 r 35 179 8 17 3) // Pas mal \n -> t 1000 r 35 179 8 17 3 eoc eoc
        // Tokens:
        // L1: eoc (1)
        // L2: d, 200, 200, eoc (4)
        // L3: c, 0, 1, c, 0, 3, c, 0, 2, eoc, c, 1, 3, eoc (14)
        // L4: eoc (1)
        // L5: t, 500, ty, 180, eoc, eoc (6)
        // L6: t, 1000, r, 35, 179, 8, 17, 3, eoc, eoc (10)
        // Total: 1+4+14+1+6+10 = 36.
        assert_eq!(tokens.len(), 36);
    }

    #[test]
    fn test_list_indices() {
        let cde = Command::new();
        let tokens = vec!["0".to_string(), "1".to_string(), "abc".to_string()];
        let mut idx = 0;
        let list = cde.list_indices(&tokens, &mut idx);
        assert_eq!(list.len(), 2);
        assert_eq!(list[0], 0);
        assert_eq!(list[1], 1);
        assert_eq!(idx, 2);
    }

    #[test]
    fn test_command_d_define() {
        let mut model = Model::new();
        let mut cde = Command::new();
        cde.command("d 200 200", &mut model);
        cde.anim(&mut model, 0.0);
        assert_eq!(cde.i_token, 3);
        assert_eq!(model.points.len(), 4);
    }

    #[test]
    fn test_command_rotate() {
        let mut model = Model::new();
        let mut cde = Command::new();
        cde.command("d 200 200", &mut model);
        cde.anim(&mut model, 0.0);
        
        // Rotate with axe bottom edge [0,1] by 90 points 2
        // Point 2 is at (200, 200, 0)
        // Axe [0,1] is from (-200, -200, 0) to (200, -200, 0) -> axis X
        // Rotation of 90° around X for (200, 200, 0) relative to (-200, -200, 0)
        // Relative: (400, 400, 0) -> Rotate around X: (400, 0, 400)
        // Absolute: (200, -200, 400)
        cde.command("rotate 0 90 2", &mut model);
        cde.anim(&mut model, 0.0);
        
        let pt = model.points[2];
        assert_eq!(pt.x.round(), 200.0);
        assert_eq!(pt.y.round(), -200.0);
        assert_eq!(pt.z.round(), 400.0);
    }

    #[test]
    fn test_command_move_on_point() {
        let mut model = Model::new();
        let mut cde = Command::new();
        cde.command("d 200 200", &mut model);
        cde.anim(&mut model, 0.0);
        
        cde.command("moveOnPoint 0 2", &mut model);
        cde.anim(&mut model, 0.0);
        
        let pt0 = model.points[0];
        let pt2 = model.points[2];
        assert_eq!(pt2.x, pt0.x);
        assert_eq!(pt2.y, pt0.y);
    }

    #[test]
    fn test_command_move() {
        let mut model = Model::new();
        let mut cde = Command::new();
        cde.command("d 200 200", &mut model);
        cde.anim(&mut model, 0.0);
        
        cde.command("move 10 20 30 2", &mut model);
        cde.anim(&mut model, 0.0);
        
        let pt = model.points[2];
        assert_eq!(pt.x.round(), 210.0);
        assert_eq!(pt.y.round(), 220.0);
        assert_eq!(pt.z.round(), 30.0);
    }

    #[test]
    fn test_interpolator_commands() {
        let mut model = Model::new();
        let mut cde = Command::new();
        cde.command("il", &mut model); cde.anim(&mut model, 0.0);
        assert_eq!(cde.interpolator as usize, Interpolator::LINEAR as usize);
        cde.command("ib", &mut model); cde.anim(&mut model, 0.0);
        assert_eq!(cde.interpolator as usize, Interpolator::BOUNCE as usize);
        cde.command("io", &mut model); cde.anim(&mut model, 0.0);
        assert_eq!(cde.interpolator as usize, Interpolator::OVERSHOOT as usize);
    }

    #[test]
    fn test_multiline_command() {
        let mut model = Model::new();
        let mut cde = Command::new();
        cde.command("d 200 200\nmove 10 0 0 2", &mut model);
        while cde.anim(&mut model, 0.0) {}
        assert_eq!(model.points[2].x, 210.0);
    }

    #[test]
    fn test_crease_commands() {
        let mut model = Model::new();
        let mut cde = Command::new();
        cde.command("d 200 200", &mut model);
        cde.anim(&mut model, 0.0);
        
        cde.command("by3d 0 2", &mut model);
        cde.anim(&mut model, 0.0);
        assert_eq!(model.segments.len(), 5);
        
        cde.command("by2d 1 3", &mut model);
        cde.anim(&mut model, 0.0);
        assert_eq!(model.segments.len(), 6); // Pas de split automatique implémenté dans add_segment
    }

    #[test]
    fn test_offset_command() {
        let mut model = Model::new();
        let mut cde = Command::new();
        cde.command("d 200 200", &mut model);
        cde.anim(&mut model, 0.0);
        cde.command("offset 42 0", &mut model);
        cde.anim(&mut model, 0.0);
        assert_eq!(model.faces[0].offset, 0.0042);
    }
}
