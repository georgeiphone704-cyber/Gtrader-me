/*
 * ============================================================
 * GTRADER-ME MASTER ANALYSIS ENGINE
 * ============================================================
 *
 * PURPOSE
 * ------------------------------------------------------------
 * Central controller for the digit-analysis system.
 *
 * FLOW
 * ------------------------------------------------------------
 * Deriv tick
 *    ↓
 * Market routing
 *    ↓
 * Independent market memory
 *    ↓
 * Analysis modules
 *    ↓
 * Confidence
 *    ↓
 * Validation
 *    ↓
 * Decision
 *    ↓
 * Learning / dashboard
 *
 * IMPORTANT
 * ------------------------------------------------------------
 * This engine analyses data only.
 * It does NOT place live trades.
 *
 * Supported markets:
 * R_10, R_25, R_50, R_75, R_100
 * 1HZ10V, 1HZ25V, 1HZ50V, 1HZ75V, 1HZ100V
 * ============================================================
 */

class AnalysisEngine {

    constructor(options = {}) {

        this.config = {

            markets: Array.isArray(options.markets)
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
                ],

            defaultMarket:
                options.defaultMarket || "R_100",

            maxTicks:
                this.number(
                    options.maxTicks,
                    10000
                ),

            analysisWindow:
                this.number(
                    options.analysisWindow,
                    300
                ),

            minimumAnalysisTicks:
                this.number(
                    options.minimumAnalysisTicks,
                    50
                ),

            minimumModuleScore:
                this.number(
                    options.minimumModuleScore,
                    50
                ),

            tradeConfidence:
                this.number(
                    options.tradeConfidence,
                    90
                ),

            maximumStaleMs:
                this.number(
                    options.maximumStaleMs,
                    30000
                )
        };

        this.activeMarket =
            this.config.markets.includes(
                this.config.defaultMarket
            )
                ? this.config.defaultMarket
                : this.config.markets[0];

        this.marketMemories = {};

        for (
            const market of this.config.markets
        ) {
            this.marketMemories[market] =
                this.createMarketMemory();
        }

        this.modules = {};

        this.started = false;
        this.paused = false;

        this.listeners = [];

        this.lastError = null;

