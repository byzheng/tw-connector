/*\
title: $:/plugins/bangyou/tw-connector/route/authoring/cache/update.js
type: application/javascript
module-type: route
\*/


/**
 * @module $:/plugins/bangyou/tw-connector/route/authoring/cache/update.js
 * @type {application/javascript}
 * @route POST /authors/cache
 * @platforms ["node"]
 * @description
 * Handles the POST request to update the authoring cache.
 * Invokes the `cacheUpdate` method from the Authoring API and returns the result as a JSON response.
 * 
 * @example
 * // Request
 * POST /authors/cache
 * 
 * // Successful Response
 * {
 *   "status": "success",
 *   "code": 200,
 *   "message": "Cache updated successfully",
 *   "data": { ... }
 * }
 * 
 * // Error Response
 * {
 *   "status": "error",
 *   "code": 400,
 *   "message": "Error update cache: <error message>"
 * }
 * 
 * @function
 * @param {IncomingMessage} request - The HTTP request object.
 * @param {ServerResponse} response - The HTTP response object.
 * @param {Object} state - The state object provided by TiddlyWiki server.
 * @returns {void}
 */


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
			authoring.cacheUpdate().then((data) => {
				response.writeHead(200, { "Content-Type": "application/json" });
				response.end(JSON.stringify({
					"status": "success",
					"code": 200,
					"message": "Cache updated successfully",
					"data": data
				}));
			}).catch((err) => {
				console.error("Error update cache: " + err.message);
				response.writeHead(400, { "Content-Type": "application/json" });
				response.end(JSON.stringify({
					"status": "error",
					"code": 400,
					"message": "Error update cache: " + err.message
				}));
			});
		} catch (err) {
			console.error("Error processing request:", err.message);
			response.writeHead(400, { "Content-Type": "application/json" });
			response.end(JSON.stringify({
				"status": "error",
				"code": 400,
				"message": "Error processing request: " + err.message
			}));
		}
	};

}());
