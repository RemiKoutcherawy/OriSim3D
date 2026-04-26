use egui;
use orisim3d::model::Model;
use orisim3d::command::Command;
use orisim3d::view2d::View2d;
use orisim3d::view3d::View3d;
use orisim3d::helper::Helper;

fn main() -> eframe::Result<()> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([800.0, 800.0])
            .with_title("OriSim3D - Cocotte"),
        ..Default::default()
    };
    eframe::run_native(
        "OriSim3D",
        options,
        Box::new(|_cc| {
            let mut app = OriSimApp::new();
            // Initial command to define the model like in cocotte.html
            app.command.command("define 200 200", &mut app.model);
            Ok(Box::new(app) as Box<dyn eframe::App>)
        }),
    )
}

struct OriSimApp {
    model: Model,
    command: Command,
    view2d: View2d,
    view3d: View3d,
    helper: Helper,
    initialized: bool,
}

impl OriSimApp {
    fn new() -> Self {
        let mut model = Model::new();
        model.init(200.0, 200.0);
        Self {
            model,
            command: Command::new(),
            view2d: View2d::new(),
            view3d: View3d::new(),
            helper: Helper::new(),
            initialized: false,
        }
    }
}

impl eframe::App for OriSimApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::CentralPanel::default().show(ctx, |ui| {
            let painter = ui.painter();
            let rect = painter.clip_rect();
            
            if !self.initialized {
                self.view2d.fit(&self.model, rect);
                self.initialized = true;
            }

            // Handle Input
            let response = ui.interact(rect, ui.id(), egui::Sense::click_and_drag());

            if let Some(pos) = response.hover_pos() {
                let (xf, yf) = self.view2d.from_screen(pos);
                let (points, segments, faces) = self.model.search2d(xf, yf);
                if response.drag_started() {
                    self.helper.down(&points, &segments, &faces, xf, yf);
                } else if response.dragged() {
                    self.helper.move_event(&mut self.model, &points, &segments, &faces, xf, yf);
                } else if response.drag_stopped() {
                    self.helper.up(&mut self.model, &mut self.command, xf, yf);
                } else if response.clicked() {
                    self.helper.down(&points, &segments, &faces, xf, yf);
                    self.helper.up(&mut self.model, &mut self.command, xf, yf);
                } else {
                    // Hover only
                    self.model.hover_2d_3d(&points, &segments, &faces);
                }
            }

            self.view2d.draw_model(&self.model, &self.helper, &painter);
        });

        // Animation loop
        let now_ms = ctx.input(|i| i.time) * 1000.0;
        if self.command.anim(&mut self.model, now_ms) {
            ctx.request_repaint();
        }
    }
}
