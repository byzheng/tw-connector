/*\
title: $:/plugins/bangyou/tw-connector/route/literature/latest.js
type: application/javascript
module-type: route
\*/

/**
 * TiddlyWiki Route: POST /^\/literatures$/
 * 
 * Creates new tiddler(s) from a provided BibTeX entries.
 * 
 * Request:
 *   - Method: POST
 *   - Path: /literatures
 *   - Body: Raw BibTeX string (in state.data)
 * 
 * Response:
 *   - 200: On success, returns JSON with status "success", created tiddlers.
 *   - 400: On error, returns JSON with status "error" and error message.
 * 
 * Workflow:
 *   1. Validates that the request contains a non-empty BibTeX string.
 *   2. Checks if the BibTeX plugin tiddler ($:/plugins/tiddlywiki/bibtex) exists.
 *   3. Deserializes the BibTeX string into tiddler objects.
 *   4. For each new tiddler:
 *      - Skips if title is missing or already exists.
 *      - Adds "bibtex-entry" tag and author tags (if DOI is present).
 *      - Sets created/modified timestamps and attaches pdf_key from request.
 *      - Adds the tiddler to the wiki.
 *   5. Returns the created tiddlers in the response.
 * 
 * Error Handling:
 *   - Returns 400 if BibTeX data is invalid, plugin tiddler is missing, or parsing fails.
 *   - Returns 400 with error message if an exception occurs.
 * 
 * Dependencies:
 *   - $:/plugins/bangyou/tw-connector/api/authoring.js (for author tag extraction)
 *   - $:/plugins/tiddlywiki/bibtex (for BibTeX deserialization)
 * 
 * @module $:/plugins/bangyou/tw-connector/route/literature.js
 * @method POST
 * @route /^\/literatures$/
 * @platforms ["node"]
 * @param {Object} request - HTTP request object
 * @param {Object} response - HTTP response object
 * @param {Object} state - State object containing request data (state.data: BibTeX string)
 * @returns {void}
 */

(function () {
	/*jslint node: true, browser: true */
	/*global $tw: false */
	"use strict";

	var authoring = require("$:/plugins/bangyou/tw-connector/api/authoring.js").Authoring();

	exports.method = "GET";
	exports.platforms = ["node"];
	exports.path = /^\/literatures\/latest$/;

	exports.handler = function (request, response, state) {
		try {
			// Check if queryParameters exists and has days parameter
			let days = 60; // default value
			if (state && state.queryParameters && state.queryParameters.days) {
				const parsedDays = parseInt(state.queryParameters.days);
				if (!isNaN(parsedDays) && parsedDays > 0) {
					days = parsedDays;
				}
			}
			const results = authoring.getLatest(days);
			response.writeHead(200, { "Content-Type": "application/json" });
			response.end(JSON.stringify({
				"status": "success",
				"code": 200,
				"message": "Latest literatures retrieved successfully for past " + days + " days",
				"tiddlers": results
			}));
			return;

		} catch (err) {
			console.error("Error retrieving latest literatures", err);
			response.writeHead(400);
			response.end(JSON.stringify({
				"status": "error",
				"message": "Error retrieving latest literatures: " + err.message,
				"code": 400
			}));
			return
		}

	};

}());
