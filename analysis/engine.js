class AnalysisEngine {

    constructor() {

        /*
         * =========================================================
         * CORE MEMORY
         * =========================================================
         */

        this.memory = {
            maxTicks: 10000,
            ticks: [],
            digits: [],
            frequencies: Array(10).fill(0)
        };


        /*
         * =========================================================
         * CURRENT ANALYSIS STATE
         * =========================================================
         */

        this.analysis = {

            market: "R_100",

            status: "Connecting...",

            lastDigit: "-",

            currentTick: 0,

            pattern: "Waiting...",

            probability: 0,

            confidence: 0,

            signal: "WAIT",

            recommendation: "Analyzing...",

            decision: "WAIT",

            prediction: null,

            modulesAgreeing: 0,

            activeModules: 0,

            tickCount: 0,

            lastUpdate: 0,

            markov: {
                score: 0,
                confidence: 0,
                prediction: null,
                order: 0,
                recommendation: "WAIT"
            },

            cycle: {
                score: 0,
                confidence: 0,
                cycleLength: 0,
                recommendation: "WAIT"
            },

            patterns: {
                score: 0,
                confidence: 0,
                pattern: "WAIT",
                digit: null,
                recommendation: "WAIT"
            },

            probabilityAnalysis: {
                score: 0,
                confidence: 0,
                prediction: null,
                recommendation: "WAIT"
            },

            statistics: {
                score: 0,
                confidence: 0,
                mean: 0,
                standardDeviation: 0,
                recommendation: "WAIT"
            },

            transition: {
                score: 0,
                confidence: 0,
                predictedDigit: null,
                recommendation: "WAIT"
            },

            confidenceAnalysis: {
                score: 0,
                confidence: 0,
                agreement: 0,
                activeModules: 0
            }

        };


        /*
         * =========================================================
         * MODULE REGISTRY
         * =========================================================
         */

        this.modules = {};


        /*
         * =========================================================
         * ENGINE STATE
         * =========================================================
         */

        this.started = false;

        this.paused = false;

        this.listeners = [];

        this.lastTickTime = 0;

        this.analysisWindow = 300;

        this.minimumAnalysisTicks = 30;

        this.defaultMarket = "R_100";
    }


    /*
     * =========================================================
     * INITIALIZE
     * =========================================================
     */

    initialize() {

        if (this.started) {
            return this.getState();
        }

        this.started = true;

        this.analysis.market =
            this.defaultMarket;

        this.analysis.status =
            "Initializing...";

        this.connectModules();

        this.analysis.status =
            "Ready";

        this.emit();

        return this.getState();
    }


    /*
     * =========================================================
     * CONNECT ALL MODULES
     * =========================================================
     */

    connectModules() {

        /*
         * PATTERNS
         */

        if (window.patternsEngine) {

            this.modules.patterns =
                window.patternsEngine;

        } else if (window.PatternEngine) {

            this.modules.patterns =
                new window.PatternEngine();

        }


        /*
         * PROBABILITY
         */

        if (window.probabilityEngine) {

            this.modules.probability =
                window.probabilityEngine;

        } else if (window.ProbabilityEngine) {

            this.modules.probability =
                new window.ProbabilityEngine();

        }


        /*
         * STATISTICS
         */

        if (window.statisticsEngine) {

            this.modules.statistics =
                window.statisticsEngine;

        } else if (window.StatisticsEngine) {

            this.modules.statistics =
                new window.StatisticsEngine();

        }


        /*
         * TRANSITION
         */

        if (window.transitionEngine) {

            this.modules.transition =
                window.transitionEngine;

        } else if (window.TransitionEngine) {

            this.modules.transition =
                new window.TransitionEngine();

        }


        /*
         * MARKOV
         */

        if (window.markovEngine) {

            this.modules.markov =
                window.markovEngine;

        } else if (window.MarkovEngine) {

            this.modules.markov =
                new window.MarkovEngine();

        }


        /*
         * CYCLE
         */

        if (window.cycleEngine) {

            this.modules.cycle =
                window.cycleEngine;

        } else if (window.CycleEngine) {

            this.modules.cycle =
                new window.CycleEngine();

        }


        /*
         * CONFIDENCE
         */

        if (window.confidenceEngine) {

            this.modules.confidence =
                window.confidenceEngine;

        } else if (window.ConfidenceEngine) {

            this.modules.confidence =
                new window.ConfidenceEngine();

        }


        /*
         * LEARNING
         */

        if (window.learningEngine) {

            this.modules.learning =
                window.learningEngine;

        } else if (window.LearningEngine) {

            this.modules.learning =
                new window.LearningEngine();

        }


        /*
         * VALIDATOR
         */

        if (window.validatorEngine) {

            this.modules.validator =
                window.validatorEngine;

        }


        /*
         * DECISION
         */

        if (window.decisionEngine) {

            this.modules.decision =
                window.decisionEngine;

        }


        /*
         * ENTRY LOGIC
         */

        if (window.entryLogic) {

            this.modules.entryLogic =
                window.entryLogic;

        }


        /*
         * TRADE MANAGER
         */

        if (window.tradeManager) {

            this.modules.tradeManager =
                window.tradeManager;

        }


        /*
         * PAPER TRADING
         */

        if (window.paperTrading) {

            this.modules.paperTrading =
                window.paperTrading;

        }


        /*
         * RISK MANAGER
         */

        if (window.riskManager) {

            this.modules.riskManager =
                window.riskManager;

        }


        /*
         * PERFORMANCE
         */

        if (window.performanceEngine) {

            this.modules.performance =
                window.performanceEngine;

        }


        this.analysis.activeModules =
            this.countAnalysisModules();

    }


    /*
     * =========================================================
     * COUNT ANALYSIS MODULES
     * =========================================================
     */

    countAnalysisModules() {

        const names = [
            "patterns",
            "probability",
            "statistics",
            "transition",
            "markov",
            "cycle"
        ];

        return names.filter(
            name => !!this.modules[name]
        ).length;

    }


    /*
     * =========================================================
     * RECEIVE TICK
     * =========================================================
     */

    receiveTick(data) {

        if (!this.started) {

            this.initialize();

        }

        if (this.paused) {

            return this.getState();

        }

        if (!data) {

            return null;

        }


        const quote =
            this.extractQuote(data);


        if (!Number.isFinite(quote)) {

            return null;

        }


        const digit =
            this.extractDigit(
                quote,
                data
            );


        if (
            !Number.isInteger(digit) ||
            digit < 0 ||
            digit > 9
        ) {

            return null;

        }


        const tick = {

            quote,

            digit,

            time:
                Date.now(),

            epoch:
                Number(
                    data.epoch ||
                    data.time ||
                    0
                ),

            symbol:
                data.symbol ||
                data.market ||
                this.analysis.market,

            pipSize:
                data.pip_size ??
                data.pipSize ??
                null

        };


        this.storeTick(tick);

        this.runAnalysis(tick);

        return this.getState();

    }


    /*
     * =========================================================
     * EXTRACT QUOTE
     * =========================================================
     */

    extractQuote(data) {

        const candidates = [
            data.quote,
            data.price,
            data.value,
            data.tick?.quote
        ];


        for (
            const candidate of candidates
        ) {

            const value =
                Number(candidate);

            if (
                Number.isFinite(value)
            ) {

                return value;

            }

        }


        return NaN;

    }


    /*
     * =========================================================
     * EXTRACT LAST DIGIT
     * =========================================================
     */

    extractDigit(
        quote,
        data = {}
    ) {

        /*
         * If Deriv provides pip_size, use it to determine
         * the correct number of decimal places.
         */

        const pipSize =
            Number(
                data.pip_size ??
                data.pipSize ??
                NaN
            );


        if (
            Number.isFinite(pipSize) &&
            pipSize > 0 &&
            pipSize < 1
        ) {

            const decimals =
                Math.max(
                    0,
                    Math.round(
                        -Math.log10(pipSize)
                    )
                );


            if (
                decimals > 0
            ) {

                const formatted =
                    quote.toFixed(
                        decimals
                    );


                const digitsOnly =
                    formatted.replace(
                        /\D/g,
                        ""
                    );


                if (
                    digitsOnly.length > 0
                ) {

                    return Number(
                        digitsOnly[
                            digitsOnly.length - 1
                        ]
                    );

                }

            }

        }


        /*
         * Fallback:
         * Preserve the decimal representation and take the
         * final numeric character.
         */

        const text =
            String(quote);


        const numericCharacters =
            text.replace(
                /\D/g,
                ""
            );


        if (
            numericCharacters.length === 0
        ) {

            return null;

        }


        return Number(
            numericCharacters[
                numericCharacters.length - 1
            ]
        );

    }


    /*
     * =========================================================
     * STORE TICK
     * =========================================================
     */

    storeTick(tick) {

        this.memory.ticks.push(tick);

        this.memory.digits.push(
            tick.digit
        );

        this.memory.frequencies[
            tick.digit
        ]++;


        while (
            this.memory.ticks.length >
            this.memory.maxTicks
        ) {

            const removed =
                this.memory.ticks.shift();


            const removedDigit =
                this.memory.digits.shift();


            if (
                Number.isInteger(
                    removedDigit
                )
            ) {

                this.memory.frequencies[
                    removedDigit
                ]--;

            }

        }


        this.analysis.tickCount =
            this.memory.ticks.length;

    }


    /*
     * =========================================================
     * RUN ANALYSIS
     * =========================================================
     */

    runAnalysis(tick) {

        this.analysis.status =
            "Analyzing";


        this.analysis.lastDigit =
            tick.digit;


        this.analysis.currentTick =
            tick.quote;


        this.analysis.lastUpdate =
            Date.now();


        const digits =
            this.memory.digits.slice(
                -this.analysisWindow
            );


        /*
         * -----------------------------------------------------
         * Minimum data protection
         * -----------------------------------------------------
         */

        if (
            digits.length <
            this.minimumAnalysisTicks
        ) {

            this.analysis.recommendation =
                "Collecting data";

            this.analysis.signal =
                "WAIT";

            this.analysis.decision =
                "WAIT";

            this.updateDashboard();

            this.emit();

            return;

        }


        /*
         * -----------------------------------------------------
         * PATTERNS
         * -----------------------------------------------------
         */

        const patternResult =
            this.safeAnalyze(
                this.modules.patterns,
                digits,
                "patterns"
            );


        /*
         * -----------------------------------------------------
         * PROBABILITY
         * -----------------------------------------------------
         */

        const probabilityResult =
            this.safeAnalyze(
                this.modules.probability,
                digits,
                "probability"
            );


        /*
         * -----------------------------------------------------
         * STATISTICS
         * -----------------------------------------------------
         */

        const statisticsResult =
            this.safeAnalyze(
                this.modules.statistics,
                digits,
                "statistics"
            );


        /*
         * -----------------------------------------------------
         * TRANSITION
         * -----------------------------------------------------
         */

        const transitionResult =
            this.safeAnalyze(
                this.modules.transition,
                digits,
                "transition"
            );


        /*
         * -----------------------------------------------------
         * MARKOV
         * -----------------------------------------------------
         */

        const markovResult =
            this.safeAnalyze(
                this.modules.markov,
                digits,
                "markov"
            );


        /*
         * -----------------------------------------------------
         * CYCLE
         * -----------------------------------------------------
         */

        const cycleResult =
            this.safeAnalyze(
                this.modules.cycle,
                digits,
                "cycle"
            );


        /*
         * -----------------------------------------------------
         * CONFIDENCE
         * -----------------------------------------------------
         */

        const confidenceResult =
            this.runConfidence(
                patternResult,
                probabilityResult,
                statisticsResult,
                transitionResult,
                markovResult,
                cycleResult
            );


        /*
         * -----------------------------------------------------
         * MASTER VALIDATION
         * -----------------------------------------------------
         */

        const validationResult =
            this.runValidator(
                confidenceResult,
                {
                    patternResult,
                    probabilityResult,
                    statisticsResult,
                    transitionResult,
                    markovResult,
                    cycleResult
                }
            );


        /*
         * -----------------------------------------------------
         * MASTER DECISION
         * -----------------------------------------------------
         */

        const decisionResult =
            this.runDecision(
                confidenceResult,
                validationResult,
                {
                    patternResult,
                    probabilityResult,
                    statisticsResult,
                    transitionResult,
                    markovResult,
                    cycleResult
                }
            );


        /*
         * -----------------------------------------------------
         * LEARNING
         * -----------------------------------------------------
         */

        if (
            this.modules.learning &&
            typeof
            this.modules.learning.analyze ===
            "function"
        ) {

            try {

                this.modules.learning.analyze(
                    decisionResult
                );

            } catch (error) {

                console.warn(
                    "Learning module error:",
                    error
                );

            }

        }


        /*
         * -----------------------------------------------------
         * UPDATE ENGINE STATE
         * -----------------------------------------------------
         */

        this.updateAnalysisState(
            tick,
            patternResult,
            probabilityResult,
            statisticsResult,
            transitionResult,
            markovResult,
            cycleResult,
            confidenceResult,
            validationResult,
            decisionResult
        );


        /*
         * -----------------------------------------------------
         * DASHBOARD
         * -----------------------------------------------------
         */

        this.updateDashboard();


        /*
         * Notify UI/listeners.
         */

        this.emit();


        return this.analysis;

    }


    /*
     * =========================================================
     * SAFE MODULE ANALYZER
     * =========================================================
     */

    safeAnalyze(
        module,
        digits,
        name
    ) {

        const fallback = {

            module: name,

            success: false,

            score: 0,

            confidence: 0,

            samples:
                digits.length,

            recommendation:
                "WAIT"

        };


        if (
            !module ||
            typeof module.analyze !==
            "function"
        ) {

            return fallback;

        }


        try {

            const result =
                module.analyze(
                    digits
                );


            if (
      
