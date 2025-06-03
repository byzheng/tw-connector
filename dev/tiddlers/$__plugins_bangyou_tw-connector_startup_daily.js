/*\
title: $:/plugins/bangyou/tw-connector/startup/daily.js
type: application/javascript
module-type: startup
\*/

"use strict";

exports.name = "cron-literature-updating";
exports.platforms = ["node"];
exports.after = ["startup"];
exports.synchronous = true;

exports.startup = function () {

    // Schedule the task to run daily at 11:00 AM
    setInterval(() => {
        console.log("Checking if it's time to run the daily job...");
        const now = new Date();
        if (now.getMinutes() === 0 && now.getHours() === 11) {
            console.log("⏰ Running daily 11 AM job at", now.toLocaleString());
        }
    }, 60 * 1000); // check every minute

};
