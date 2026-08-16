/*
 * ============================================================
 * GTRADER-ME DERIV CONNECTION
 * ============================================================
 *
 * PURPOSE:
 * - Connect to Deriv WebSocket
 * - Subscribe to live ticks
 * - Convert Deriv tick data into the format expected by
 *   AnalysisEngine
 * - Forward every valid tick to the analysis engine
 *
 * IMPORTANT:
 * - This file does NOT make trading decisions.
 * - This file does NOT place trades.
 * - AnalysisEngine handles analysis.
 * ============================================================
 */

class DerivConnector {

    constructor(options = {}) {

        this.appId =
            options.appId ||
            "";

        this.token =
            options.token ||
            "";

        this.websocket =
            null;

        this.connected =
            false;

        this.authorized =
            false;

        this.subscriptions =
            {};

        this.listeners =
            [];

        this.lastError =
            null;

        this.activeMarket =
            options.market ||
            "R_100";

        this.reconnectAttempts =
            0;

        this.maxReconnectAttempts =
            10;

        this.reconnectDelay =
            2000;
    }


    /* ==========================================================
     * CONNECT
     * ========================================================== */

    connect() {

        if (!this.appId) {

            console.warn(
                "Deriv app ID is missing."
            );

            return false;
        }

        if (this.websocket) {

            try {
                this.websocket.close();
            } catch (error) {}
        }

        try {

            this.websocket =
                new WebSocket(
                    `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(this.appId)}`
                );

        } catch (error) {

            this.handleError(error);

            return false;
        }


        this.websocket.onopen = () => {

            this.connected =
                true;

            this.reconnectAttempts =
                0;

            this.emit({
                type: "connected"
            });

            if (this.token) {
                this.authorize();
            } else {
                this.emit({
                    type: "ready"
                });
            }
        };


        this.websocket.onmessage =
            event => {

                this.handleMessage(
                    event.data
                );
            };


        this.websocket.onerror =
            error => {

                this.handleError(
                    error
                );
            };


        this.websocket.onclose =
            () => {

                this.connected =
                    false;

                this.authorized =
                    false;

                this.emit({
                    type: "disconnected"
                });

                this.scheduleReconnect();
            };


        return true;
    }


    /* ==========================================================
     * AUTHORIZE
     * ========================================================== */

    authorize() {

        if (!this.connected) {
            return false;
        }

        this.send({
            authorize:
                this.token
        });

        return true;
    }


    /* ==========================================================
     * SUBSCRIBE TO MARKET
     * ========================================================== */

    subscribeMarket(
        symbol
    ) {

        if (!symbol) {
            return false;
        }

        if (!this.connected) {

            this.activeMarket =
                symbol;

            return false;
        }

        const request = {

            ticks:
                symbol,

            subscribe:
                1
        };

        const sent =
            this.send(
                request
            );

        if (sent) {

            this.subscriptions[
                symbol
            ] = true;

            this.activeMarket =
                symbol;
        }

        return sent;
    }


    /* ==========================================================
     * UNSUBSCRIBE
     * ========================================================== */

    unsubscribe(
        symbol
    ) {

        if (!symbol) {
            return false;
        }

        const subscription =
            this.subscriptions[
                symbol
            ];

        if (!subscription) {
            return false;
        }

        if (
            typeof subscription ===
            "object" &&
            subscription.id
        ) {

            this.send({
                forget:
                    subscription.id
            });

        }

        delete this.subscriptions[
            symbol
        ];

        return true;
    }


    /* ==========================================================
     * SEND REQUEST
     * ========================================================== */

    send(
        request
    ) {

        if (
            !this.websocket ||
            this.websocket.readyState !==
            WebSocket.OPEN
        ) {

            return false;
        }

        try {

            this.websocket.send(
                JSON.stringify(
                    request
                )
            );

            return true;

        } catch (error) {

            this.handleError(
                error
            );

            return false;
        }
    }


    /* ==========================================================
     * HANDLE MESSAGE
     * ========================================================== */

    handleMessage(
        raw
    ) {

        let message;

        try {

            message =
                typeof raw ===
                "string"
                    ? JSON.parse(raw)
                    : raw;

        } catch (error) {

            this.handleError(
                error
            );

            return;
        }

        if (!message) {
            return;
        }


        /* ------------------------------------------------------
         * AUTHORIZATION
         * ------------------------------------------------------ */

        if (
            message.msg_type ===
            "authorize"
        ) {

            if (message.error) {

                this.authorized =
                    false;

                this.lastError =
                    message.error.message ||
                    "Authorization failed";

                this.emit({
                    type: "authorization_error",
                    error: message.error
                });

                return;
            }

            this.authorized =
                true;

            this.emit({
                type: "authorized",
                data: message.authorize
            });

            return;
        }


        /* ------------------------------------------------------
         * TICK
         * ------------------------------------------------------ */

        if (
            message.msg_type ===
            "tick"
        ) {

            this.handleTick(
                message.tick
            );

            return;
        }


        /* ------------------------------------------------------
         * ERROR
         * ------------------------------------------------------ */

        if (message.error) {

            this.lastError =
                message.error.message ||
                "Deriv API error";

            this.emit({
                type: "api_error",
                error: message.error
            });

            return;
        }


        this.emit({
            type: "message",
            data: message
        });
    }


    /* ==========================================================
     * HANDLE TICK
     * ========================================================== */

