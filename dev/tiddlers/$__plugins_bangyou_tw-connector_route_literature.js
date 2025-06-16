/*\
title: $:/plugins/bangyou/tw-connector/route/literature.js
type: application/javascript
module-type: route

POST /^\/liberature$/

Create a new tiddler with the bibtex entry
\*/
(function () {
	/*jslint node: true, browser: true */
	/*global $tw: false */
	"use strict";

	var authoring = require("$:/plugins/bangyou/tw-connector/api/authoring.js").Authoring();

	exports.method = "POST";
	exports.platforms = ["node"];
	exports.path = /^\/literature$/; // Endpoint path regex

	exports.handler = function (request, response, state) {

		try {
			const bibtex = state.data;
			if (!bibtex || typeof bibtex !== 'string' || bibtex.trim() === "") {
				response.writeHead(400, { "Content-Type": "application/json" });
				response.end(JSON.stringify({ error: "Invalid BibTeX data" }));
				console.log("Invalid BibTeX data received");
				return;
			}
			// Check if the tiddler already exists
			if (!$tw.wiki.tiddlerExists("$:/plugins/tiddlywiki/bibtex")) {
				response.writeHead(400, { "Content-Type": "application/json" });
				response.end(JSON.stringify({ error: "$:/plugins/tiddlywiki/bibtex tiddler does not exist" }));
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
				response.end(JSON.stringify({ error: "Failed to parse BibTeX data" }));
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
				console.log(newTiddler);
				$tw.wiki.addTiddler(new $tw.Tiddler(newTiddler));
				results.push(newTiddler);
			}

			response.writeHead(200, { "Content-Type": "application/json" });
			response.end(JSON.stringify({
				"status": "success",
				"message": "New tiddler created from BibTeX",
				"tiddlers": results
			}));
			return;

		} catch (err) {
			console.error("Error creating new tiddler from bibtex", err);
			response.writeHead(400);
			response.end("Error create new tiddler from bibtex: " + err.message);
			
		}

	};

}());
