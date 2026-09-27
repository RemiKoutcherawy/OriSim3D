import { Model, State } from "../js/Model.js";
import { Command } from "../js/Command.js";
import { Timeline } from "../js/Timeline.js";
import { assertEquals } from "@std/assert";
function run(cmd: Command, line: string) {
  cmd.command(line);
  while (cmd.iToken < cmd.tokenTodo.length || cmd.model.state === State.anim || cmd.model.state === State.undo) {
    if (cmd.model.state === State.anim) cmd.tStart = performance.now() - cmd.duration - 1;
    if (!cmd.anim()) break;
  }
}
function setup() {
  const model = new Model().init(200, 200);
  const cmd = new Command(model);
  const input = Object.assign(new EventTarget(), { value: "0", min: "0", max: "0", disabled: false });
  const label = { textContent: "", title: "" };
  let changes = 0;
  const timeline = new Timeline(cmd, input, label, () => changes++);
  run(cmd, "d 200 200");
  run(cmd, "by2d p0 p2");
  run(cmd, "t 100 r s4 180 p1");
  timeline.update();
  const scrub = (k: number, event = "input") => {
    input.value = String(k);
    input.dispatchEvent(new Event(event));
  };
  return { model, cmd, input, label, timeline, scrub, changes: () => changes };
}
Deno.test("Timeline", async (t) => {
  await t.step("update() tracks the instruction count", () => {
    const { input, label } = setup();
    assertEquals([input.min, input.max, input.value, input.disabled], ["1", "3", "3", false]);
    assertEquals(label.textContent, "3/3");
    assertEquals(label.title, "t 100 r s4 180 p1");
  });
  await t.step("update() disables the slider while a line is still animating", () => {
    const { cmd, input, timeline } = setup();
    cmd.command("t 1000 tz 90");
    cmd.anim();
    timeline.update();
    assertEquals(input.disabled, true);
  });
  await t.step("scrubbing shows an earlier step and pauses the model", () => {
    const { model, label, scrub, changes } = setup();
    assertEquals([Math.round(model.points[1].x), Math.round(model.points[1].y)], [-200, 200]);
    scrub(2);
    assertEquals(model.state, State.pause);
    assertEquals(model.faces.length, 2);
    assertEquals([Math.round(model.points[1].x), Math.round(model.points[1].y)], [200, -200]);
    assertEquals(label.textContent, "2/3");
    assertEquals(changes(), 1);
  });
  await t.step("releasing on the last step restores the live model and history", () => {
    const { model, cmd, scrub } = setup();
    const live = model.serialize();
    scrub(1);
    scrub(3);
    scrub(3, "change");
    assertEquals(model.serialize(), live);
    assertEquals(model.state, State.run);
    assertEquals(cmd.instructions.length, 3);
  });
  await t.step("a command issued on an earlier step drops the later steps", () => {
    const { model, cmd, input, timeline, scrub } = setup();
    scrub(2);
    scrub(2, "change");
    run(cmd, "c2d p0 p1");
    timeline.update();
    assertEquals(cmd.instructions, ["d 200 200", "by2d p0 p2", "c2d p0 p1"]);
    assertEquals(model.state, State.run);
    assertEquals(input.value, "3");
    assertEquals(model.points.length, 7);
  });
  await t.step("undo on an earlier step goes back one more step", () => {
    const { model, cmd, scrub } = setup();
    scrub(2);
    run(cmd, "undo");
    assertEquals(cmd.instructions, ["d 200 200"]);
    assertEquals(model.faces.length, 1);
  });
  await t.step("file commands are replayed without side effects", () => {
    const { model, cmd, scrub } = setup();
    cmd.instructions.push("fold out.fold", "svg");
    scrub(4);
    assertEquals(model.faces.length, 2);
    assertEquals(Math.round(model.points[1].x), -200);
  });
});
