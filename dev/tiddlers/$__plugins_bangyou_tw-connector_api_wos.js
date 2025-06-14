/*\
title: $:/plugins/bangyou/tw-connector/utils/wos.js
type: application/javascript
module-type: library

Web of Science utility for TiddlyWiki

\*/

(function (exports) {
    'use strict';
    const fetch = require('node-fetch');

    // use cache


    const wosCache = require('$:/plugins/bangyou/tw-connector/api/cachehelper.js').cacheHelper("wos");

    //const wosCache = cacheHelper('wos');



    function WOS(host = "https://api.clarivate.com") {
        const this_host = host.replace(/\/+$/, "");
        const path_document = "/apis/wos-starter/v1/documents"
        function getWOSApiKey() {
            // In TiddlyWiki, global $tw object provides access to tiddlers
            if (typeof $tw !== "undefined" && $tw.wiki) {
                return $tw.wiki.getTiddlerText("$:/config/tw-connector/api/wos", "").trim();
            }
            return "";
        }
        function buildWOSApiUrl(path, query = {}) {
            const normalizedPath = path.startsWith("/") ? path : `/${path}`;
            const queryString = Object.keys(query)
                .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(query[key]))
                .join('&');
            return `${this_host}${normalizedPath}${queryString ? `?${queryString}` : ""}`;
        }
        async function wosRequest(url) {
            const apiKey = getWOSApiKey();
            if (!apiKey || apiKey === "") {
                throw new Error("Web of Science API key is not configured. Please set it in $:/config/tw-connector/api/wos tiddler.");
            }
            const headers = {
                "X-ApiKey": apiKey
            };
            const response = await fetch(url, { headers });
            // Simulate a delay to avoid hitting rate limits too quickly
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        }


        async function wosWorksGet(query) {
            // Helper to request a page of results
            async function wosStarterRequest({ query, page = 1, limit = 50 }) {
                const url = buildWOSApiUrl(path_document, { q: query, page, limit });

                return await wosRequest(url);
            }

            const firstPage = await wosStarterRequest({ query, page: 1, limit: 50 });
            const worksTotal = firstPage.metadata && firstPage.metadata.total ? firstPage.metadata.total : 0;
            const pagesTotal = Math.ceil(worksTotal / 50);
            let allHits = firstPage.hits || [];

            if (pagesTotal > 1) {
                for (let i = 2; i <= pagesTotal; i++) {
                    const pageResult = await wosStarterRequest({ query, page: i, limit: 50 });
                    if (pageResult.hits) {
                        allHits = allHits.concat(pageResult.hits);
                    }
                }
            }
            return allHits;
        }

        function extractResearchId(input) {
            if (!input) return "";
            // If input is just the id (e.g., "A-1234-5678"), return as is
            if (/^[A-Z]-\d{4}-\d{4}$/i.test(input)) {
                return input;
            }
            // Try to extract from known URL patterns
            const match = input.match(/(?:\/record\/|\/author\/record\/)([A-Z]-\d{4}-\d{4})/i);
            return match ? match[1] : input;
        }
        async function works(researcherid) {
    
            researcherid = decodeURIComponent(researcherid);
            if (!researcherid || researcherid.length === 0) {
                throw new Error("Invalid researcherid provided");
            }
            researcherid = extractResearchId(researcherid);
            if (!researcherid || researcherid.length === 0) {
                throw new Error(`Tiddler ${colleague} has no valid researcherid field for web of science`);
            }
            const cacheResult = await wosCache.getCacheByKey(researcherid);
            if (cacheResult) {
                return cacheResult.item;
            }
            const works = await wosWorksGet(`AI=${researcherid}`);
            await wosCache.addEntry(researcherid, works);

            return works;
        }

        async function authorDOI(doi) {
            if (!doi || doi.length === 0) {
                throw new Error("Invalid DOI provided");
            }
            if (typeof doi !== "string") {
                throw new Error("DOI must be a string");
            }
            const caches = wosCache.getCaches();
            if (!caches || caches.length === 0) {
                return [];
            }
            const result = [];
            for (const key in caches) {
                if (Object.prototype.hasOwnProperty.call(caches, key)) {
                    const cache = caches[key];
                    for (const item of cache.item) {
                        if (item && item.identifiers && item.identifiers.doi &&
                            item.identifiers.doi.toLowerCase() === doi.toLowerCase()) {
                            result.push(key);
                            break;
                        }
                    }
                }
            }
            // Find tiddlers whose 'researcherid' field matches any key in result using a filter
            
            const filter = `[tag[Colleague]search:researcherid:regexp[${result.join("|")}]]`;
            const matchingTiddlers = $tw.wiki.filterTiddlers(filter);
            return matchingTiddlers;
        }

        return {
            works: works,
            authorDOI: authorDOI
        };

    }


    exports.WOS = WOS;
})(exports);


