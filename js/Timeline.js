import {Model, State} from './Model.js';
import {replaySteps} from './Command.js';
export class Timeline {
    constructor(command, input, label, onChange = () => {}) {
        this.command = command;
        this.input = input;
        this.label = label;
        this.onChange = onChange;
        this.steps = null;
        this.live = null;
        command.onCommand = () => this.commit();
        input.addEventListener('input', () => this.show(Number(input.value)));
        input.addEventListener('change', () => {
            if (Number(input.value) >= this.steps?.length) this.commit();
        });
        this.update();
    }
    get busy() {
        return this.command.model.state === State.anim || this.command.iToken < this.command.tokenTodo.length;
    }
    update() {
        if (this.live) return;
        const n = this.command.instructions.length;
        this.input.disabled = this.busy || n === 0;
        this.input.min = String(Math.min(1, n));
        this.input.max = String(n);
        this.input.value = String(n);
        this.setLabel(n, n);
    }
    setLabel(k, n) {
        this.label.textContent = `${k}/${n}`;
        this.label.title = this.command.instructions[k - 1] ?? '';
    }
    start() {
        if (this.live || this.busy) return;
        const model = this.command.model;
        this.steps = replaySteps(this.command.instructions);
        this.live = {json: model.serialize(), state: model.state};
    }
    show(k) {
        this.start();
        if (!this.live) return;
        const n = this.steps.length;
        const model = this.command.model;
        const source = k >= n ? Model.deserialize(this.live.json) : Model.deserialize(this.steps[k - 1].serialize());
        const {labels, textures, lines, snap} = model;
        Object.assign(model, source, {labels, textures, lines, snap, state: State.pause});
        this.setLabel(k, n);
        this.onChange();
    }
    commit() {
        if (!this.live) return;
        const k = Number(this.input.value), n = this.steps.length;
        if (k < n) {
            this.command.instructions.length = k;
            this.command.done = this.steps.slice(0, k).map((step) => step.serialize());
        }
        this.command.model.state = k < n ? State.run : this.live.state;
        this.live = null;
        this.steps = null;
        this.update();
    }
}
