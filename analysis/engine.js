class AnalysisEngine {

    constructor() {

        this.memory = {

            maxTicks: 10000,

            ticks: [],

            digits: [],

            frequencies: Array(10).fill(0),

            patterns: [],

            signals: [],

            confidenceHistory: []

        };

    }

    addTick(tick) {

        this.memory.ticks.push(tick);

        this.memory.digits.push(tick.digit);

        this.memory.frequencies[tick.digit]++;

        if (this.memory.ticks.length > this.memory.maxTicks) {

            const removed = this.memory.ticks.shift();

            this.memory.digits.shift();

            this.memory.frequencies[removed.digit]--;

        }

        this.updateDashboard();

    }

    updateDashboard() {

        if (this.memory.ticks.length === 0) return;

        const latest = this.memory.ticks[this.memory.ticks.length - 1];

        document.getElementById("status").textContent = "Connected";
        document.getElementById("market").textContent = "R_100";
        document.getElementById("prediction").textContent =
            "Latest Digit: " + latest.digit;

        document.getElementById("confidence").textContent =
            `${this.memory.ticks.length}/${this.memory.maxTicks}`;

        document.getElementById("time").textContent =
            new Date().toLocaleTimeString();

    }

}

window.engine = new AnalysisEngine();
