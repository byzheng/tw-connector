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
    
    // Rate limiting: Conservative approach to avoid 429 errors
    let lastRequestTime = 0;
    const MIN_REQUEST_INTERVAL = 350; // 350ms = ~2.9 requests/sec (conservative but reasonable)
    const MAX_RETRIES = 3;
    const INITIAL_RETRY_DELAY = 2000; // Start with 2 second delay for retries

    function Crossref(host = "https://api.crossref.org/") {
        const this_host = host.replace(/\/+$/, "");

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

        async function crossrefRequest(url, retryCount = 0) {
            // Enforce rate limiting: wait if needed to maintain minimum interval between requests
            const now = Date.now();
            const timeSinceLastRequest = now - lastRequestTime;
            if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
                const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
                console.log(`Crossref rate limiting: waiting ${waitTime}ms before next request`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            // Update last request time before making the request
            lastRequestTime = Date.now();
            
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorText = await response.text();
                
                // Handle 429 rate limit errors with exponential backoff
                if (response.status === 429 && retryCount < MAX_RETRIES) {
                    const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
                    console.log(`Crossref 429 error (attempt ${retryCount + 1}/${MAX_RETRIES}): retrying after ${retryDelay}ms`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    return crossrefRequest(url, retryCount + 1);
                }
                
                console.error(`Crossref API Error ${response.status}: ${errorText}`);
                throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
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