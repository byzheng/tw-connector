/*\
title: $:/plugins/bangyou/tw-connector/route/authors/cache.js
type: application/javascript
module-type: route

GET /^\/authoring/cache/update)$/

Get reference list for a tiddler

\*/
(function () {

	/*jslint node: true, browser: true */
	/*global $tw: false */
	"use strict";
	var authoring = require("$:/plugins/bangyou/tw-connector/api/authoring.js").Authoring();

	exports.method = "POST";
	exports.platforms = ["node"];
	exports.path = /^\/authoring\/cache\/update$/;

	exports.handler = function (request, response, state) {

		try {
			authoring.cacheUpdate().then((data) => {
				response.writeHead(200, { "Content-Type": "application/json" });
				response.end(JSON.stringify(data));
			}).catch((err) => {
				console.error("Error update cache: " + err.message);
				response.writeHead(500, { "Content-Type": "text/plain" });
				response.end("Error update cache: " + err.message);
			});
		} catch (err) {
			console.error("Error processing request:", err.message);
			response.writeHead(400);
			response.end("Error processing request: " + err.message);
		}
	};

}());