        this.analysis = {
            market: this.activeMarket,
            status: "Initializing",

            lastDigit: null,
            currentTick: null,
            currentEpoch: null,

            tickCount: 0,

            confidence: 0,
            probability: 0,

            prediction: null,

            signal: "WAIT",
            decision: "WAIT",

            recommendation:
                "Initializing analysis",

            modulesAgreeing: 0,
            activeModules: 0,

            lastUpdate: 0,

            patterns: {},
            probabilityAnalysis: {},
            statistics: {},
            transition: {},
            markov: {},
            cycle: {},

            confidenceAnalysis: {},
            validation: {},
            decisionAnalysis: {}
        };
    }


    /* ==========================================================
     * BASIC NUMBER HELPER
     * ========================================================== */

    number(value, fallback = 0) {

        const n = Number(value);

        return Number.isFinite(n)
            ? n
            : fallback;
    }


    /* ==========================================================
     * MARKET MEMORY
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

                currentEpoch: null,

                tickCount: 0,

                confidence: 0,

                probability: 0,

                prediction: null,

                signal: "WAIT",

                decision: "WAIT",

                recommendation:
                    "Waiting",

                modulesAgreeing: 0,

                activeModules: 0,

                lastUpdate: 0,

                results: {}
            }
        };
    }


    /* ==========================================================
     * INITIALIZATION
     * ========================================================== */

    initialize() {

        if (this.started) {
            return this.getState();
        }

        this.connectModules();

        this.started = true;

        this.analysis.status =
            "Ready";

        this.updateGlobalState();

        this.emit();

        return this.getState();
    }


    /* ==========================================================
     * MODULE CONNECTION
     * ========================================================== */

    connectModules() {

        this.modules.patterns =
            this.resolveModule(
                "patternsEngine",
                "PatternEngine"
            );

        this.modules.probability =
            this.resolveModule(
                "probabilityEngine",
                "ProbabilityEngine"
            );

        this.modules.statistics =
            this.resolveModule(
                "statisticsEngine",
                "StatisticsEngine"
            );

        this.modules.transition =
            this.resolveModule(
                "transitionEngine",
                "TransitionEngine"
            );

        this.modules.markov =
            this.resolveModule(
                "markovEngine",
                "MarkovEngine"
            );

        this.modules.cycle =
            this.resolveModule(
                "cycleEngine",
                "CycleEngine"
            );

        this.modules.confidence =
            this.resolveModule(
                "confidenceEngine",
                "ConfidenceEngine"
            );

        this.modules.learning =
            this.resolveModule(
                "learningEngine",
                "LearningEngine"
            );

        this.modules.validator =
            this.resolveModule(
                "validatorEngine",
                "ValidatorEngine"
            );

        this.modules.decision =
            this.resolveModule(
                "decisionEngine",
                "DecisionEngine"
            );

        this.modules.entryLogic =
            this.resolveModule(
                "entryLogic",
                "EntryLogic"
            );

        this.modules.riskManager =
            this.resolveModule(
                "riskManager",
                "RiskManager"
            );

        this.modules.paperTrading =
            this.resolveModule(
                "paperTrading",
                "PaperTradingEngine"
            );

        this.modules.performance =
            this.resolveModule(
                "performanceEngine",
                "PerformanceEngine"
            );

        this.analysis.activeModules =
            this.countAnalysisModules();
    }


    /* ==========================================================
     * SAFE MODULE RESOLUTION
     * ========================================================== */

    resolveModule(
        globalName,
        className
    ) {

        try {

            if (
                typeof window !==
                "undefined"
            ) {

                if (
                    window[globalName]
                ) {
                    return window[globalName];
                }

                if (
                    typeof window[className] ===
                    "function"
                ) {
                    return new window[className]();
                }
            }

        } catch (error) {

            this.lastError =
                error.message;

            console.warn(
                `${className} resolution error:`,
                error
            );
        }

        return null;
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
                this.modules[name] &&
                typeof this.modules[name].analyze ===
                "function"
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
            !data ||
            typeof data !== "object"
        ) {
            return null;
        }

        const market =
            data.symbol ||
            data.market ||
            data.underlying ||
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
                this.number(
                    data.epoch ??
                    data.time ??
                    data.timestamp,
                    0
                ),

            pipSize:
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
            market ===
            this.activeMarket
        ) {

            this.updateGlobalState();

            this.emit();
        }

        return result;
    }


    /* ==========================================================
     * ENSURE MARKET
     * ========================================================== */

    ensureMarket(market) {

        if (
            !this.marketMemories[market]
        ) {

            this.marketMemories[market] =
                this.createMarketMemory();
        }

        if (
            !this.config.markets.includes(
                market
            )
        ) {

            this.config.markets.push(
                market
            );
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

            data.tick?.quote,

            data.tick?.price,

            data.tick?.value
        ];

        for (
            const candidate of
            candidates
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

            if (
                decimals > 0
            ) {

                const formatted =
                    Number(quote)
                        .toFixed(
                            decimals
                        );

                const digits =
                    formatted.replace(
                        /\D/g,
                        ""
                    );

                if (
                    digits.length
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

        if (!digits.length) {
            return null;
        }

        return Number(
            digits[
                digits.length - 1
            ]
        );
    }


    /* ==========================================================
     * STORE TICK
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
            this.config.maxTicks
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

                if (
                    memory.frequencies[
                        removedDigit
                    ] < 0
                ) {

                    memory.frequencies[
                        removedDigit
                    ] = 0;
                }
            }
        }
    }


    /* ==========================================================
     * ANALYZE MARKET
     * ========================================================== */

    analyzeMarket(
        market,
        tick
    ) {

        const memory =
            this.marketMemories[market];

        if (!memory) {
            return null;
        }

        const digits =
            memory.digits.slice(
                -this.config.analysisWindow
            );

        if (
            digits.length <
            this.config.minimumAnalysisTicks
        ) {

            memory.analysis = {

                ...memory.analysis,

                lastDigit:
                    tick.digit,

                currentTick:
                    tick.quote,

                currentEpoch:
                    tick.epoch,

                tickCount:
                    digits.length,

                confidence: 0,

                probability: 0,

                prediction: null,

                signal: "WAIT",

                decision: "WAIT",

                recommendation:
                    `Collecting data (${digits.length}/${this.config.minimumAnalysisTicks})`,

                modulesAgreeing: 0,

                activeModules:
                    this.countAnalysisModules(),

                lastUpdate:
                    Date.now(),

                results: {}
            };

            return this.getMarketState(
                market
            );
        }

        const results =
            this.runCoreModules(
                digits
            );

        const confidenceResult =
            this.runConfidence(
                results
            );

        const validationResult =
            this.runValidation(
                confidenceResult,
                results
            );

        const decisionResult =
            this.runDecision(
                confidenceResult,
                validationResult,
                results
            );

        const prediction =
            this.extractPrediction(
                results
            );

        const agreement =
            this.calculateAgreement(
                Object.values(results)
            );

        memory.analysis = {

            lastDigit:
                tick.digit,

            currentTick:
                tick.quote,

            currentEpoch:
                tick.epoch,

            tickCount:
                memory.digits.length,

            confidence:
                this.safeScore(
                    confidenceResult.confidence ??
                    confidenceResult.score
                ),

            probability:
                this.extractProbability(
                    results.probability
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

                ...results,

                confidence:
                    confidenceResult,

                validation:
                    validationResult,

                decision:
                    decisionResult
            }
        };

        this.runLearning(
            market,
            decisionResult,
            results
        );

        return this.getMarketState(
            market
        );
    }
        /* ==========================================================
     * CORE MODULE PIPELINE
     * ========================================================== */

    runCoreModules(digits) {

        return {

            patterns:
                this.safeAnalyze(
                    this.modules.patterns,
                    digits,
                    "patterns"
                ),

            probability:
                this.safeAnalyze(
                    this.modules.probability,
                    digits,
                    "probability"
                ),

            statistics:
                this.safeAnalyze(
                    this.modules.statistics,
                    digits,
                    "statistics"
                ),

            transition:
                this.safeAnalyze(
                    this.modules.transition,
                    digits,
                    "transition"
                ),

            markov:
                this.safeAnalyze(
                    this.modules.markov,
                    digits,
                    "markov"
                ),

            cycle:
                this.safeAnalyze(
                    this.modules.cycle,
                    digits,
                    "cycle"
                )
        };
    }


    /* ==========================================================
     * SAFE ANALYSIS CALL
     * ========================================================== */

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

            probability: 0,

            samples:
                digits.length,

            prediction: null,

            digit: null,

            recommendation:
                "WAIT",

            reason:
                "Module unavailable"
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
                !result ||
                typeof result !==
                "object"
            ) {
                return fallback;
            }

            const normalized = {

                ...fallback,

                ...result,

                module:
                    result.module ||
                    name,

                score:
                    this.safeScore(
                        result.score
                    ),

                confidence:
                    this.safeScore(
                        result.confidence ??
                        result.score
                    ),

                probability:
                    this.safeScore(
                        result.probability ??
                        result.score
                    ),

                samples:
                    this.number(
                        result.samples,
                        digits.length
                    )
            };

            normalized.success =
                result.success !== false;

            return normalized;

        } catch (error) {

            console.warn(
                `${name} analysis error:`,
                error
            );

            this.lastError =
                error.message;

            return {

                ...fallback,

                error:
                    error.message
            };
        }
    }


    /* ==========================================================
     * SCORE NORMALIZATION
     * ========================================================== */

    safeScore(value) {

        const number =
            Number(value);

        if (
            !Number.isFinite(number)
        ) {
            return 0;
        }

        return Number(
            Math.max(
                0,
                Math.min(
                    100,
                    number
                )
            ).toFixed(2)
        );
    }


    /* ==========================================================
     * PROBABILITY EXTRACTION
     * ========================================================== */

    extractProbability(result) {

        if (!result) {
            return 0;
        }

        const candidates = [

            result.probability,

            result.score,

            result.confidence
        ];

        for (
            const candidate of
            candidates
        ) {

            const value =
                Number(candidate);

            if (
                Number.isFinite(value)
            ) {

                return this.safeScore(
                    value
                );
            }
        }

        return 0;
    }


    /* ==========================================================
     * CONFIDENCE ENGINE
     * ========================================================== */

    runConfidence(results) {

        const ordered = [

            results.patterns,

            results.probability,

            results.statistics,

            results.transition,

            results.markov,

            results.cycle
        ];

        if (
            this.modules.confidence &&
            typeof this.modules.confidence.analyze ===
            "function"
        ) {

            try {

                const result =
                    this.modules.confidence.analyze(
                        ...ordered
                    );

                if (
                    result &&
                    typeof result ===
                    "object"
                ) {

                    return {

                        ...result,

                        score:
                            this.safeScore(
                                result.score ??
                                result.confidence
                            ),

                        confidence:
                            this.safeScore(
                                result.confidence ??
                                result.score
                            )
                    };
                }

            } catch (error) {

                console.warn(
                    "Confidence engine error:",
                    error
                );

                this.lastError =
                    error.message;
            }
        }

        return this.localConfidence(
            ordered
        );
    }


    /* ==========================================================
     * LOCAL CONFIDENCE
     * ========================================================== */

    localConfidence(results) {

        const valid =
            results.filter(
                result =>
                    result &&
                    result.success === true
            );

        if (!valid.length) {

            return {

                module:
                    "confidence",

                success: false,

                score: 0,

                confidence: 0,

                activeModules: 0,

                agreement: 0
            };
        }

        const scores =
            valid.map(
                result =>
                    this.safeScore(
                        result.score ??
                        result.confidence
                    )
            );

        const average =
            scores.reduce(
                (sum, value) =>
                    sum + value,
                0
            ) /
            scores.length;

        const strong =
            scores.filter(
                score =>
                    score >=
                    this.config.minimumModuleScore
            ).length;

        const agreement =
            (
                strong /
                scores.length
            ) * 100;

        const confidence =
            (
                average * 0.70
            ) +
            (
                agreement * 0.30
            );

        return {

            module:
                "confidence",

            success:
                confidence >=
                this.config.tradeConfidence,

            score:
                this.safeScore(
                    confidence
                ),

            confidence:
                this.safeScore(
                    confidence
                ),

            activeModules:
                valid.length,

            agreement:
                this.safeScore(
                    agreement
                )
        };
    }


    /* ==========================================================
     * VALIDATION
     * ========================================================== */

    runValidation(
        confidenceResult,
        results
    ) {

        if (
            this.modules.validator
        ) {

            try {

                if (
                    typeof this.modules.validator.validate ===
                    "function"
                ) {

                    const result =
                        this.modules.validator.validate(
                            confidenceResult,
                            results
                        );

                    if (result) {
                        return result;
                    }
                }

                if (
                    typeof this.modules.validator.analyze ===
                    "function"
                ) {

                    const result =
                        this.modules.validator.analyze(
                            confidenceResult,
                            results
                        );

                    if (result) {
                        return result;
                    }
                }

            } catch (error) {

                console.warn(
                    "Validator error:",
                    error
                );

                this.lastError =
                    error.message;
            }
        }

        const modules =
            Object.values(
                results
            );

        const active =
            modules.filter(
                result =>
                    result &&
                    result.success === true
            ).length;

        const confidence =
            this.safeScore(
                confidenceResult.confidence ??
                confidenceResult.score
            );

        const strong =
            modules.filter(
                result =>
                    result &&
                    result.success === true &&
                    this.safeScore(
                        result.score
                    ) >=
                    this.config.minimumModuleScore
            ).length;

        const valid =
            active >= 3 &&
            strong >= 3 &&
            confidence >=
            this.config.tradeConfidence;

        return {

            module:
                "validation",

            valid,

            score:
                confidence,

            activeModules:
                active,

            strongModules:
                strong,

            reason:
                valid
                    ? "Validation passed"
                    : "Conditions not strong enough"
        };
    }


    /* ==========================================================
     * DECISION ENGINE
     * ========================================================== */

    runDecision(
        confidenceResult,
        validationResult,
        results
    ) {

        if (
            this.modules.decision
        ) {

            try {

                if (
                    typeof this.modules.decision.analyze ===
                    "function"
                ) {

                    const result =
                        this.modules.decision.analyze(
                            confidenceResult,
                            validationResult,
                            results
                        );

                    if (result) {

                        return {

                            ...result,

                            signal:
                                result.signal ||
                                result.decision ||
                                "WAIT",

                            decision:
                                result.decision ||
                                result.signal ||
                                "WAIT"
                        };
                    }
                }

                if (
                    typeof this.modules.decision.decide ===
                    "function"
                ) {

                    const result =
                        this.modules.decision.decide(
                            confidenceResult,
                            validationResult,
                            results
                        );

                    if (result) {

                        return {

                            ...result,

                            signal:
                                result.signal ||
                                result.decision ||
                                "WAIT",

                            decision:
                                result.decision ||
                                result.signal ||
                                "WAIT"
                        };
                    }
                }

            } catch (error) {

                console.warn(
                    "Decision engine error:",
                    error
                );

                this.lastError =
                    error.message;
            }
        }

        const confidence =
            this.safeScore(
                confidenceResult.confidence ??
                confidenceResult.score
            );

        const approved =
            validationResult &&
            validationResult.valid === true &&
            confidence >=
            this.config.tradeConfidence;

        return {

            module:
                "decision",

            signal:
                approved
                    ? "TRADE"
                    : "WAIT",

            decision:
                approved
                    ? "TRADE"
                    : "WAIT",

            confidence,

            reason:
                approved
                    ? "Confidence and validation passed"
                    : "Waiting for stronger conditions"
        };
    }


    /* ==========================================================
     * PREDICTION EXTRACTION
     * ========================================================== */

    extractPrediction(results) {

        const candidates = [

            results.markov,

            results.transition,

            results.probability,

            results.patterns,

            results.cycle
        ];

        for (
            const result of
            candidates
        ) {

            if (!result) {
                continue;
            }

            if (
                result.prediction &&
                typeof result.prediction ===
                "object" &&
                result.prediction.digit !==
                undefined
            ) {

                const digit =
                    Number(
                        result.prediction.digit
                    );

                if (
                    Number.isInteger(digit) &&
                    digit >= 0 &&
                    digit <= 9
                ) {
                    return digit;
                }
            }

            const values = [

                result.predictedDigit,

                result.digit,

                result.prediction
            ];

            for (
                const value of
                values
            ) {

                const digit =
                    Number(value);

                if (
                    Number.isInteger(digit) &&
                    digit >= 0 &&
                    digit <= 9
                ) {

                    return digit;
                }
            }
        }

        return null;
    }


    /* ==========================================================
     * MODULE AGREEMENT
     * ========================================================== */

    calculateAgreement(results) {

        const valid =
            results.filter(
                result =>
                    result &&
                    result.success === true
            );

        if (!valid.length) {
            return 0;
        }

        const strong =
            valid.filter(
                result =>
                    this.safeScore(
                        result.score ??
                        result.confidence
                    ) >=
                    this.config.minimumModuleScore
            ).length;

        return Math.round(
            (
                strong /
                valid.length
            ) * 100
        );
    }
        /* ==========================================================
     * LEARNING
     * ========================================================== */

    runLearning(
        market,
        decisionResult,
        results
    ) {

        if (
            !this.modules.learning
        ) {
            return;
        }

        try {

            if (
                typeof this.modules.learning.analyze ===
                "function"
            ) {

                this.modules.learning.analyze(
                    decisionResult,
                    {
                        market,
                        results
                    }
                );

                return;
            }

            if (
                typeof this.modules.learning.update ===
                "function"
            ) {

                this.modules.learning.update(
                    {
                        market,

                        decision:
                            decisionResult,

                        results
                    }
                );
            }

        } catch (error) {

            console.warn(
                "Learning error:",
                error
            );

            this.lastError =
                error.message;
        }
    }


    /* ==========================================================
     * SET ACTIVE MARKET
     * ========================================================== */

    setMarket(market) {

        if (
            !this.marketMemories[market]
        ) {

            return {

                success: false,

                reason:
                    "Market not configured"
            };
        }

        this.activeMarket =
            market;

        this.analysis.market =
            market;

        this.updateGlobalState();

        this.emit();

        return {

            success: true,

            market
        };
    }


    /* ==========================================================
     * GET MARKET STATE
     * ========================================================== */

    getMarketState(market) {

        const memory =
            this.marketMemories[market];

        if (!memory) {
            return null;
        }

        return {

            market,

            tickCount:
                memory.ticks.length,

            lastDigit:
                memory.analysis.lastDigit,

            currentTick:
                memory.analysis.currentTick,

            currentEpoch:
                memory.analysis.currentEpoch,

            confidence:
                memory.analysis.confidence,

            probability:
                memory.analysis.probability,

            prediction:
                memory.analysis.prediction,

            signal:
                memory.analysis.signal,

            decision:
                memory.analysis.decision,

            recommendation:
                memory.analysis.recommendation,

            modulesAgreeing:
                memory.analysis.modulesAgreeing,

            activeModules:
                memory.analysis.activeModules,

            frequencies:
                [
                    ...memory.frequencies
                ],

            recentDigits:
                memory.digits.slice(-20),

            analysis:
                this.clone(
                    memory.analysis
                )
        };
    }


    /* ==========================================================
     * GET ALL MARKETS
     * ========================================================== */

    getAllMarketStates() {

        const result = {};

        for (
            const market of
            this.config.markets
        ) {

            result[market] =
                this.getMarketState(
                    market
                );
        }

        return result;
    }


    /* ==========================================================
     * GLOBAL STATE
     * ========================================================== */

    updateGlobalState() {

        const state =
            this.getMarketState(
                this.activeMarket
            );

        if (!state) {
            return;
        }

        this.analysis.market =
            this.activeMarket;

        this.analysis.status =
            state.tickCount <
            this.config.minimumAnalysisTicks
                ? "Collecting data"
                : this.paused
                    ? "Paused"
                    : "Ready";

        this.analysis.lastDigit =
            state.lastDigit;

        this.analysis.currentTick =
            state.currentTick;

        this.analysis.currentEpoch =
            state.currentEpoch;

        this.analysis.tickCount =
            state.tickCount;

        this.analysis.confidence =
            state.confidence;

        this.analysis.probability =
            state.probability;

        this.analysis.prediction =
            state.prediction;

        this.analysis.signal =
            state.signal;

        this.analysis.decision =
            state.decision;

        this.analysis.recommendation =
            state.recommendation;

        this.analysis.modulesAgreeing =
            state.modulesAgreeing;

        this.analysis.activeModules =
            state.activeModules;

        this.analysis.lastUpdate =
            state.analysis.lastUpdate;

        const results =
            state.analysis.results ||
            {};

        this.analysis.patterns =
            results.patterns ||
            {};

        this.analysis.probabilityAnalysis =
            results.probability ||
            {};

        this.analysis.statistics =
            results.statistics ||
            {};

        this.analysis.transition =
            results.transition ||
            {};

        this.analysis.markov =
            results.markov ||
            {};

        this.analysis.cycle =
            results.cycle ||
            {};

        this.analysis.confidenceAnalysis =
            results.confidence ||
            {};

        this.analysis.validation =
            results.validation ||
            {};

        this.analysis.decisionAnalysis =
            results.decision ||
            {};
    }


    /* ==========================================================
     * PAUSE
     * ========================================================== */

    pause() {

        this.paused = true;

        this.analysis.status =
            "Paused";

        this.emit();

        return this.getState();
    }


    /* ==========================================================
     * RESUME
     * ========================================================== */

    resume() {

        this.paused = false;

        this.analysis.status =
            "Ready";

        this.emit();

        return this.getState();
    }


    /* ==========================================================
     * RESET ONE MARKET
     * ========================================================== */

    resetMarket(market) {

        if (
            !this.marketMemories[market]
        ) {
            return false;
        }

        this.marketMemories[market] =
            this.createMarketMemory();

        if (
            market ===
            this.activeMarket
        ) {

            this.updateGlobalState();

            this.emit();
        }

        return true;
    }


    /* ==========================================================
     * RESET EVERYTHING
     * ========================================================== */

    reset() {

        for (
            const market of
            this.config.markets
        ) {

            this.marketMemories[market] =
                this.createMarketMemory();
        }

        const resetModules = [

            "patterns",

            "probability",

            "statistics",

            "transition",

            "markov",

            "cycle",

            "confidence",

            "learning",

            "performance"
        ];

        for (
            const name of
            resetModules
        ) {

            const module =
                this.modules[name];

            if (
                module &&
                typeof module.reset ===
                "function"
            ) {

                try {

                    module.reset();

                } catch (error) {

                    console.warn(
                        `${name} reset error:`,
                        error
                    );
                }
            }
        }

        this.analysis = {

            ...this.analysis,

            lastDigit: null,

            currentTick: null,

            currentEpoch: null,

            tickCount: 0,

            confidence: 0,

            probability: 0,

            prediction: null,

            signal: "WAIT",

            decision: "WAIT",

            recommendation:
                "Waiting",

            modulesAgreeing: 0,

            lastUpdate: 0,

            patterns: {},

            probabilityAnalysis: {},

            statistics: {},

            transition: {},

            markov: {},

            cycle: {},

            confidenceAnalysis: {},

            validation: {},

            decisionAnalysis: {}
        };

        this.emit();

        return this.getState();
    }


    /* ==========================================================
     * RECENT TICKS
     * ========================================================== */

    getRecentTicks(
        market,
        count = 50
    ) {

        if (
            typeof market ===
            "number"
        ) {

            count = market;

            market =
                this.activeMarket;
        }

        market =
            market ||
            this.activeMarket;

        const memory =
            this.marketMemories[market];

        if (!memory) {
            return [];
        }

        const amount =
            Math.max(
                1,
                Math.floor(
                    this.number(
                        count,
                        50
                    )
                )
            );

        return memory.ticks.slice(
            -amount
        );
    }


    /* ==========================================================
     * RECENT DIGITS
     * ========================================================== */

    getRecentDigits(
        market = this.activeMarket,
        count = 50
    ) {

        const memory =
            this.marketMemories[market];

        if (!memory) {
            return [];
        }

        const amount =
            Math.max(
                1,
                Math.floor(
                    this.number(
                        count,
                        50
                    )
                )
            );

        return memory.digits.slice(
            -amount
        );
    }


    /* ==========================================================
     * FREQUENCIES
     * ========================================================== */

    getFrequencies(
        market = this.activeMarket
    ) {

        const memory =
            this.marketMemories[market];

        if (!memory) {
            return Array(10).fill(0);
        }

        return [
            ...memory.frequencies
        ];
    }


    /* ==========================================================
     * DIGIT PERCENTAGES
     * ========================================================== */

    getDigitPercentages(
        market = this.activeMarket
    ) {

        const frequencies =
            this.getFrequencies(
                market
            );

        const total =
            frequencies.reduce(
                (sum, value) =>
                    sum + value,
                0
            );

        if (!total) {
            return Array(10).fill(0);
        }

        return frequencies.map(
            value =>
                Number(
                    (
                        value /
                        total *
                        100
                    ).toFixed(2)
                )
        );
    }


    /* ==========================================================
     * DASHBOARD UPDATE
     * ========================================================== */

    updateDashboard() {

        if (
            typeof document ===
            "undefined"
        ) {
            return;
        }

        const state =
            this.getMarketState(
                this.activeMarket
            );

        if (!state) {
            return;
        }

        const set = (
            id,
            value
        ) => {

            const element =
                document.getElementById(id);

            if (element) {

                element.textContent =
                    String(value);
            }
        };

        set(
            "status",
            this.analysis.status
        );

        set(
            "market",
            this.activeMarket
        );

        set(
            "lastDigit",
            this.analysis.lastDigit ??
            "-"
        );

        set(
            "tick",
            this.analysis.currentTick ??
            "-"
        );

        set(
            "confidence",
            `${this.analysis.confidence}%`
        );

        set(
            "probability",
            `${this.analysis.probability}%`
        );

        set(
            "prediction",
            this.analysis.prediction ??
            "-"
        );

        set(
            "signal",
            this.analysis.signal
        );

        set(
            "decision",
            this.analysis.decision
        );

        set(
            "recommendation",
            this.analysis.recommendation
        );

        set(
            "moduleAgreement",
            `${this.analysis.modulesAgreeing}%`
        );

        set(
            "activeModules",
            this.analysis.activeModules
        );

        set(
            "tickCount",
            state.tickCount
        );

        set(
            "memory",
            `${state.tickCount} / ${this.config.maxTicks}`
        );

        set(
            "markovScore",
            `${this.moduleScore(
                state.analysis.results?.markov
            )}%`
        );

        set(
            "cycleScore",
            `${this.moduleScore(
                state.analysis.results?.cycle
            )}%`
        );

        set(
            "patternScore",
            `${this.moduleScore(
                state.analysis.results?.patterns
            )}%`
        );

        set(
            "probabilityScore",
            `${this.moduleScore(
                state.analysis.results?.probability
            )}%`
        );

        set(
            "statisticsScore",
            `${this.moduleScore(
                state.analysis.results?.statistics
            )}%`
        );

        set(
            "transitionScore",
            `${this.moduleScore(
                state.analysis.results?.transition
            )}%`
        );

        set(
            "time",
            state.analysis.lastUpdate
                ? new Date(
                    state.analysis.lastUpdate
                ).toLocaleTimeString()
                : "-"
        );
    }
        /* ==========================================================
     * MODULE SCORE
     * ========================================================== */

    moduleScore(result) {

        if (!result) {
            return 0;
        }

        return this.safeScore(
            result.score ??
            result.confidence ??
            result.probability
        );
    }


    /* ==========================================================
     * EVENT LISTENER
     * ========================================================== */

    onUpdate(callback) {

        if (
            typeof callback !==
            "function"
        ) {
            return () => {};
        }

        this.listeners.push(
            callback
        );

        return () => {

            this.listeners =
                this.listeners.filter(
                    listener =>
                        listener !==
                        callback
                );
        };
    }


    /* ==========================================================
     * EMIT STATE
     * ========================================================== */

    emit() {

        this.updateGlobalState();

        this.updateDashboard();

        const state =
            this.getState();

        for (
            const listener of
            [...this.listeners]
        ) {

            try {

                listener(state);

            } catch (error) {

                console.warn(
                    "Engine listener error:",
                    error
                );
            }
        }
    }


    /* ==========================================================
     * FULL ENGINE STATE
     * ========================================================== */

    getState() {

        const active =
            this.getMarketState(
                this.activeMarket
            );

        return {

            started:
                this.started,

            paused:
                this.paused,

            activeMarket:
                this.activeMarket,

            supportedMarkets:
                [
                    ...this.config.markets
                ],

            marketCount:
                this.config.markets.length,

            config:
                {
                    ...this.config
                },

            analysis:
                this.clone(
                    this.analysis
                ),

            activeMarketState:
                active,

            markets:
                this.getAllMarketStates(),

            modules:
                Object.keys(
                    this.modules
                ).filter(
                    name =>
                        !!this.modules[name]
                ),

            availableAnalysisModules:
                this.countAnalysisModules(),

            lastError:
                this.lastError
        };
    }


    /* ==========================================================
     * SIMPLE CLONE
     * ========================================================== */

    clone(value) {

        try {

            return JSON.parse(
                JSON.stringify(
                    value
                )
            );

        } catch (error) {

            return value;
        }
    }


    /* ==========================================================
     * MARKET INFORMATION
     * ========================================================== */

    getMarketInfo(
        market = this.activeMarket
    ) {

        const memory =
            this.marketMemories[market];

        if (!memory) {

            return {

                market,

                exists: false
            };
        }

        const digits =
            memory.digits;

        const total =
            digits.length;

        let lastFive = [];

        if (total) {

            lastFive =
                digits.slice(-5);
        }

        return {

            market,

            exists: true,

            tickCount:
                total,

            lastDigit:
                total
                    ? digits[total - 1]
                    : null,

            lastFive,

            frequencies:
                [
                    ...memory.frequencies
                ],

            percentages:
                this.getDigitPercentages(
                    market
                ),

            confidence:
                memory.analysis.confidence,

            prediction:
                memory.analysis.prediction,

            signal:
                memory.analysis.signal,

            decision:
                memory.analysis.decision
        };
    }


    /* ==========================================================
     * GET STRONGEST DIGITS
     * ========================================================== */

    getStrongestDigits(
        market = this.activeMarket,
        count = 3
    ) {

        const percentages =
            this.getDigitPercentages(
                market
            );

        return percentages
            .map(
                (percentage, digit) => ({
                    digit,
                    percentage
                })
            )
            .sort(
                (a, b) =>
                    b.percentage -
                    a.percentage
            )
            .slice(
                0,
                Math.max(
                    1,
                    Math.floor(
                        this.number(
                            count,
                            3
                        )
                    )
                )
            );
    }


    /* ==========================================================
     * GET LEAST FREQUENT DIGITS
     * ========================================================== */

    getLeastFrequentDigits(
        market = this.activeMarket,
        count = 3
    ) {

        const percentages =
            this.getDigitPercentages(
                market
            );

        return percentages
            .map(
                (percentage, digit) => ({
                    digit,
                    percentage
                })
            )
            .sort(
                (a, b) =>
                    a.percentage -
                    b.percentage
            )
            .slice(
                0,
                Math.max(
                    1,
                    Math.floor(
                        this.number(
                            count,
                            3
                        )
                    )
                )
            );
    }


    /* ==========================================================
     * CHECK MARKET READINESS
     * ========================================================== */

    isMarketReady(
        market = this.activeMarket
    ) {

        const memory =
            this.marketMemories[market];

        if (!memory) {
            return false;
        }

        if (
            memory.digits.length <
            this.config.minimumAnalysisTicks
        ) {
            return false;
        }

        const lastTick =
            memory.ticks[
                memory.ticks.length - 1
            ];

        if (!lastTick) {
            return false;
        }

        const age =
            Date.now() -
            lastTick.receivedAt;

        if (
            age >
            this.config.maximumStaleMs
        ) {
            return false;
        }

        return true;
    }


    /* ==========================================================
     * MARKET READINESS REPORT
     * ========================================================== */

    getReadiness(
        market = this.activeMarket
    ) {

        const memory =
            this.marketMemories[market];

        if (!memory) {

            return {

                ready: false,

                reason:
                    "Market not found"
            };
        }

        const count =
            memory.digits.length;

        if (
            count <
            this.config.minimumAnalysisTicks
        ) {

            return {

                ready: false,

                reason:
                    "Not enough ticks",

                ticks:
                    count,

                required:
                    this.config.minimumAnalysisTicks
            };
        }

        const lastTick =
            memory.ticks[
                memory.ticks.length - 1
            ];

        if (!lastTick) {

            return {

                ready: false,

                reason:
                    "No recent tick"
            };
        }

        const age =
            Date.now() -
            lastTick.receivedAt;

        if (
            age >
            this.config.maximumStaleMs
        ) {

            return {

                ready: false,

                reason:
                    "Tick stream appears stale",

                age
            };
        }

        return {

            ready: true,

            reason:
                "Market ready",

            ticks:
                count,

            lastDigit:
                lastTick.digit,

            age
        };
    }


    /* ==========================================================
     * ANALYSIS SUMMARY
     * ========================================================== */

    getAnalysisSummary(
        market = this.activeMarket
    ) {

        const state =
            this.getMarketState(
                market
            );

        if (!state) {
            return null;
        }

        const results =
            state.analysis.results ||
            {};

        return {

            market,

            status:
                this.isMarketReady(
                    market
                )
                    ? "READY"
                    : "WAIT",

            tickCount:
                state.tickCount,

            lastDigit:
                state.lastDigit,

            prediction:
                state.prediction,

            confidence:
                state.confidence,

            probability:
                state.probability,

            moduleAgreement:
                state.modulesAgreeing,

            signal:
                state.signal,

            decision:
                state.decision,

            recommendation:
                state.recommendation,

            modules: {

                patterns:
                    this.moduleScore(
                        results.patterns
                    ),

                probability:
                    this.moduleScore(
                        results.probability
                    ),

                statistics:
                    this.moduleScore(
                        results.statistics
                    ),

                transition:
                    this.moduleScore(
                        results.transition
                    ),

                markov:
                    this.moduleScore(
                        results.markov
                    ),

                cycle:
                    this.moduleScore(
                        results.cycle
                    )
            }
        };
    }


    /* ==========================================================
     * CHECK WHETHER ANALYSIS IS APPROVED
     * ========================================================== */

    isApproved(
        market = this.activeMarket
    ) {

        const state =
            this.getMarketState(
                market
            );

        if (!state) {
            return false;
        }

        return (

            state.decision ===
            "TRADE" &&

            state.signal ===
            "TRADE" &&

            state.confidence >=
            this.config.tradeConfidence &&

            state.modulesAgreeing >=
            50 &&

            this.isMarketReady(
                market
            )
        );
    }


    /* ==========================================================
     * SAFE ANALYSIS SNAPSHOT
     * ========================================================== */

    getAnalysisSnapshot(
        market = this.activeMarket
    ) {

        const state =
            this.getMarketState(
                market
            );

        if (!state) {
            return null;
        }

        return {

            timestamp:
                Date.now(),

            market,

            tickCount:
                state.tickCount,

            lastDigit:
                state.lastDigit,

            prediction:
                state.prediction,

            confidence:
                state.confidence,

            probability:
                state.probability,

            signal:
                state.signal,

            decision:
                state.decision,

            recommendation:
                state.recommendation,

            modulesAgreeing:
                state.modulesAgreeing,

            activeModules:
                state.activeModules,

            approved:
                this.isApproved(
                    market
                )
        };
    }
        /* ==========================================================
     * EXPORT MARKET DATA
     * ========================================================== */

    exportMarketData(
        market = this.activeMarket
    ) {

        const memory =
            this.marketMemories[market];

        if (!memory) {
            return null;
        }

        return {

            market,

            ticks:
                this.clone(
                    memory.ticks
                ),

            digits:
                [
                    ...memory.digits
                ],

            frequencies:
                [
                    ...memory.frequencies
                ],

            analysis:
                this.clone(
                    memory.analysis
                ),

            exportedAt:
                Date.now()
        };
    }


    /* ==========================================================
     * IMPORT MARKET DIGITS
     *
     * Used only when historical data is intentionally supplied.
     * ========================================================== */

    importDigits(
        market,
        digits
    ) {

        if (
            !Array.isArray(digits)
        ) {

            return {

                success: false,

                reason:
                    "Digits must be an array"
            };
        }

        this.ensureMarket(market);

        const memory =
            this.marketMemories[market];

        for (
            const value of
            digits
        ) {

            const digit =
                Number(value);

            if (
                Number.isInteger(digit) &&
                digit >= 0 &&
                digit <= 9
            ) {

                const tick = {

                    symbol: market,

                    market,

                    quote: null,

                    digit,

                    epoch: 0,

                    pipSize: null,

                    receivedAt:
                        Date.now()
                };

                this.storeTick(
                    market,
                    tick
                );
            }
        }

        return {

            success: true,

            market,

            tickCount:
                memory.digits.length
        };
    }


    /* ==========================================================
     * CLEAR LISTENERS
     * ========================================================== */

    clearListeners() {

        this.listeners = [];

        return true;
    }


    /* ==========================================================
     * ENGINE HEALTH
     * ========================================================== */

    getHealth() {

        const analysisModules = [

            "patterns",

            "probability",

            "statistics",

            "transition",

            "markov",

            "cycle"
        ];

        const available =
            analysisModules.filter(
                name =>
                    this.modules[name] &&
                    typeof this.modules[name].analyze ===
                    "function"
            );

        const unavailable =
            analysisModules.filter(
                name =>
                    !available.includes(
                        name
                    )
            );

        return {

            healthy:
                available.length >= 3,

            started:
                this.started,

            paused:
                this.paused,

            activeMarket:
                this.activeMarket,

            analysisModules:
                available.length,

            availableModules:
                available,

            unavailableModules:
                unavailable,

            markets:
                this.config.markets.length,

            lastError:
                this.lastError
        };
    }


    /* ==========================================================
     * CONFIGURATION
     * ========================================================== */

    getConfig() {

        return {
            ...this.config,

            markets:
                [
                    ...this.config.markets
                ]
        };
    }


    /* ==========================================================
     * UPDATE CONFIGURATION SAFELY
     * ========================================================== */

    updateConfig(options = {}) {

        if (
            options.maxTicks !==
            undefined
        ) {

            this.config.maxTicks =
                Math.max(
                    100,
                    this.number(
                        options.maxTicks,
                        this.config.maxTicks
                    )
                );
        }

        if (
            options.analysisWindow !==
            undefined
        ) {

            this.config.analysisWindow =
                Math.max(
                    10,
                    this.number(
                        options.analysisWindow,
                        this.config.analysisWindow
                    )
                );
        }

        if (
            options.minimumAnalysisTicks !==
            undefined
        ) {

            this.config.minimumAnalysisTicks =
                Math.max(
                    10,
                    this.number(
                        options.minimumAnalysisTicks,
                        this.config.minimumAnalysisTicks
                    )
                );
        }

        if (
            options.tradeConfidence !==
            undefined
        ) {

            this.config.tradeConfidence =
                Math.max(
                    0,
                    Math.min(
                        100,
                        this.number(
                            options.tradeConfidence,
                            this.config.tradeConfidence
                        )
                    )
                );
        }

        if (
            options.minimumModuleScore !==
            undefined
        ) {

            this.config.minimumModuleScore =
                Math.max(
                    0,
                    Math.min(
                        100,
                        this.number(
                            options.minimumModuleScore,
                            this.config.minimumModuleScore
                        )
                    )
                );
        }

        this.emit();

        return this.getConfig();
    }


    /* ==========================================================
     * SHUTDOWN
     * ========================================================== */

    shutdown() {

        this.paused = true;

        this.started = false;

        this.analysis.status =
            "Stopped";

        this.emit();

        return true;
    }


    /* ==========================================================
     * RESTART
     * ========================================================== */

    restart() {

        this.shutdown();

        this.started = false;

        this.paused = false;

        return this.initialize();
    }
}


