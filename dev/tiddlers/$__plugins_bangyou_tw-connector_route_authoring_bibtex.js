/*\
title: $:/plugins/bangyou/tw-connector/route/authoring/bibtex.js
type: application/javascript
module-type: route

GET /^\/literature/reference\/(.+)$/

Get reference list for a tiddler

\*/
(function () {

	/*jslint node: true, browser: true */
	/*global $tw: false */
	"use strict";
	var authoring = require("$:/plugins/bangyou/tw-connector/api/authoring.js").Authoring();

	exports.method = "GET";
	exports.platforms = ["node"];
	exports.path = /^\/authoring\/bibtex\/(.+)$/;

	exports.handler = function (request, response, state) {

		try {
			const entry = decodeURIComponent(state.params[0]);
			if (!entry || entry.length === 0) {
				response.writeHead(400, { "Content-Type": "text/plain" });
				response.end("Invalid entry provided");
				console.log("Invalid entry provided");
				return;
			}
			authoring.bibtex(entry).then((data) => {
				response.writeHead(200, { "Content-Type": "application/json" });
				response.end(JSON.stringify(data));
			}).catch((err) => {
				console.error("Error fetching authors:", err);
				response.writeHead(500, { "Content-Type": "text/plain" });
				response.end("Error fetching authors");
			});
		} catch (err) {
			console.error("Error processing request:", err.message);
			response.writeHead(400);
			response.end("Error processing request: " + err.message);
		}
	};

}());
