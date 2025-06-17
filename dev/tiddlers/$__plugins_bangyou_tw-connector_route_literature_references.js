const https = require("https");

/*\
title: $:/plugins/bangyou/tw-connector/route/literature/reference.js
type: application/javascript
module-type: route

GET /^\/literature/reference\/(.+)$/

Get reference list for a tiddler

\*/
(function () {

	/*jslint node: true, browser: true */
	/*global $tw: false */
	"use strict";
	if ($tw.node) {
		var openalex = require("$:/plugins/bangyou/tw-connector/api/openalex.js");
	}
	exports.method = "GET";
	exports.platforms = ["node"];
	exports.path = /^\/literature\/([^/]+)\/references$/;

	exports.handler = function (request, response, state) {

		try {
			const doi = state.params[0];
			const decodedDoi = decodeURIComponent(doi);
			if (!decodedDoi || decodedDoi.length === 0) {
				response.writeHead(400, { "Content-Type": "application/json" });
				response.end(JSON.stringify({
					"status": "error",
					"code": 400,
					"message": "Invalid DOI provided"
				}));
				console.log("Invalid DOI provided");
				return;
			}
			const openalexAPI = new openalex.OpenAlex();
			openalexAPI.references(doi).then((data) => {
				response.writeHead(200, { "Content-Type": "application/json" });
				response.end(JSON.stringify({
					"status": "success",
					"code": 200,
					"message": "References fetched successfully",
					"data": data
				}));
			}).catch((err) => {
				console.error("Error fetching references:", err);
				response.writeHead(400, { "Content-Type": "application/json" });
				response.end(JSON.stringify({
					"status": "error",
					"code": 400,
					"message": "Error fetching references"
				}));
			});
			
			// response.writeHead(200, { "Content-Type": "application/json" });
			// response.end(JSON.stringify({ "a": "b" }));
		} catch (err) {
			console.error("Error processing request:", err);
			response.writeHead(400, { "Content-Type": "application/json" });
			response.end(JSON.stringify({
				"status": "error",
				"code": 400,
				"message": "Error processing request: " + err.message
			}));
		}
	};

}());
