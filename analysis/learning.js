class LearningEngine {

    constructor() {

        this.history = [];

    }

    analyze(decision) {

        if (!decision) return;

        this.history.push({
            time: Date.now(),
            signal: decision.signal,
            confidence: decision.confidence
        });

        if (this.history.length > 1000) {
            this.history.shift();
        }

        return {
            module: "learning",
            stored: this.history.length,
            success: true
        };
    }

    getHistory() {
        return this.history;
    }

    reset() {
        this.history = [];
    }

}

window.learningEngine = new LearningEngine();
