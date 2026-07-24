class AnalysisEngine {

    constructor() {
        this.ticks = [];
    }

    addTick(tick) {

        this.ticks.push(tick);

        if (this.ticks.length > 1000) {
            this.ticks.shift();
        }

    }

    analyze() {

        return {
            status: "Analyzing",
            confidence: 0,
            prediction: "Waiting for enough data"
        };

    }

}

const engine = new AnalysisEngine();