/* ==============================================================
 * GLOBAL ENGINE
 * ============================================================== */

if (
    typeof window !==
    "undefined"
) {

    window.AnalysisEngine =
        AnalysisEngine;

    /*
     * Reuse an existing engine only if it is already
     * compatible with this class. Otherwise create a fresh one.
     */

    window.engine =
        new AnalysisEngine();


    /* ==========================================================
     * INITIALIZE
     * ========================================================== */

    try {

        window.engine.initialize();

    } catch (error) {

        console.error(
            "AnalysisEngine initialization failed:",
            error
        );
    }


    /* ==========================================================
     * OPTIONAL GLOBAL HELPERS
     * ============================================================== */

    window.getAnalysisState =
        function () {

            return window.engine
                ? window.engine.getState()
                : null;
        };


    window.getActiveMarketAnalysis =
        function () {

            return window.engine
                ? window.engine.getAnalysisSummary()
                : null;
        };


    window.setAnalysisMarket =
        function (market) {

            return window.engine
                ? window.engine.setMarket(
                    market
                )
                : null;
        };


    window.pauseAnalysis =
        function () {

            return window.engine
                ? window.engine.pause()
                : null;
        };


    window.resumeAnalysis =
        function () {

            return window.engine
                ? window.engine.resume()
                : null;
        };


    window.resetAnalysis =
        function () {

            return window.engine
                ? window.engine.reset()
                : null;
        };
}


/* ==============================================================
 * NODE / NON-BROWSER EXPORT
 * ============================================================== */

if (
    typeof module !==
    "undefined" &&
    module.exports
) {

    module.exports =
        AnalysisEngine;
}