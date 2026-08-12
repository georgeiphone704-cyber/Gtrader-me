/*
 * ============================================================
 * GTRADER-ME MASTER ANALYSIS ENGINE
 * ============================================================
 *
 * FLOW:
 *
 * Deriv tick
 *    ↓
 * Market selection / market state
 *    ↓
 * Independent market memory
 *    ↓
 * Analysis modules
 *    ├── Patterns
 *    ├── Probability
 *    ├── Statistics
 *    ├── Transition
 *    ├── Markov
 *    └── Cycle
 *    ↓
 * Confidence
 *    ↓
 * Validation
 *    ↓
 * Decision
 *    ↓
 * Learning / dashboard
 *
 * IMPORTANT:
 * - Each market has its own tick/digit history.
 * - Analysis modules are reused; their code is NOT duplicated.
 * - This engine does NOT place live trades.
 * ============================================================
 */

class AnalysisEngine {

    constructor(options = {}) {

        /* ======================================================
         * MARKET CONFIGURATION
         * ====================================================== */

        this.markets = Array.isArray(options.markets)
            ? [...options.markets]
            : [
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

        this.defaultMarket =
            options.defaultMarket || "R_100";

        this.activeMarket =
            this.markets.includes(this.defaultMarket)
                ? this.defaultMarket
                : this.markets[0];


        /* ======================================================
         * DATA CONFIGURATION
         * ====================================================== */

        this.maxTicks =
            Number(options.maxTicks) > 0
                ? Number(options.maxTicks)
                : 10000;

        this.analysisWindow =
            Number(options.analysisWindow) > 0
                ? Number(options.analysisWindow)
                : 300;

        this.minimumAnalysisTicks =
            Number(options.minimumAnalysisTicks) > 0
                ? Number(options.minimumAnalysisTicks)
                : 30;


        /* ======================================================
         * MARKET MEMORY
         * ====================================================== */

        this.marketMemories = {};

        for (const market of this.markets) {
            this.marketMemories[market] =
                this.createMarketMemory();
        }


        /* ======================================================
         * MODULES
         * ====================================================== */

        this.modules = {};


        /* ======================================================
         * ENGINE STATE
         * ====================================================== */

        this.started = false;
        this.paused = false;

        this.listeners = [];

        this.lastError = null;


        /* ======================================================
         * GLOBAL DASHBOARD STATE
         * ====================================================== */

        this.analysis = {
            market: this.activeMarket,

            status: "Initializing",

            lastDigit: null,

            currentTick: null,

            tickCount: 0,

            confidence: 0,

            probability: 0,

            prediction: null,

            signal: "WAIT",

            decision: "WAIT",

            recommendation: "Waiting",

            modulesAgreeing: 0,

            activeModules: 0,

            lastUpdate: 0,

            patterns: {},
            probabilityAnalysis: {},
            statistics: {},
            transition: {},
            markov: {},
            cycle: {},
            confidenceAnalysis: {}
        };
    }


    /* ==========================================================
     * CREATE MARKET MEMORY
     * ========================================================== */

    createMarketMemory() {

        return {
            ticks: [],
            digits: [],
            frequencies: Array(10).fill(0),

            analysis: {
                lastDigit: null,
                currentTick: null,
                tickCount: 0,

                confidence: 0,
                probability: 0,

                prediction: null,

                signal: "WAIT",
                decision: "WAIT",
                recommendation: "Waiting",

                modulesAgreeing: 0,
                activeModules: 0,

                lastUpdate: 0,

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

        this.connectModules();

        this.started = true;

        this.analysis.status = "Ready";

        this.updateGlobalState();

        this.emit();

        return this.getState();
    }


    /* ==========================================================
     * CONNECT EXISTING MODULES
     * ========================================================== */

    connectModules() {

        this.modules.patterns =
            window.patternsEngine ||
            this.instantiate("PatternEngine");

        this.modules.probability =
            window.probabilityEngine ||
            this.instantiate("ProbabilityEngine");

        this.modules.statistics =
            window.statisticsEngine ||
            this.instantiate("StatisticsEngine");

        this.modules.transition =
            window.transitionEngine ||
            this.instantiate("TransitionEngine");

        this.modules.markov =
            window.markovEngine ||
            this.instantiate("MarkovEngine");

        this.modules.cycle =
            window.cycleEngine ||
            this.instantiate("CycleEngine");

        this.modules.confidence =
            window.confidenceEngine ||
            this.instantiate("ConfidenceEngine");

        this.modules.learning =
            window.learningEngine ||
            this.instantiate("LearningEngine");

        /*
         * Optional modules.
         * We do not rebuild them if they are absent.
         */

        this.modules.validator =
            window.validatorEngine ||
            window.ValidatorEngine ||
            null;

        this.modules.decision =
            window.decisionEngine ||
            window.DecisionEngine ||
            null;

        this.modules.entryLogic =
            window.entryLogic ||
            window.EntryLogic ||
            null;

        this.modules.tradeManager =
            window.tradeManager ||
            window.TradeManager ||
            null;

        this.modules.riskManager =
            window.riskManager ||
            window.RiskManager ||
            null;

        this.modules.paperTrading =
            window.paperTrading ||
            window.PaperTradingEngine ||
            null;

        this.modules.performance =
            window.performanceEngine ||
            window.PerformanceEngine ||
            null;

        this.analysis.activeModules =
            this.countAnalysisModules();
    }


    /* ==========================================================
     * SAFE MODULE INSTANTIATION
     * ========================================================== */

    instantiate(className) {

        try {

            const Constructor =
                window[className];

            if (
                typeof Constructor ===
                "function"
            ) {
                return new Constructor();
            }

        } catch (error) {

            console.warn(
                `${className} could not be created:`,
                error
            );
        }

        return null;
    }


    /* ==========================================================
     * COUNT CORE MODULES
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
     * RECEIVE DERIV TICK
     * ========================================================== */

    receiveTick(data) {

        if (!this.started) {
            this.initialize();
        }

        if (
            this.paused ||
            !data
        ) {
            return null;
        }

        const market =
            data.symbol ||
            data.market ||
            this.activeMarket;

        if (!market) {
            return null;
        }

        this.ensureMarket(market);

        const quote =
            this.extractQuote(data);

        if (
            !Number.isFinite(quote)
        ) {
            return null;
        }

        const digit =
            Number.isInteger(data.digit)
                ? data.digit
                : this.extractDigit(
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
            symbol: market,
            market,

            quote,
            digit,

            epoch:
                Number(
                    data.epoch ||
                    data.time ||
                    0
                ),

            pip_size:
                data.pip_size ??
                data.pipSize ??
                null,

            receivedAt:
                Date.now()
        };

        this.storeTick(
            market,
            tick
        );

        const result =
            this.analyzeMarket(
                market,
                tick
            );

        if (
            market === this.activeMarket
        ) {
            this.updateGlobalState();
            this.emit();
        }

        return result;
    }


    /* ==========================================================
     * ENSURE MARKET EXISTS
     * ========================================================== */

    ensureMarket(market) {

        if (
            !this.marketMemories[market]
        ) {

            this.marketMemories[market] =
                this.createMarketMemory();
        }

        if (
            !this.markets.includes(market)
        ) {

            this.markets.push(market);
        }
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

        for (const candidate of candidates) {

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

            if (
                decimals > 0
            ) {

                const formatted =
                    quote.toFixed(
                        decimals
                    );

                const digits =
                    formatted.replace(
                        /\D/g,
                        ""
                    );

                if (
                    digits.length > 0
                ) {

                    return Number(
                        digits[
                            digits.length - 1
                        ]
                    );
                }
            }
        }

        const text =
            String(quote);

        const digits =
            text.replace(
                /\D/g,
                ""
            );

        if (
            digits.length === 0
        ) {
            return null;
        }

        return Number(
            digits[
                digits.length - 1
            ]
        );
    }


    /* ==========================================================
     * STORE TICK FOR SPECIFIC MARKET
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

        memory.ticks.push(tick);

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
     * ANALYZE ONE MARKET
     * ========================================================== */

    analyzeMarket(
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
         * Not enough observations.
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

                tickCount:
                    memory.digits.length,

                signal:
                    "WAIT",

                decision:
                    "WAIT",

                recommendation:
                    "Collecting data",

                confidence:
                    0,

                prediction:
                    null,

                lastUpdate:
                    Date.now(),

                activeModules:
                    this.countAnalysisModules(),

                modulesAgreeing:
                    0,

                results:
                    {}
            };

            return this.getMarketState(
                market
            );
        }


        /*
         * Run the six core analysis modules.
         */

        const patternResult =
            this.safeAnalyze(
                this.modules.patterns,
                digits,
                "patterns"
            );

        const probabilityResult =
            this.safeAnalyze(
                this.modules.probability,
                digits,
                "probability"
            );

        const statisticsResult =
            this.safeAnalyze(
                this.modules.statistics,
                digits,
                "statistics"
            );

        const transitionResult =
            this.safeAnalyze(
                this.modules.transition,
                digits,
                "transition"
            );

        const markovResult =
            this.safeAnalyze(
                this.modules.markov,
                digits,
                "markov"
            );

        const cycleResult =
            this.safeAnalyze(
                this.modules.cycle,
                digits,
                "cycle"
            );


        /*
         * Confidence combines the six analyses.
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
         * Validation protects against weak or incomplete evidence.
         */

        const validationResult =
            this.runValidation(
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
         * Final analytical decision.
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
         * Prefer the most structured prediction.
         */

        const prediction =
            this.extractPrediction(
                markovResult,
                transitionResult,
                probabilityResult,
                patternResult
            );


        /*
         * Module agreement.
         */

        const agreement =
            this.calculateAgreement([
                patternResult,
                probabilityResult,
                statisticsResult,
                transitionResult,
                markovResult,
                cycleResult
            ]);


        /*
         * Save complete market result.
         */

        memory.analysis = {

            lastDigit:
                tick.digit,

            currentTick:
                tick.quote,

            tickCount:
                memory.digits.length,

            confidence:
                this.safeNumber(
                    confidenceResult.confidence ??
                    confidenceResult.score
                ),

            probability:
                this.safeNumber(
                    probabilityResult.score
                ),

            prediction,

            signal:
                decisionResult.signal ||
                "WAIT",

            decision:
                decisionResult.decision ||
                decisionResult.signal ||
                "WAIT",

            recommendation:
                decisionResult.reason ||
                validationResult.reason ||
                "Waiting",

            modulesAgreeing:
                agreement,

            activeModules:
                this.countAnalysisModules(),

            lastUpdate:
                Date.now(),

            results: {

                patterns:
                    patternResult,

                probability:
                    probabilityResult,

                statistics:
                    statisticsResult,

                transition:
                    transitionResult,

                markov:
                    markovResult,

                cycle:
                    cycleResult,

                            }
        };

        this.updateDashboard();

        return this.memory.analysis;
    }

    countAnalysisModules() {
        return Object.keys(this.modules).filter(
            key => this.modules[key] !== null &&
                   this.modules[key] !== undefined
        ).length;
    }

    safeNumber(value, fallback = 0) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return fallback;
        }

        return number;
    }

