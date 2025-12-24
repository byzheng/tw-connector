/*\
title: $:/plugins/bangyou/tw-literature/api/crossref.js
type: application/javascript
module-type: library

Crossref API utility for TiddlyWiki

\*/

(function (exports) {
    'use strict';
    if (!$tw.node) {
        return;
    }

    const fetch = require('node-fetch');
    
    const platform_field = "crossref"; // Field in tiddler that contains the Crossref ID
    const cacheHelper = require('$:/plugins/bangyou/tw-literature/api/cachehelper.js').cacheHelper('crossref', 9999999);

    function Crossref(host = "https://api.crossref.org/") {
        const this_host = host.replace(/\/+$/, "");
        
        // Track last request time for rate limiting (5 req/sec = 200ms between requests)
        let lastRequestTime = 0;
        const MIN_REQUEST_INTERVAL = 200; // milliseconds

        function isEnabled() {
            return true;
        }

        function buildCrossRefApiUrl(path, query = {}) {
            const normalizedPath = path.startsWith("/") ? path : `/${path}`;
            const queryString = Object.keys(query)
                .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(query[key]))
                .join('&');
            return `${this_host}${normalizedPath}${queryString ? `?${queryString}` : ""}`;
        }

        async function crossrefRequest(url) {
            // Rate limiting: ensure minimum interval between requests (5 req/sec = 200ms)
            const now = Date.now();
            const timeSinceLastRequest = now - lastRequestTime;
            if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
                const delay = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            const response = await fetch(url);
            lastRequestTime = Date.now();
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        }

        async function getWorksByDOI(doi) {
            if (!isEnabled()) {
                throw new Error("Crossref API is disabled");
            }
            
            doi = decodeURIComponent(doi);
            const key = doi;
            
            // Check cache first
            const cached = cacheHelper.getCacheByKey(key);
            if (cached) {
                return cached.item;
            }

            const url = buildCrossRefApiUrl(`/works/${encodeURIComponent(doi)}`);
            const result = await crossrefRequest(url);

            // Update cache
            cacheHelper.addEntry(key, result);

            return result;
        }

        function removeExpiredEntries() {
            cacheHelper.removeExpiredEntries();
        }

        function getPlatformField() {
            return platform_field;
        }

        async function getReferencesByDOI(doi) {
            const work = await getWorksByDOI(doi);
            
            if (!work || !work.message || !work.message['reference']) {
                return [];
            }
            const references = work.message['reference'];
            return references.map(ref => {
                // Create a copy of the reference object
                const processedRef = { ...ref };
                
                // Rename DOI to doi if it exists
                if (processedRef.DOI) {
                    processedRef.doi = processedRef.DOI;
                    delete processedRef.DOI;
                }
                
                // Rename article-title to title if it exists
                if (processedRef['article-title']) {
                    processedRef.title = processedRef['article-title'];
                    delete processedRef['article-title'];
                }
                
                return processedRef;
            });
        }

        return {
            isEnabled: isEnabled,
            getWorksByDOI: getWorksByDOI,
            getReferencesByDOI: getReferencesByDOI,
            removeExpiredEntries: removeExpiredEntries,
            getPlatformField: getPlatformField
        };
    }

    exports.Crossref = Crossref;
})(exports);