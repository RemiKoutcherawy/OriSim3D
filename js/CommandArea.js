export class CommandArea {
    constructor(command, textarea) {
        this.textarea = textarea;
        this.textarea.addEventListener('keydown', this.keydown.bind(this));
        this.command = command;
        command.commandArea = this;
    }

    addLine(text) {
        // Insert at the end
        this.textarea.value += `${text}\n`;
        // Scroll to the end
        this.textarea.selectionEnd = this.textarea.selectionEnd = this.textarea.value.length;
        this.textarea.focus();
    }

    keydown = function (e) {
        const el = e.target; // HTMLTextAreaElement
        if (e.key === 'Enter') {
            e.preventDefault();
            el.scrollTop = el.scrollHeight;
            const caretPos = el.selectionStart;
            const value = el.value;
            const start = value.lastIndexOf('\n', caretPos - 1) + 1;
            const end = value.indexOf('\n', caretPos) === -1 ? value.length : value.indexOf('\n', caretPos);
            let line = value.substring(start, end);
            if (line.startsWith('t') && !line.endsWith(';')) line += ';';
            this.command.command(line);
        }
        // Control Z to undo
        if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            e.stopPropagation();
            this.command.command('undo');
        }
    }
}
