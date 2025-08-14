/*\
title: $:/plugins/bangyou/tw-connector/route/literature.js
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

	exports.method = "POST";
	exports.platforms = ["node"];
	exports.path = /^\/literatures$/; // Endpoint path regex

	exports.handler = function (request, response, state) {

		try {
			const bibtex = state.data;
			if (!bibtex || typeof bibtex !== 'string' || bibtex.trim() === "") {
				response.writeHead(400, { "Content-Type": "application/json" });
				response.end(JSON.stringify({
					"status": "error",
					"message": "Invalid BibTeX data",
					"code": 400
				}));
				console.log("Invalid BibTeX data received");
				return;
			}
			// Check if the tiddler already exists
			if (!$tw.wiki.tiddlerExists("$:/plugins/tiddlywiki/bibtex")) {
				response.writeHead(400, { "Content-Type": "application/json" });
				response.end(JSON.stringify({
					"status": "error",
					"message": "$:/plugins/tiddlywiki/bibtex tiddler does not exist",
					"code": 400
				}));
				console.log("$:/plugins/tiddlywiki/bibtex tiddler does not exist");
				return;
			}
			// parse new tiddler from bibtex
			let newTiddlers = $tw.wiki.deserializeTiddlers(null,
				bibtex,
				{ title: "" },
				{ deserializer: "application/x-bibtex" }
			);
			if (!newTiddlers || newTiddlers.length === 0) {
				response.writeHead(400, { "Content-Type": "application/json" });
				response.end(JSON.stringify({
					"status": "error",
					"message": "Failed to parse BibTeX data",
					"code": 400
				}));
				console.log("Failed to parse BibTeX data");
				return;
			}
			let results = [];
			// Check if the tiddler has a title
			for (let newTiddler of newTiddlers) {
				if (!newTiddler.title || newTiddler.title.trim() === "") {
					continue;
				}
				if ($tw.wiki.tiddlerExists(newTiddler.title)) {
					continue;
				}

				let tags = ["bibtex-entry"];
				newTiddler["created"] = $tw.utils.formatDateString(new Date(), "[UTC]YYYY0MM0DD0hh0mm0ss0XXX");
				newTiddler["modified"] = newTiddler["created"];
				newTiddler["bibtex-zotero-pdf-key"] = request.pdf_key;
				
				if (newTiddler["bibtex-doi"] !== undefined) {
					const authors = authoring.getAuthorByDOI(newTiddler["bibtex-doi"]);
					tags = tags.concat(authors);
				}
				newTiddler["tags"] = tags;
				//console.log(newTiddler);
				$tw.wiki.addTiddler(new $tw.Tiddler(newTiddler));
				results.push(newTiddler);
			}

			response.writeHead(200, { "Content-Type": "application/json" });
			response.end(JSON.stringify({
				"status": "success",
				"code": 200,
				"message": "New tiddler created from BibTeX",
				"tiddlers": results
			}));
			return;

		} catch (err) {
			console.error("Error creating new tiddler from bibtex", err);
			response.writeHead(400);
			response.end(JSON.stringify({
				"status": "error",
				"message": "Error create new tiddler from bibtex: " + err.message,
				"code": 400
			}));
			return
		}

	};

}());
