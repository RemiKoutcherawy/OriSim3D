// NOSONAR - SonarQube's S2187 test-detection doesn't recognize Deno's Deno.test()/t.step()
// API as test cases; this file contains 8 t.step() sub-tests (19 assertions) for CommandArea.js.
import { CommandArea } from "../js/CommandArea.js";
import { assertEquals } from "@std/assert";

// Minimal textarea stand-in: only the members CommandArea actually touches.
function createMockTextarea() {
  return {
    value: "",
    selectionStart: 0,
    selectionEnd: 0,
    scrollTop: 0,
    scrollHeight: 0,
    listeners: {} as Record<string, (e: unknown) => void>,
    focused: false,
    addEventListener(type: string, listener: (e: unknown) => void) {
      this.listeners[type] = listener;
    },
    focus() {
      this.focused = true;
    },
  };
}

function createMockCommand() {
  const calls: string[] = [];
  return {
    calls,
    commandArea: undefined as unknown,
    command(line: string) {
      calls.push(line);
      return this;
    },
  };
}

Deno.test("CommandArea", async (t) => {
  await t.step("constructor wires command.commandArea and listens for keydown", () => {
    const textarea = createMockTextarea();
    const command = createMockCommand();

    const commandArea = new CommandArea(command, textarea);

    assertEquals(command.commandArea, commandArea);
    assertEquals(typeof textarea.listeners["keydown"], "function");
  });

  await t.step("addLine appends the line when it differs from the last one", () => {
    const textarea = createMockTextarea();
    const command = createMockCommand();
    const commandArea = new CommandArea(command, textarea);

    textarea.value = "d 200 200\n";
    commandArea.addLine("sp p0");

    assertEquals(textarea.value, "d 200 200\nsp p0\n");
    assertEquals(textarea.selectionStart, textarea.value.length);
    assertEquals(textarea.selectionEnd, textarea.value.length);
    assertEquals(textarea.focused, true);
  });

  await t.step("addLine only appends a newline when the last line already matches (echo)", () => {
    const textarea = createMockTextarea();
    const command = createMockCommand();
    const commandArea = new CommandArea(command, textarea);

    // Simulates the user having typed "sp p0" themselves (no trailing \n yet)
    textarea.value = "d 200 200\nsp p0";
    commandArea.addLine("sp p0");

    assertEquals(textarea.value, "d 200 200\nsp p0\n");
  });

  await t.step("keydown Enter runs the current line and moves the caret to the end", () => {
    const textarea = createMockTextarea();
    const command = createMockCommand();
    const commandArea = new CommandArea(command, textarea);

    textarea.value = "d 200 200\nsp p0";
    textarea.selectionStart = textarea.value.length; // caret at end, inside "sp p0"
    let prevented = false;
    commandArea.keydown({
      key: "Enter",
      target: textarea,
      preventDefault: () => { prevented = true; },
    });

    assertEquals(prevented, true);
    assertEquals(command.calls, ["sp p0"]);
    assertEquals(textarea.selectionStart, textarea.value.length);
    assertEquals(textarea.scrollTop, textarea.scrollHeight);
  });

  await t.step("keydown Enter on a middle line only runs that line", () => {
    const textarea = createMockTextarea();
    const command = createMockCommand();
    const commandArea = new CommandArea(command, textarea);

    textarea.value = "d 200 200\nsp p0\nss s0\n";
    textarea.selectionStart = "d 200 200\nsp ".length; // caret inside the "sp p0" line

    commandArea.keydown({
      key: "Enter",
      target: textarea,
      preventDefault: () => {},
    });

    assertEquals(command.calls, ["sp p0"]);
  });

  await t.step("keydown Ctrl/Cmd+Z sends undo", () => {
    const textarea = createMockTextarea();
    const command = createMockCommand();
    const commandArea = new CommandArea(command, textarea);

    let prevented = false;
    let stopped = false;
    commandArea.keydown({
      key: "z",
      ctrlKey: true,
      target: textarea,
      preventDefault: () => { prevented = true; },
      stopPropagation: () => { stopped = true; },
    });

    assertEquals(prevented, true);
    assertEquals(stopped, true);
    assertEquals(command.calls, ["undo"]);
  });

  await t.step("keydown ignores other keys", () => {
    const textarea = createMockTextarea();
    const command = createMockCommand();
    const commandArea = new CommandArea(command, textarea);

    commandArea.keydown({
      key: "a",
      target: textarea,
      preventDefault: () => {},
    });

    assertEquals(command.calls, []);
  });

  await t.step("the listener registered on the textarea is correctly bound to the instance", () => {
    const textarea = createMockTextarea();
    const command = createMockCommand();
    const commandArea = new CommandArea(command, textarea);

    textarea.value = "sp p0";
    textarea.selectionStart = textarea.value.length;
    // Invoke exactly as the DOM would: as a bare function call, not commandArea.keydown(...)
    const listener = textarea.listeners["keydown"];
    listener({ key: "Enter", target: textarea, preventDefault: () => {} });

    assertEquals(command.calls, ["sp p0"]);
    assertEquals(commandArea.textarea, textarea);
  });
});
