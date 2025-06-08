const https = require("https");

/*\
title: $:/plugins/bangyou/tw-connector/route/literature/cites.js
type: application/javascript
module-type: route

GET /^\/literature/cites\/(.+)$/

Get reference list for a tiddler

\*/
(function () {

	/*jslint node: true, browser: true */
	/*global $tw: false */
	"use strict";
	var openalex = require("$:/plugins/bangyou/tw-connector/api/openalex.js").OpenAlex();
	exports.method = "GET";
	exports.platforms = ["node"];
	exports.path = /^\/literature\/cites\/(.+)$/;

	exports.handler = function (request, response, state) {

		try {
			const doi = state.params[0];
			openalex.cites(doi).then((data) => {
				response.writeHead(200, { "Content-Type": "application/json" });
				response.end(JSON.stringify(data));
			}).catch((err) => {
				console.error("Error fetching references:", err);
				response.writeHead(500, { "Content-Type": "text/plain" });
				response.end("Error fetching references");
			});
			
			// response.writeHead(200, { "Content-Type": "application/json" });
			// response.end(JSON.stringify({ "a": "b" }));
		} catch (err) {
			console.error("Error processing request:", err);
			response.writeHead(400);
			response.end("Error processing upload");
		}
	};

}());
