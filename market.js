/*
 * ============================================================
 * GTRADER-ME MARKETS CONFIGURATION
 * ============================================================
 */

(function (global) {
    "use strict";

    const DIGIT_MARKETS = [
        {
            symbol: "R_10",
            name: "Volatility 10 Index",
            shortName: "V10",
            family: "volatility",
            oneSecond: false,
            digits: true
        },
        {
            symbol: "R_25",
            name: "Volatility 25 Index",
            shortName: "V25",
            family: "volatility",
            oneSecond: false,
            digits: true
        },
        {
            symbol: "R_50",
            name: "Volatility 50 Index",
            shortName: "V50",
            family: "volatility",
            oneSecond: false,
            digits: true
        },
        {
            symbol: "R_75",
            name: "Volatility 75 Index",
            shortName: "V75",
            family: "volatility",
            oneSecond: false,
            digits: true
        },
        {
            symbol: "R_100",
            name: "Volatility 100 Index",
            shortName: "V100",
            family: "volatility",
            oneSecond: false,
            digits: true
        },
        {
            symbol: "1HZ10V",
            name: "Volatility 10 (1s) Index",
            shortName: "V10 1s",
            family: "volatility_1s",
            oneSecond: true,
            digits: true
        },
        {
            symbol: "1HZ25V",
            name: "Volatility 25 (1s) Index",
            shortName: "V25 1s",
            family: "volatility_1s",
            oneSecond: true,
            digits: true
        },
        {
            symbol: "1HZ50V",
            name: "Volatility 50 (1s) Index",
            shortName: "V50 1s",
            family: "volatility_1s",
            oneSecond: true,
            digits: true
        },
        {
            symbol: "1HZ75V",
            name: "Volatility 75 (1s) Index",
            shortName: "V75 1s",
            family: "volatility_1s",
            oneSecond: true,
            digits: true
        },
        {
            symbol: "1HZ100V",
            name: "Volatility 100 (1s) Index",
            shortName: "V100 1s",
            family: "volatility_1s",
            oneSecond: true,
            digits: true
        }
    ];

    const MARKET_MAP = {};

    for (const market of DIGIT_MARKETS) {
        MARKET_MAP[market.symbol] = market;
    }

    function getMarkets() {
        return DIGIT_MARKETS.map(
            market => ({ ...market })
        );
    }

    function getMarket(symbol) {
        if (!MARKET_MAP[symbol]) {
            return null;
        }

        return {
            ...MARKET_MAP[symbol]
        };
    }

    function getSymbols() {
        return DIGIT_MARKETS.map(
            market => market.symbol
        );
    }

    function isSupportedMarket(symbol) {
        return Boolean(
            MARKET_MAP[symbol]
        );
    }

    function getStandardMarkets() {
        return DIGIT_MARKETS.filter(
            market =>
                !market.oneSecond
        );
    }

    function getOneSecondMarkets() {
        return DIGIT_MARKETS.filter(
            market =>
                market.oneSecond
        );
    }

    function getDigitMarkets() {
        return DIGIT_MARKETS.filter(
            market =>
                market.digits
        );
    }

    function rankMarketForAnalysis(
        state = {}
    ) {
        const confidence =
            Number(state.confidence) || 0;

        const stability =
            Number(state.stability) || 0;

        const agreement =
            Number(state.agreement) || 0;

        const sampleSize =
            Number(state.sampleSize) || 0;

        return (
            confidence * 0.45 +
            stability * 0.20 +
            agreement * 0.20 +
            Math.min(
                sampleSize,
                200
            ) * 0.15
        );
    }

    function selectBestMarket(
        marketStates = {}
    ) {
        let bestMarket = null;
        let bestScore = -Infinity;

        for (
            const symbol of getSymbols()
        ) {
            const state =
                marketStates[symbol];

            if (!state) {
                continue;
            }

            const score =
                rankMarketForAnalysis(
                    state
                );

            if (
                score > bestScore
            ) {
                bestScore = score;
                bestMarket = symbol;
            }
        }

        return bestMarket;
    }

    const api = {
        DIGIT_MARKETS,
        getMarkets,
        getMarket,
        getSymbols,
        getStandardMarkets,
        getOneSecondMarkets,
        getDigitMarkets,
        isSupportedMarket,
        rankMarketForAnalysis,
        selectBestMarket
    };

    global.GTraderMarkets = api;

    if (
        typeof module !== "undefined" &&
        module.exports
    ) {
        module.exports = api;
    }

})(typeof window !== "undefined"
    ? window
    : globalThis);
