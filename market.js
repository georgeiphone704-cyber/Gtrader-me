/*
 * ============================================================
 * MARKET MANAGER
 * ============================================================
 * Handles the 10 supported Deriv volatility markets.
 * ============================================================
 */

class MarketManager {

    constructor() {

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

        this.activeMarket = "R_100";

        this.listeners = [];

        this.marketStates = {};

        this.initializeMarkets();

    }


    /*
     * ------------------------------------------------------------
     * INITIALIZE MARKETS
     * ------------------------------------------------------------
     */

    initializeMarkets() {

        for (
            const market of this.markets
        ) {

            this.marketStates[market] = {

                symbol: market,

                active: (
                    market ===
                    this.activeMarket
                ),

                ticks: 0,

                lastDigit: null,

                lastQuote: null,

                confidence: 0,

                probability: 0,

                prediction: null,

                signal: "WAIT",

                recommendation:
                    "Waiting"

            };

        }

    }


    /*
     * ------------------------------------------------------------
     * GET ALL MARKETS
     * ------------------------------------------------------------
     */

    getMarkets() {

        return [
            ...this.markets
        ];

    }


    /*
     * ------------------------------------------------------------
     * GET ACTIVE MARKET
     * ------------------------------------------------------------
     */

    getActiveMarket() {

        return this.activeMarket;

    }


    /*
     * ------------------------------------------------------------
     * CHANGE ACTIVE MARKET
     * ------------------------------------------------------------
     */

    setMarket(
        market
    ) {

        if (
            !this.markets.includes(
                market
            )
        ) {

            return {

                success: false,

                reason:
                    "Market not supported"

            };

        }


        /*
         * Remove active flag
         * from previous market.
         */

        for (
            const symbol of
            this.markets
        ) {

            this.marketStates[
                symbol
            ].active = false;

        }


        this.activeMarket =
            market;


        this.marketStates[
            market
        ].active = true;


        /*
         * Tell the engine.
         */

        if (
            window.engine &&
            typeof
            window.engine.setMarket ===
            "function"
        ) {

            window.engine.setMarket(
                market
            );

        }


        this.emit();


        return {

            success: true,

            market

        };

    }


    /*
     * ------------------------------------------------------------
     * UPDATE MARKET STATE
     * ------------------------------------------------------------
     */

    updateMarket(
        market,
        data
    ) {

        if (
            !this.marketStates[
                market
            ]
        ) {

            return false;

        }


        this.marketStates[
            market
        ] = {

            ...this.marketStates[
                market
            ],

            ...data,

            symbol:
                market

        };


        this.emit();


        return true;

    }


    /*
     * ------------------------------------------------------------
     * GET MARKET STATE
     * ------------------------------------------------------------
     */

    getMarketState(
        market
    ) {

        return this.marketStates[
            market
        ]
            ? {
                ...this.marketStates[
                    market
                ]
            }
            : null;

    }


    /*
     * ------------------------------------------------------------
     * GET ALL STATES
     * ------------------------------------------------------------
     */

    getAllMarketStates() {

        const result = {};


        for (
            const market of
            this.markets
        ) {

            result[market] =
                this.getMarketState(
                    market
                );

        }


        return result;

    }


    /*
     * ------------------------------------------------------------
     * TICK UPDATE
     * ------------------------------------------------------------
     */

    receiveTick(
        tick
    ) {

        if (
            !tick
        ) {

            return;

        }


        const market =
            tick.symbol ||
            tick.market;


        if (
            !market
        ) {

            return;

        }


        /*
         * Automatically register
         * a future market if needed.
         */

        if (
            !this.marketStates[
                market
            ]
        ) {

            this.markets.push(
                market
            );


            this.marketStates[
                market
            ] = {

                symbol: market,

                active: false,

                ticks: 0,

                lastDigit: null,

                lastQuote: null,

                confidence: 0,

                probability: 0,

                prediction: null,

                signal: "WAIT",

                recommendation:
                    "Waiting"

            };

        }


        const state =
            this.marketStates[
                market
            ];


        state.ticks++;

        state.lastQuote =
            tick.quote ??
            state.lastQuote;

        state.lastDigit =
            tick.digit ??
            state.lastDigit;


        this.emit();

    }


    /*
     * ------------------------------------------------------------
     * SYNC WITH ENGINE
     * ------------------------------------------------------------
     */

    syncWithEngine() {

        if (
            !window.engine ||
            typeof
            window.engine.getAllMarketStates !==
            "function"
        ) {

            return;

        }


        const engineStates =
            window.engine.getAllMarketStates();


        for (
            const market of
            Object.keys(
                engineStates
            )
        ) {

            const state =
                engineStates[
                    market
                ];


            this.updateMarket(
                market,
                {

                    ticks:
                        state.tickCount,

                    lastDigit:
                        state.lastDigit,

                    lastQuote:
                        state.currentTick,

                    confidence:
                        state.confidence,

                    probability:
                        state.probability,

                    prediction:
                        state.prediction,

                    signal:
                        state.signal,

                    recommendation:
                        state.recommendation

                }
            );

        }

    }


    /*
     * ------------------------------------------------------------
     * MARKET STATUS
     * ------------------------------------------------------------
     */

    getStatus(
        market
    ) {

        const state =
            this.marketStates[
                market
            ];


        if (!state) {

            return "UNKNOWN";

        }


        if (
            state.signal ===
            "TRADE"
        ) {

            return "TRADE";

        }


        if (
            state.ticks === 0
        ) {

            return "WAITING";

        }


        return "ANALYZING";

    }


    /*
     * ------------------------------------------------------------
     * LISTENER
     * ------------------------------------------------------------
     */

    onUpdate(
        callback
    ) {

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


    /*
     * ------------------------------------------------------------
     * EMIT
     * ------------------------------------------------------------
     */

    emit() {

        const state = {

            activeMarket:
                this.activeMarket,

            markets:
                this.getAllMarketStates()

        };


        for (
            const listener of
            this.listeners
        ) {

            try {

                listener(
                    state
                );

            } catch (error) {

                console.warn(
                    "Market listener error:",
                    error
                );

            }

        }

    }

}


/*
 * ============================================================
 * GLOBAL EXPORT
 * ============================================================
 */

window.MarketManager =
    MarketManager;


window.marketManager =
    new MarketManager();


/*
 * ============================================================
 * CONNECT DERIV TICKS
 * ============================================================
 */

if (
    window.derivFeed &&
    typeof
    window.derivFeed.onTick ===
    "function"
) {

    window.derivFeed.onTick(
        tick => {

            window.marketManager.receiveTick(
                tick
            );

        }
    );

}


/*
 * ============================================================
 * PERIODIC ENGINE SYNC
 * ============================================================
 */

setInterval(
    () => {

        if (
            window.marketManager
        ) {

            window.marketManager
                .syncWithEngine();

        }

    },
    500
);
