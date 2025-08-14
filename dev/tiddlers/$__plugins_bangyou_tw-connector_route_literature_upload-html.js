/*\
title: $:/plugins/bangyou/tw-connector/route/literature/upload-html.js
type: application/javascript
module-type: route
\*/



/**
 * TiddlyWiki Node.js Route: /literature/upload-html
 * 
 * Handles POST requests for uploading an HTML file containing literature information.
 * 
 * - Expects a multipart/form-data POST request with:
 *   - A file upload (HTML file)
 *   - A 'url' field in the form data
 * - Extracts the DOI from the uploaded HTML file using several common meta tag selectors.
 * - Searches for a tiddler tagged 'bibtex-entry' with a matching DOI.
 * - If exactly one matching tiddler is found, saves the uploaded HTML file to a configured literature directory,
 *   using the tiddler's title as the filename.
 * - Responds with a JSON object indicating success or error.
 * 
 * @module $:/plugins/bangyou/tw-connector/route/literature/upload-html.js
 * @type {application/javascript}
 * @route POST /literature/upload-html
 * @platforms ["node"]
 * @bodyFormat stream
 * 
 * @param {IncomingMessage} request - The HTTP request object.
 * @param {ServerResponse} response - The HTTP response object.
 * @param {Object} state - TiddlyWiki server state object.
 * 
 * @returns {void} Responds directly to the HTTP request with a JSON result.
 * 
 * @throws {400} If form data is invalid, file is missing, DOI is not found, or tiddler is not found.
 * @throws {400} If saving the HTML file fails.

 */


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
	exports.path = /^\/literature\/upload-html$/; // Endpoint path regex
	exports.bodyFormat = "stream"; // Incoming request body format

	exports.handler = function (request, response, state) {
		delete request.headers['Authorization']; // Remove auth header for security (optional)

		try {
			const form = new formidable.IncomingForm({ multiples: false }); // Initialize form parser, no multiple files allowed

			// Parse the incoming form data (fields and files)
			form.parse(request, async (err, fields, files) => {
				if (err) {
					// Respond with error if parsing form fails
					response.writeHead(400, { "Content-Type": "application/json" });
					response.end(JSON.stringify({
						"status": "error",
						"message": "Error parsing form data",
						"code": 400
					}));
					console.log("Error parsing form data", err);
					return;
				}

				// Check that the 'url' field exists in form data
				if (!(fields && fields.url)) {
					response.writeHead(400, { "Content-Type": "application/json" });
					response.end(JSON.stringify({
						"status": "error",
						"message": "No field 'url' found in form data",
						"code": 400
					}));
					console.log("No field 'url' found in form data");
					return;
				}

				// Get first file key uploaded
				const fileKey = Object.keys(files)[0];

				// If no files uploaded, respond with error
				if (!fileKey) {
					response.writeHead(400, { "Content-Type": "application/json" });
					response.end(JSON.stringify({
						"status": "error",
						"message": "No file found in upload",
						"code": 400
					}));
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
					response.writeHead(400, { "Content-Type": "application/json" });
					response.end(JSON.stringify({
						"status": "error",
						"message": "Failed to parse HTML content",
						"code": 400
					}));
					console.log("Failed to parse HTML content", e);
					return;
				}

				// Extract DOI from the parsed HTML document
				const doi = getDOI(html_doc);
				if (!doi) {
					// If no valid DOI found, respond with error
					response.writeHead(400, { "Content-Type": "application/json" });
					response.end(JSON.stringify({
						"status": "error",
						"message": "No valid DOI found in the HTML content",
						"code": 400
					}));
					console.log("No valid DOI found in the HTML content");
					return;
				}

				// Create filter string to find tiddler with matching DOI and tag 'bibtex-entry'
				var filter = `[tag[bibtex-entry]!has[draft.of]] :filter[get[bibtex-doi]search:title[${doi}]]`;

				// Search for matching tiddlers in TiddlyWiki store
				const tiddlerFound = $tw.wiki.filterTiddlers(filter);

				if (tiddlerFound.length == 0) {
					// No matching tiddler found: respond with error
					response.writeHead(400, { "Content-Type": "application/json" });
					response.end(JSON.stringify({
						"status": "error",
						"message": "No tiddler found with the given DOI",
						"code": 400
					}));
					console.log("No tiddler found with the given DOI");
					return;
				}
				if (tiddlerFound.length > 1) {
					// Multiple matches found: respond with error
					response.writeHead(400, { "Content-Type": "application/json" });
					response.end(JSON.stringify({
						"status": "error",
						"message": "Multiple tiddlers found with the given DOI",
						"code": 400
					}));
					console.log("Multiple tiddlers found with the given DOI");
					return;
				}

				// Retrieve the single matching tiddler object
				const tiddler = $tw.wiki.getTiddler(tiddlerFound);

				// Check tiddler validity
				if (!(tiddler && tiddler.fields && tiddler.fields.title)) {
					response.writeHead(400, { "Content-Type": "application/json" });
					response.end(JSON.stringify({
						"status": "error",
						"message": "Tiddler not found or invalid",
						"code": 400
					}));
					console.log("Tiddler not found or invalid");
					return;
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
					response.writeHead(400, { "Content-Type": "application/json" });
					response.end(JSON.stringify({
						"status": "error",
						"message": "Failed to save HTML content to file",
						"code": 400
					}));
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
				response.end(JSON.stringify({
					"status": "success",
					"message": "HTML file uploaded and processed successfully",
					"code": 200
				}));
				console.log("Form data processed successfully");
			});
		} catch (err) {
			// Catch-all error handler for unexpected errors
			console.log("Error parsing or writing uploaded file", err);
			response.writeHead(400, { "Content-Type": "application/json" });
			response.end(JSON.stringify({
				"status": "error",
				"message": "Error processing upload",
				"code": 400
			}));
			console.error("Error processing upload", err);
		}

		// Function to extract DOI string from HTML document

		function getDOI(html) {
			var doi_sel = [
				"meta[name='dc.Identifier' i][scheme='doi' i]",
				"meta[name='dc.Identifier' i]",
				"meta[name='citation_doi' i]",
				"meta[property='citation_doi' i]",
				"meta[name='DC.Identifier.DOI' i]",
				'ul.nova-legacy-e-list li +li a.nova-legacy-e-link[href*="doi.org"]', // for researchgate
				'div strong +a[href*="doi.org"]', // for IEEE
				'li[data-test-id="paper-doi"] .doi__link' // for sematic
			];

			function isValidDOI(doi) {
				const doiRegex = /^10.\d{4,9}\/[-._;()/:a-zA-Z0-9]+$/;
				return doiRegex.test(doi);
			}
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
				if (!doi) {
					continue;
				}
				doi = doi.replace('doi:', '');
				doi = doi.replace(/^(https?:\/\/.*?doi\.org\/)?/, '');
				if (isValidDOI(doi)) {
					return doi;
				}
			}

			return;
		}


	};

}());
