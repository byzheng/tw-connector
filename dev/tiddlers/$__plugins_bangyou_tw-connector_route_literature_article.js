const { Console } = require('console');

/*\
title: $:/plugins/bangyou/tw-connector/route/literature/article.js
type: application/javascript
module-type: route

GET /^\/literature/article\/(.+)$/

Get literature article for a tiddler


\*/
(function () {
	/*jslint node: true, browser: true */
	/*global $tw: false */
	"use strict";

	const fs = require('fs'); // Use promise-based fs API for async/await
	const path = require('path');
	const { JSDOM } = require("jsdom"); // For DOM parsing of HTML content

	exports.method = "GET";
	exports.platforms = ["node"];
	exports.path = /^\/literature\/article\/(.+)$/;

	exports.handler = function (request, response, state) {
		const match = request.url.match(exports.path);
		if (!match || match.length < 2) {
			response.writeHead(400, { "Content-Type": "text/plain" });
			response.end("Bad Request");
			return;
		}
		const tiddlerName = decodeURIComponent(match[1]);
		// Basic sanitization
		if (tiddlerName.includes("..") || tiddlerName.includes("/") || tiddlerName.includes("\\")) {
			response.writeHead(400, { "Content-Type": "text/plain" });
			response.end("Invalid tiddler name");
			return;
		}
		const tiddler = $tw.wiki.getTiddler(tiddlerName);

		// Check tiddler validity
		if (!(tiddler && tiddler.fields && tiddler.fields.title)) {
			response.writeHead(500, { "Content-Type": "application/json" });
			response.end("Tiddler not found or invalid");
			console.log("Tiddler not found or invalid");
			return;
		}


		// Get literature path from config tiddler, fallback to "literature" if not set
		var pathLiterature = ($tw.wiki.getTiddler("$:/config/tw-connector/path/literature/html") || {}).fields?.text || "literature";

		// Resolve absolute path for literature directory under files folder
		var fullPathLIterature = path.resolve($tw.boot.wikiTiddlersPath, "../files", pathLiterature);

		// Compose full path for HTML file using tiddler title
		const fullPathLiteratureHtml = path.join(fullPathLIterature, "html", tiddlerName + ".html");

		fs.readFile(fullPathLiteratureHtml, "utf8", (err, html) => {
			if (err) {
				response.writeHead(404, { "Content-Type": "text/plain" });
				response.end("File not found");
				return;
			}
			let dom, htmlDoc;
			try {
				// Parse the HTML content into a DOM using JSDOM
				dom = new JSDOM(html);
				htmlDoc = dom.window.document;
			} catch (e) {
				// Fail gracefully if HTML parsing fails
				console.error("Cheerio parsing failed:", e);
				response.writeHead(500);
				response.end("Failed to parse HTML content");
				console.log("Failed to parse HTML content", e);
				return;
			}

			const url = getURL(htmlDoc);
			if (!url) {
				response.writeHead(500, { "Content-Type": "text/plain" });
				response.end("No valid URL found in the HTML content");
				console.log("No valid URL found in the HTML content");
				return;
			}
			console.log("Found URL:", url);
			// Inject script tag before </body>
			//const inject = `<script src="/files/inject.js"></script>`;
			//const modifiedHtml = html.replace(/<\/body>/i, `${inject}</body>`);
			const modifiedHTML = dom.serialize();
			response.writeHead(200, { "Content-Type": "text/html" });
			response.end(modifiedHTML);
		});

	};


	function getURL(htmlDoc) {
		var urlSelt = [
			"meta[name='prism.url' i]",
			"meta[property='og:url' i]"
		]
		var url;
		for (let i = 0; i < urlSelt.length; i++) {

			var ele = htmlDoc.querySelector(urlSelt[i]);
			if (ele === undefined || ele === null) {
				continue;
			}
			var attributes = ["content", "href"];
			for (let j = 0; j < attributes.length; j++) {
				url = ele.getAttribute(attributes[j]);
				if (url) {
					break;
				}
			}
			break;
		}
		return url;
	}


}());
