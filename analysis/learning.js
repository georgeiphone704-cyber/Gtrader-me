class LearningEngine {

    constructor() {

        this.history = [];

    }

    record(signal, confidence, digit) {

        this.history.push({

            time: Date.now(),

            signal,

            confidence,

            digit

        });

        if (this.history.length > 5000) {

            this.history.shift();

        }

    }

    getHistory() {

        return this.history;

    }

    getAccuracy() {

        if (this.history.length === 0) {

            return 0;

        }

        return this.history.length;

    }

}

window.learningEngine = new LearningEngine();
