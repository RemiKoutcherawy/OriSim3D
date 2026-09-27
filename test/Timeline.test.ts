import { Model, State } from "../js/Model.js";
import { Command } from "../js/Command.js";
import { Timeline } from "../js/Timeline.js";
import { assertEquals } from "@std/assert";
function setup() {
  const model = new Model().init(200, 200);
  const cmd = new Command(model);
  const input = Object.assign(new EventTarget(), { value: "0", min: "0", max: "0", disabled: false });
  const label = { textContent: "", title: "" };
  const timeline = new Timeline(cmd, input, label);
  for (const line of ["d 200 200", "by2d p0 p2", "t 100 r s4 180 p1"]) {
    cmd.command(line);
    while (cmd.anim()) cmd.tStart = performance.now() - cmd.duration - 1;
  }
  timeline.update();
  const scrub = (k: number) => {
    input.value = String(k);
    input.dispatchEvent(new Event("input"));
  };
  return { model, cmd, input, label, timeline, scrub };
}
Deno.test("Timeline", async (t) => {
  await t.step("update() mirrors the history cursor", () => {
    const { input, label } = setup();
    assertEquals([input.min, input.max, input.value, input.disabled], ["1", "3", "3", false]);
    assertEquals([label.textContent, label.title], ["3/3", "t 100 r s4 180 p1"]);
  });
  await t.step("update() disables the slider while a line is still animating", () => {
    const { cmd, input, timeline } = setup();
    cmd.command("t 1000 tz 90");
    cmd.anim();
    timeline.update();
    assertEquals(input.disabled, true);
  });
  await t.step("scrubbing moves the history cursor without dropping later steps", () => {
    const { model, cmd, label, scrub } = setup();
    assertEquals([Math.round(model.points[1].x), Math.round(model.points[1].y)], [-200, 200]);
    scrub(2);
    assertEquals([cmd.cursor, cmd.instructions.length, model.state], [2, 3, State.run]);
    assertEquals(model.faces.length, 2);
    assertEquals([Math.round(model.points[1].x), Math.round(model.points[1].y)], [200, -200]);
    assertEquals(label.textContent, "2/3");
    scrub(3);
    assertEquals([Math.round(model.points[1].x), Math.round(model.points[1].y)], [-200, 200]);
  });
  await t.step("undo and redo move the slider", () => {
    const { cmd, input, timeline, scrub } = setup();
    scrub(2);
    cmd.command("undo");
    timeline.update();
    assertEquals([input.value, input.max], ["1", "3"]);
    cmd.command("redo");
    cmd.command("redo");
    timeline.update();
    assertEquals(input.value, "3");
  });
});
