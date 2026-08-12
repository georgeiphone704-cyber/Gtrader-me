/*
 * ============================================================
 * GTRADER-ME MASTER ANALYSIS ENGINE
 * ============================================================
 *
 * Responsibilities:
 * - Receive Deriv ticks
 * - Maintain separate memory for every market
 * - Run all analysis modules
 * - Combine module results
 * - Run confidence / validation / decision
 * - Feed results to learning
 * - Expose market states to the dashboard
 *
 * Supported markets:
 * R_10
 * R_25
 * R_50
 * R_75
 * R_100
 * 1HZ10V
 * 1HZ25V
 * 1HZ50V
 * 1HZ75V
 * 1HZ100V
 *
 * This engine DOES NOT place trades.
 * ============================================================
 */

class AnalysisEngine {

    constructor() {

        /* ======================================================
         * MARKET CONFIGURATION
         * ====================================================== */

        this.markets = [
            "R_10",
            "R_25",
            "R_50",
            "R_75",
            "R_100",
            "1HZ10V",
            "1HZ25V",
            "1HZ50V",
            "1HZ75V",
            "1HZ100V"
        ];

        this.defaultMarket = "R_100";

        this.maxTicks = 10000;

        this.analysisWindow = 300;

        this.minimumAnalysisTicks = 30;


        /* ======================================================
         * MARKET MEMORIES
         * ====================================================== */

        this.marketMemories = {};

        for (const market of this.markets) {
            this.marketMemories[market] =
                this.createMarketMemory();
        }


        /* ======================================================
         * GLOBAL DASHBOARD STATE
         * ====================================================== */

        this.analysis = {

            market:
                this.defaultMarket,

            status:
                "Connecting...",

            lastDigit:
                "-",

            currentTick:
                0,

            pattern:
                "Waiting...",

            probability:
                0,

            confidence:
                0,

            signal:
                "WAIT",

            recommendation:
                "Analyzing...",

            decision:
                "WAIT",

            prediction:
                null,

            modulesAgreeing:
                0,

            activeModules:
                0,

            tickCount:
                0,

            lastUpdate:
                0,

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


        /* ======================================================
         * MODULE REGISTRY
         * ====================================================== */

        this.modules = {};


        /* ======================================================
         * ENGINE STATE
         * ====================================================== */

        this.started = false;

        this.paused = false;

        this.listeners = [];

        this.lastTickTime = 0;

    }


    /* ==========================================================
     * CREATE MARKET MEMORY
     * ========================================================== */

    createMarketMemory() {

        return {

            ticks: [],

            digits: [],

            frequencies:
                Array(10).fill(0),

            analysis: {

                lastDigit: null,

                currentTick: null,

                confidence: 0,

                probability: 0,

                signal: "WAIT",

                prediction: null,

                recommendation: "Waiting",

                decision: "WAIT",

                modulesAgreeing: 0,

                activeModules: 0,

                updated: 0,

                results: {}

            }

        };

    }


    /* ==========================================================
     * INITIALIZE
     * ========================================================== */

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


    /* ==========================================================
     * CONNECT MODULES
     * ========================================================== */

    connectModules() {

        if (window.patternsEngine) {

            this.modules.patterns =
                window.patternsEngine;

        } else if (window.PatternEngine) {

            this.modules.patterns =
                new window.PatternEngine();

        }


        if (window.probabilityEngine) {

            this.modules.probability =
                window.probabilityEngine;

        } else if (window.ProbabilityEngine) {

            this.modules.probability =
                new window.ProbabilityEngine();

        }


        if (window.statisticsEngine) {

            this.modules.statistics =
                window.statisticsEngine;

        } else if (window.StatisticsEngine) {

            this.modules.statistics =
                new window.StatisticsEngine();

        }


        if (window.transitionEngine) {

            this.modules.transition =
                window.transitionEngine;

        } else if (window.TransitionEngine) {

            this.modules.transition =
                new window.TransitionEngine();

        }


        if (window.markovEngine) {

            this.modules.markov =
                window.markovEngine;

        } else if (window.MarkovEngine) {

            this.modules.markov =
                new window.MarkovEngine();

        }


        if (window.cycleEngine) {

            this.modules.cycle =
                window.cycleEngine;

        } else if (window.CycleEngine) {

            this.modules.cycle =
                new window.CycleEngine();

        }


        if (window.confidenceEngine) {

            this.modules.confidence =
                window.confidenceEngine;

        } else if (window.ConfidenceEngine) {

            this.modules.confidence =
                new window.ConfidenceEngine();

        }


        if (window.learningEngine) {

            this.modules.learning =
                window.learningEngine;

        } else if (window.LearningEngine) {

            this.modules.learning =
                new window.LearningEngine();

        }


        if (window.validatorEngine) {

            this.modules.validator =
                window.validatorEngine;

        }


        if (window.decisionEngine) {

            this.modules.decision =
                window.decisionEngine;

        }


        if (window.entryLogic) {

            this.modules.entryLogic =
                window.entryLogic;

        }


        if (window.tradeManager) {

            this.modules.tradeManager =
                window.tradeManager;

        }


        if (window.paperTrading) {

            this.modules.paperTrading =
                window.paperTrading;

        }


        if (window.riskManager) {

            this.modules.riskManager =
                window.riskManager;

        }


        if (window.performanceEngine) {

            this.modules.performance =
                window.performanceEngine;

        }


        this.analysis.activeModules =
            this.countAnalysisModules();

    }


    /* ==========================================================
     * COUNT ANALYSIS MODULES
     * ========================================================== */

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
            name =>
                !!this.modules[name]
        ).length;

    }


    /* ==========================================================
     * RECEIVE TICK
     * ========================================================== */

    receiveTick(data) {

        if (!this.started) {
            this.initialize();
        }

        if (this.paused || !data) {
            return null;
        }


        const market =
            data.symbol ||
            data.market ||
            this.defaultMarket;


        /*
         * Automatically support a market that is added
         * later without breaking the engine.
         */

        if (!this.marketMemories[market]) {

            this.marketMemories[market] =
                this.createMarketMemory();

            this.markets.push(market);

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
                market,

            pipSize:
                data.pip_size ??
                data.pipSize ??
                null

        };


        this.storeTick(
            market,
            tick
        );


        const result =
            this.runMarketAnalysis(
                market,
                tick
            );


        /*
         * Keep the selected/default market mirrored
         * in the main dashboard state.
         */

        if (
            market ===
            this.analysis.market
        ) {

            this.updateGlobalAnalysis(
                market
            );

        }


        return result;

    }


    /* ==========================================================
     * EXTRACT QUOTE
     * ========================================================== */

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


    /* ==========================================================
     * EXTRACT LAST DIGIT
     * ========================================================== */

    extractDigit(
        quote,
        data = {}
    ) {

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
                        -Math.log10(
                            pipSize
                        )
                    )
                );


            if (decimals > 0) {

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


    /* ==========================================================
     * STORE TICK FOR ONE MARKET ONLY
     * ========================================================== */

    storeTick(
        market,
        tick
    ) {

        const memory =
            this.marketMemories[market];


        if (!memory) {
            return;
        }


        memory.ticks.push(
            tick
        );


        memory.digits.push(
            tick.digit
        );


        memory.frequencies[
            tick.digit
        ]++;


        while (
            memory.ticks.length >
            this.maxTicks
        ) {

            memory.ticks.shift();

            const removedDigit =
                memory.digits.shift();


            if (
                Number.isInteger(
                    removedDigit
                )
            ) {

                memory.frequencies[
                    removedDigit
                ]--;

            }

        }

    }


    /* ==========================================================
     * RUN ANALYSIS FOR ONE MARKET
     * ========================================================== */

    runMarketAnalysis(
        market,
        tick
    ) {

        const memory =
            this.marketMemories[market];


        const digits =
            memory.digits.slice(
                -this.analysisWindow
            );


        /*
         * Not enough data.
         */

        if (
            digits.length <
            this.minimumAnalysisTicks
        ) {

            memory.analysis = {

                ...memory.analysis,

                lastDigit:
                    tick.digit,

                currentTick:
                    tick.quote,

                confidence: 0,

                probability: 0,

                signal: "WAIT",

                prediction: null,

                recommendation:
                    "Collecting data",

                decision:
                    "WAIT",

                modulesAgreeing: 0,

                activeModules:
                    this.countAnalysisModules(),

                updated:
                    Date.now()

            };


            return this.getMarketState(
                market
            );

        }


        /* ======================================================
         * PATTERNS
         * ====================================================== */

        const patternResult =
            this.safeAnalyze(
                this.modules.patterns,
                digits,
                "patterns"
            );


        /* ======================================================
         * PROBABILITY
         * ====================================================== */

        const probabilityResult =
            this.safeAnalyze(
                this.modules.probability,
                digits,
                "probability"
            );


        /* ======================================================
         * STATISTICS
         * ====================================================== */

        const statisticsResult =
            this.safeAnalyze(
                this.modules.statistics,
                digits,
                "statistics"
            );


        /* ======================================================
         * TRANSITION
         * ====================================================== */

        const transitionResult =
            this.safeAnalyze(
                this.modules.transition,
                digits,
                "transition"
            );


        /* ======================================================
         * MARKOV
         * ====================================================== */

        const markovResult =
            this.safeAnalyze(
                this.modules.markov,
                digits,
                "markov"
            );


        /* ======================================================
         * CYCLE
         * ====================================================== */

        const cycleResult =
            this.safeAnalyze(
                this.modules.cycle,
                digits,
                "cycle"
            );


        /* ======================================================
         * CONFIDENCE
         * ====================================================== */

        const confidenceResult =
            this.runConfidence(
                patternResult,
                probabilityResult,
                statisticsResult,
                transitionResult,
                markovResult,
                cycleResult
            );


        /* ======================================================
         * VALIDATION
         * ====================================================== */

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


        /* ======================================================
         * DECISION
         * ====================================================== */

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


        /* ======================================================
         * LEARNING
         * ====================================================== */

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

           
