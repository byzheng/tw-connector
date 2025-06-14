/*\
title: $:/plugins/bangyou/tw-connector/route/test/wos.js
type: application/javascript
module-type: route

GET /^\/literature/reference\/(.+)$/

Get reference list for a tiddler

\*/
(function () {

	/*jslint node: true, browser: true */
	/*global $tw: false */
	"use strict";
	var wos = require("$:/plugins/bangyou/tw-connector/api/wos.js").WOS();

	exports.method = "GET";
	exports.platforms = ["node"];
	exports.path = /^\/test\/wos\/(.+)$/;

	exports.handler = function (request, response, state) {

		try {
			const researcherid = decodeURIComponent(state.params[0]);
			if (!researcherid || researcherid.length === 0) {
				response.writeHead(400, { "Content-Type": "text/plain" });
				response.end("Invalid researcherid provided");
				console.log("Invalid researcherid provided");
				return;
			}
			wos.works(researcherid).then((data) => {
				response.writeHead(200, { "Content-Type": "application/json" });
				response.end(JSON.stringify(data));
			}).catch((err) => {
				console.error("Error fetching works:", err);
				response.writeHead(500, { "Content-Type": "text/plain" });
				response.end("Error fetching works");
			});
		} catch (err) {
			console.error("Error processing request:", err.message);
			response.writeHead(400);
			response.end("Error processing request: " + err.message);
		}
	};

}());