    extractPrediction(
        markovResult,
        transitionResult,
        probabilityResult,
        patternResult
    ) {
        if (
            markovResult &&
            markovResult.prediction !== undefined
        ) {
            return markovResult.prediction;
        }

        if (
            transitionResult &&
            transitionResult.prediction !== undefined
        ) {
            return transitionResult.prediction;
        }

        if (
            probabilityResult &&
            probabilityResult.prediction !== undefined
        ) {
            return probabilityResult.prediction;
        }

        if (
            patternResult &&
            patternResult.prediction !== undefined
        ) {
            return patternResult.prediction;
        }

        if (
            patternResult &&
            patternResult.hotDigit !== undefined
        ) {
            return patternResult.hotDigit;
        }

        return null;
    }

    calculateAgreement(results) {
        const validResults = results.filter(
            result =>
                result &&
                typeof result === "object"
        );

        if (validResults.length === 0) {
            return 0;
        }

        const scores = validResults
            .map(result =>
                this.safeNumber(
                    result.score,
                    0
                )
            );

        const total = scores.reduce(
            (sum, score) => sum + score,
            0
        );

        return this.safeNumber(
            total / scores.length,
            0
        );
    }

    updateDashboard() {
        const analysis = this.memory.analysis;

        const set = (id, value) => {
            const element =
                document.getElementById(id);

            if (element) {
                element.textContent =
                    value;
            }
        };

        set(
            "status",
            "Connected"
        );

        set(
            "market",
            analysis.market || "R_100"
        );

        set(
            "lastDigit",
            analysis.lastDigit ?? "-"
        );

        set(
            "tick",
            analysis.currentTick ?? "-"
        );

        set(
            "pattern",
            analysis.pattern || "Scanning"
        );

        set(
            "probability",
            this.safeNumber(
                analysis.probability
            ) + "%"
        );

        set(
            "confidence",
            this.safeNumber(
                analysis.confidence
            ) + "%"
        );

        set(
            "prediction",
            analysis.prediction !== null &&
            analysis.prediction !== undefined
                ? "Digit " + analysis.prediction
                : "Waiting"
        );

        set(
            "signal",
            analysis.signal || "WAIT"
        );

        set(
            "recommendation",
            analysis.recommendation ||
            "Analyzing..."
        );

        set(
            "memory",
            this.memory.ticks.length +
            " / " +
            this.memory.maxTicks
        );

        set(
            "time",
            new Date().toLocaleTimeString()
        );

        set(
            "modules",
            this.countAnalysisModules()
        );
    }
}

window.engine =
    new AnalysisEngine();
