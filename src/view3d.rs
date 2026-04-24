use crate::model::Model;

pub struct View3d {
    // Projections et matrices (placeholders)
    pub angle_x: f32,
    pub angle_y: f32,
    pub scale: f32,
}

impl View3d {
    pub fn new() -> Self {
        Self {
            angle_x: 0.0,
            angle_y: 0.0,
            scale: 1.0,
        }
    }

    pub fn init_shaders(&mut self) {
        // TODO: Implémentation future
    }

    pub fn init_textures(&mut self) {
        // TODO: Implémentation future
    }

    pub fn init_perspective(&mut self) {
        // TODO: Implémentation future
    }

    pub fn init_model_view(&mut self) {
        // TODO: Implémentation future
    }

    pub fn init_buffers(&mut self) {
        // TODO: Implémentation future
    }

    pub fn update_buffers(&mut self) {
        // TODO: Implémentation future
    }

    pub fn render(&mut self, _model: &Model) {
        // TODO: Implémentation future (ne rien afficher pour le moment)
    }

    pub fn load_texture(&mut self, _url: &str) {
        // TODO: Implémentation future
    }
}
