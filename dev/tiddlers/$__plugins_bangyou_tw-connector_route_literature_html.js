/*\
title: $:/plugins/bangyou/tw-connector/route/literature/html.js
type: application/javascript
module-type: route

POST /^\/liberature/html$/

Save HTML files from literature uploads
\*/
(function () {
	/*jslint node: true, browser: true */
	/*global $tw: false */
	"use strict";

	const fs = require('fs').promises; // Use promise-based fs API for async/await
	const path = require('path');
	const formidable = require('formidable'); // For parsing multipart form data (file uploads)
	const { JSDOM } = require("jsdom"); // For DOM parsing of HTML content

	// if ($tw.node) {
    //     var crossref = require("$:/plugins/bangyou/tw-connector/utils/crossref.js");
    // }

	exports.method = "POST";
	exports.platforms = ["node"];
	exports.path = /^\/literature\/html$/; // Endpoint path regex
	exports.bodyFormat = "stream"; // Incoming request body format

	exports.handler = function (request, response, state) {
		delete request.headers['Authorization']; // Remove auth header for security (optional)

		try {
			const form = new formidable.IncomingForm({ multiples: false }); // Initialize form parser, no multiple files allowed

			// Parse the incoming form data (fields and files)
			form.parse(request, async (err, fields, files) => {
				if (err) {
					// Respond with error if parsing form fails
					response.writeHead(500, { "Content-Type": "text/plain" });
					response.end("Error parsing form data");
					console.log("Error parsing form data", err);
					return;
				}

				// Check that the 'url' field exists in form data
				if (!(fields && fields.url)) {
					response.writeHead(400, { "Content-Type": "text/plain" });
					response.end("No field 'url' found in form data");
					console.log("No field 'url' found in form data");
					return;
				}

				// Get first file key uploaded
				const fileKey = Object.keys(files)[0];

				// If no files uploaded, respond with error
				if (!fileKey) {
					response.writeHead(400, { "Content-Type": "text/plain" });
					response.end("No file found in upload");
					console.log("No file found in upload");
					return;
				}

				// Access the uploaded file object (assuming single file)
				const file = files[fileKey][0];

				// Read the uploaded file content as utf-8 string
				const htmlContent = await fs.readFile(file.filepath, 'utf-8');

				let html_doc;
				try {
					// Parse the HTML content into a DOM using JSDOM
					const dom = new JSDOM(htmlContent);
					html_doc = dom.window.document;
				} catch (e) {
					// Fail gracefully if HTML parsing fails
					console.error("Cheerio parsing failed:", e);
					response.writeHead(500);
					response.end("Failed to parse HTML content");
					console.log("Failed to parse HTML content", e);
					return;
				}

				// Extract DOI from the parsed HTML document
				const doi = getDOI(html_doc);
				if (!doi) {
					// If no valid DOI found, respond with error
					response.writeHead(400, { "Content-Type": "text/plain" });
					response.end("No valid DOI found in the HTML content");
					console.log("No valid DOI found in the HTML content");
					return;
				}

				// Create filter string to find tiddler with matching DOI and tag 'bibtex-entry'
				var filter = `[tag[bibtex-entry]!has[draft.of]] :filter[get[bibtex-doi]search:title[${doi}]]`;

				// Search for matching tiddlers in TiddlyWiki store
				const tiddlerFound = $tw.wiki.filterTiddlers(filter);

				if (tiddlerFound.length == 0) {
					// No matching tiddler found: respond with error
					response.writeHead(500, { "Content-Type": "application/json" });
					response.end("No tiddler found with the given DOI");
					console.log("No tiddler found with the given DOI");
					return;
				}
				if (tiddlerFound.length > 1) {
					// Multiple matches found: respond with error
					response.writeHead(500, { "Content-Type": "application/json" });
					response.end("Multiple tiddlers found with the given DOI");
					console.log("Multiple tiddlers found with the given DOI");
					return;
				}

				// Retrieve the single matching tiddler object
				const tiddler = $tw.wiki.getTiddler(tiddlerFound);

				// Check tiddler validity
				if (!(tiddler && tiddler.fields && tiddler.fields.title)) {
					response.writeHead(500, { "Content-Type": "application/json" });
					response.end("Tiddler not found or invalid");
					console.log("Tiddler not found or invalid");
					return
				}
				// Extract title from tiddler fields
				const tiddlerTitle = tiddler.fields.title;

				// Get literature path from config tiddler, fallback to "literature" if not set
				var pathLiterature = ($tw.wiki.getTiddler("$:/config/tw-connector/path/literature/html") || {}).fields?.text || "literature";

				// Resolve absolute path for literature directory under files folder
				var fullPathLIterature = path.resolve($tw.boot.wikiTiddlersPath, "../files", pathLiterature);

				// Create literature directory if not existing
				$tw.utils.createDirectory(path.dirname(fullPathLIterature));

				// Compose full path for HTML file using tiddler title
				const fullPathLiteratureHtml = path.join(fullPathLIterature, "html", tiddlerTitle + ".html");

				// Create directory for the HTML file if not existing
				$tw.utils.createDirectory(path.dirname(fullPathLiteratureHtml));

				try {
					// Write the uploaded HTML content to the file
					await fs.writeFile(fullPathLiteratureHtml, htmlContent, 'utf8');
					console.log(`File saved successfully at ${fullPathLiteratureHtml}`);
				} catch (err) {
					// Handle any error during file write
					response.writeHead(500, { "Content-Type": "application/json" });
					response.end("Failed to save HTML content to file");
					console.error(`Error saving file at ${htmlContent}:`, err);
				}
				// // Update references and citations for tiddlers
				// console.log("Updating references and citations for tiddler:", tiddlerTitle);
				// try {
				// 	var cf = new crossref.Crossref();
				// 	// Update references and citations for the tiddler
				// 	const cfWorks = await cf.works(doi);
				// 	if (cfWorks && cfWorks.message && cfWorks.message.reference && Array.isArray(cfWorks.message.reference)) {
				// 		// Extract all DOIs from the references
				// 		const referenceDois = cfWorks.message.reference
				// 			.map(ref => ref.DOI)
				// 			.filter(doi => typeof doi === "string" && doi.length > 0);
				// 		console.log("Reference DOIs:", referenceDois);
				// 		const referencedTiddlers = referenceDois
				// 			.map(refDoi => {
				// 				const filter = `[tag[bibtex-entry]!has[draft.of]] :filter[get[bibtex-doi]search:title[${refDoi}]]`;
				// 				return $tw.wiki.filterTiddlers(filter);
				// 			})
				// 			.flat();

				// 		console.log("Referenced tiddlers found:", referencedTiddlers);
				// 	}
				// } catch (err) {
				// 	// Handle any error during reference update
				// 	//response.writeHead(500, { "Content-Type": "application/json" });
				// 	//response.end("Failed to update references and citations");
				// 	console.error("Error updating references and citations", err);
				// 	//return;
				// }

				// Respond success after everything completes
				response.writeHead(200, { "Content-Type": "application/json" });
				response.end(JSON.stringify({ status: "success" }));
				console.log("Form data processed successfully");
			});
		} catch (err) {
			// Catch-all error handler for unexpected errors
			console.log("Error parsing or writing uploaded file", err);
			response.writeHead(400);
			response.end("Error processing upload");
			console.error("Error processing upload", err);
		}

		// Function to extract DOI string from HTML document
		function getDOI(html) {
			var doi_sel = [
				"meta[name='dc.Identifier' i][scheme='doi' i]",
				"meta[name='dc.Identifier' i]",
				"meta[name='citation_doi' i]",
				"meta[property='citation_doi' i]",
				'ul.nova-legacy-e-list li +li a.nova-legacy-e-link[href*="doi.org"]', // for researchgate
				'div strong +a[href*="doi.org"]', // for IEEE
				'li[data-test-id="paper-doi"] .doi__link' // for sematic
			];

			var doi;
			for (let i = 0; i < doi_sel.length; i++) {
				var ele = html.querySelector(doi_sel[i]);
				if (ele === undefined || ele === null) {
					continue;
				}
				var attributes = ["content", "href"];
				for (let j = 0; j < attributes.length; j++) {
					doi = ele.getAttribute(attributes[j]);
					if (doi !== undefined && doi !== null) {
						break;
					}
				}

				doi = doi.replace('doi:', '');
				doi = doi.replace(/^(https?:\/\/.*?doi\.org\/)?/, '');
				break;
			}

			function isValidDOI(doi) {
				const doiRegex = /^10.\d{4,9}\/[-._;()/:a-zA-Z0-9]+$/;
				return doiRegex.test(doi);
			}

			if (!isValidDOI(doi)) {
				return;
			}
			return doi;
		}

	};

}());
