class DecisionEngine {

    constructor() {

        this.signal = "WAIT";

    }

    evaluate(confidence) {

        if (confidence.score >= 90) {

            this.signal = "SIGNAL";

        } else if (confidence.score >= 75) {

            this.signal = "MONITOR";

        } else {

            this.signal = "WAIT";

        }

        return {

            signal: this.signal,

            confidence: confidence.score,

            status: confidence.status

        };

    }

}

window.decisionEngine = new DecisionEngine();