    handleTick(
        tick
    ) {

        if (!tick) {
            return;
        }

        const quote =
            Number(
                tick.quote
            );

        if (
            !Number.isFinite(
                quote
            )
        ) {

            return;
        }


        const symbol =
            tick.symbol ||
            this.activeMarket;


        const pipSize =
            this.extractPipSize(
                tick
            );


        const digit =
            this.extractLastDigit(
                quote,
                pipSize
            );


        const normalizedTick = {

            symbol,

            market:
                symbol,

            quote,

            price:
                quote,

            value:
                quote,

            digit,

            epoch:
                Number(
                    tick.epoch ||
                    0
                ),

            pip_size:
                pipSize,

            pipSize,

            receivedAt:
                Date.now(),

            raw:
                tick
        };


        /*
         * Forward the normalized tick
         * directly to AnalysisEngine.
         */

        if (
            window.engine &&
            typeof window.engine.receiveTick ===
            "function"
        ) {

            try {

                window.engine.receiveTick(
                    normalizedTick
                );

            } catch (error) {

                console.warn(
                    "AnalysisEngine tick error:",
                    error
                );
            }
        }


        this.emit({
            type:
                "tick",

            data:
                normalizedTick
        });
    }


    /* ==========================================================
     * EXTRACT PIP SIZE
     * ========================================================== */

    extractPipSize(
        tick
    ) {

        const candidates = [

            tick.pip_size,

            tick.pipSize,

            tick.pip,

            tick.display_value
        ];


        for (
            const value of
            candidates
        ) {

            const number =
                Number(
                    value
                );

            if (
                Number.isFinite(
                    number
                ) &&
                number > 0 &&
                number < 1
            ) {

                return number;
            }
        }


        /*
         * Deriv normally supplies
         * pip_size in tick responses.
         *
         * If unavailable, return null
         * and let AnalysisEngine handle
         * digit extraction.
         */

        return null;
    }


    /* ==========================================================
     * EXTRACT LAST DIGIT
     * ========================================================== */

    extractLastDigit(
        quote,
        pipSize
    ) {

        if (
            Number.isFinite(
                Number(pipSize)
            ) &&
            Number(pipSize) > 0 &&
            Number(pipSize) < 1
        ) {

            const decimals =
                Math.max(
                    0,
                    Math.round(
                        -Math.log10(
                            Number(pipSize)
                        )
                    )
                );


            if (decimals > 0) {

                const formatted =
                    Number(
                        quote
                    ).toFixed(
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
            String(
                quote
            );


        const digits =
            text.replace(
                /\D/g,
                ""
            );


        if (
            !digits.length
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
     * CHANGE MARKET
     * ========================================================== */

    setMarket(
        symbol
    ) {

        if (!symbol) {
            return false;
        }

        if (
            symbol ===
            this.activeMarket
        ) {

            return true;
        }


        this.unsubscribe(
            this.activeMarket
        );


        this.activeMarket =
            symbol;


        return this.subscribeMarket(
            symbol
        );
    }


    /* ==========================================================
     * EVENT LISTENER
     * ========================================================== */

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


    /* ==========================================================
     * EMIT
     * ========================================================== */

    emit(
        event
    ) {

        for (
            const listener of
            this.listeners
        ) {

            try {

                listener(
                    event
                );

            } catch (error) {

                console.warn(
                    "Deriv listener error:",
                    error
                );
            }
        }
    }


    /* ==========================================================
     * ERROR HANDLER
     * ========================================================== */

    handleError(
        error
    ) {

        this.lastError =
            error?.message ||
            String(error);


        console.warn(
            "Deriv connection error:",
            error
        );


        this.emit({
            type:
                "error",

            error:
                this.lastError
        });
    }


    /* ==========================================================
     * RECONNECT
     * ========================================================== */

    scheduleReconnect() {

        if (
            this.reconnectAttempts >=
            this.maxReconnectAttempts
        ) {

            return;
        }


        this.reconnectAttempts++;


        const delay =
            this.reconnectDelay *
            Math.min(
                this.reconnectAttempts,
                5
            );


        setTimeout(
            () => {

                if (
                    !this.connected
                ) {

                    this.connect();

                    setTimeout(
                        () => {

                            if (
                                this.connected &&
                                this.activeMarket
                            ) {

                                this.subscribeMarket(
                                    this.activeMarket
                                );
                            }

                        },
                        1000
                    );
                }

            },
            delay
        );
    }


    /* ==========================================================
     * DISCONNECT
     * ========================================================== */

    disconnect() {

        this.reconnectAttempts =
            this.maxReconnectAttempts;


        if (this.websocket) {

            try {

                this.websocket.close();

            } catch (error) {}
        }


        this.websocket =
            null;

        this.connected =
            false;

        this.authorized =
            false;
    }


    /* ==========================================================
     * STATUS
     * ========================================================== */

    getState() {

        return {

            connected:
                this.connected,

            authorized:
                this.authorized,

            activeMarket:
                this.activeMarket,

            subscriptions:
                {
                    ...this.subscriptions
                },

            reconnectAttempts:
                this.reconnectAttempts,

            lastError:
                this.lastError
        };
    }
}


/* ==============================================================
 * GLOBAL DERIV CONNECTOR
 * ============================================================== */

window.DerivConnector =
    DerivConnector;
