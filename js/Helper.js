export class Helper {
    constructor(model, command) {
        this.model = model;
        this.command = command;
        this.out();
    }

    // Méthode générique pour rechercher dans un tableau avec une condition
    searchCanvas(elements, condition) {
        let list = [];
        for (let i = 0; i < elements.length; i++) {
            if (condition(elements[i])) {
                list.push(elements[i]);
            }
        }
        return list;
    }

    // Méthode générique pour obtenir la position de l'événement
    eventToModelPosition(event) {
        if (!(event instanceof Event)) return event; // Utilisé pour les tests
        const rect = event.target.getBoundingClientRect();
        const xCanvas = (event.clientX - rect.left);
        const yCanvas = (event.clientY - rect.top);
        return {
            xCanvas: xCanvas,
            yCanvas: yCanvas,
        };
    }

    // Dessine si un point, un segment ou une face est sélectionné
    draw(context) {
        if (this.firstPoint || this.firstSegment || this.firstFace) {
            context.lineWidth = 4;
            context.lineCap = 'round';
            context.strokeStyle = 'green';
            context.beginPath();
            context.moveTo(this.firstX, this.firstY);
            context.lineTo(this.currentX, this.currentY);
            context.stroke();
        }
    }

    // Réinitialise les propriétés
    out() {
        this.firstX = undefined;
        this.firstY = undefined;
        this.currentX = undefined;
        this.currentY = undefined;
        this.firstPoint = undefined;
        this.firstSegment = undefined;
        this.firstFace = undefined;
    }
}
