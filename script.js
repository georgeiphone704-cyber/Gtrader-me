/*
==================================================
GTRADER-ME MAIN STARTUP SCRIPT
==================================================
*/

document.addEventListener("DOMContentLoaded", () => {

    console.log("Starting GTRADER-ME...");

    /*
    ==============================================
    CHECK ENGINE
    ==============================================
    */

    if (!window.engine) {

        console.error("Engine not found");
        return;
    }

    console.log("Engine loaded");

    /*
    ==============================================
    CHECK DERIV FEED
    ==============================================
    */

    if (!window.derivFeed) {

        console.error("Deriv feed not found");
        return;
    }

    console.log("Deriv feed loaded");

    /*
    ==============================================
    CONNECT DERIV
    ==============================================
    */

    window.derivFeed.connect();

    /*
    ==============================================
    TICK LISTENER
    ==============================================
    */

    window.derivFeed.onTick((tick) => {

        if (window.engine) {

            window.engine.receiveTick(tick);

        }

    });

    /*
    ==============================================
    STATUS
    ==============================================
    */

    window.derivFeed.onStatus((status) => {

        console.log(
            "Deriv status:",
            status
        );

    });

    /*
    ==============================================
    ERRORS
    ==============================================
    */

    window.derivFeed.onError((error) => {

        console.error(
            "Deriv error:",
            error
        );

    });

});
