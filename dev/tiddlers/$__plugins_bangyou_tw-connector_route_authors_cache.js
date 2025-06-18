/*\
title: $:/plugins/bangyou/tw-connector/route/authors/cache.js
type: application/javascript
module-type: route

GET /^\/authoring\/cache$/

Get reference list for a tiddler

\*/
(function () {

	/*jslint node: true, browser: true */
	/*global $tw: false */
	"use strict";
	var authoring = require("$:/plugins/bangyou/tw-connector/api/authoring.js").Authoring();

	exports.method = "POST";
	exports.platforms = ["node"];
	exports.path = /^\/authors\/cache$/;

	exports.handler = function (request, response, state) {

		try {
			if (!authoring.isUpdating()) {
				authoring.startUpdate();
			}
			const progress = authoring.getUpdateProgress();
			const running = authoring.isUpdating();

			response.writeHead(200, { "Content-Type": "application/json" });
			response.end(JSON.stringify({
				status: running ? "in-progress" : (progress.finished ? "finished" : "idle"),
				code: 200,
				message: running
					? "Cache update in progress"
					: (progress.finished ? "Cache update finished" : "Cache update idle"),
				data: progress
			}));
			return;
		} catch (err) {
			console.error("Error processing request:", err.message);
			response.writeHead(500, { "Content-Type": "application/json" });
			response.end(JSON.stringify({
				status: "error",
				code: 500,
				message: "Error processing request: " + err.message
			}));
		}
	};

}());
