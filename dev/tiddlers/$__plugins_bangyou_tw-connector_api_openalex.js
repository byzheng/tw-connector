/*\
title: $:/plugins/bangyou/tw-connector/utils/openalex.js
type: application/javascript
module-type: library

OpenAlex API utility for TiddlyWiki with timestamped caching

\*/

(function (exports) {
    'use strict';
    if (!$tw.node) {
        return;
    }
    const fetch = require('node-fetch');

    // use cache


    
    const openalex_daily_request_count_key = "__openalex_daily_request_count";
    const platform_field = "openalex"; // Field in tiddler that contains the ORCID ID
    const cacheHelper = require('$:/plugins/bangyou/tw-connector/api/cachehelper.js').cacheHelper('openalex', 9999999);


    function OpenAlex(host = "https://api.openalex.org/") {
        const this_host = host.replace(/\/+$/, "");
        const BATCH_SIZE = 50;

        function isEnabled() {
            let tiddler = $tw.wiki.getTiddler("$:/config/tw-connector/authoring/openalex/enable");
            if (!tiddler) {
                return true; // default to enabled ("yes")
            }
            return tiddler && tiddler.fields.text === "enable";
        }
        function getOpenAlexDailyLimit() {
            if (typeof $tw !== "undefined" && $tw.wiki) {
                const limitText = $tw.wiki.getTiddlerText("$:/config/tw-connector/authoring/openalex/daily-limit", "").trim();
                const limit = parseInt(limitText, 10);
                return isNaN(limit) ? 10000 : limit;
            }
            return 10000;
        }

        function getDailyRequestCount() {
            const today = new Date().toISOString().slice(0, 10);
            let countObj = cacheHelper.getCacheByKey(openalex_daily_request_count_key);
            if (!countObj || !countObj.item || countObj.item.day !== today) {
                countObj = { count: 0, day: today };
                cacheHelper.addEntry(openalex_daily_request_count_key, countObj, undefined, false);
                return 0;
            }
            return typeof countObj.item.count === "number" ? countObj.item.count : 0;
        }

        async function getAuthorWorks(openalexId) {
            let allWorks = [];
            let page = 1;
            const perPage = 200; // Maximum items per page
            let totalCount = 0;
            let hasMorePages = true;

            console.log(`Starting to retrieve works for OpenAlex ID: ${openalexId}`);

            while (hasMorePages) {
                const url = buildOpenAlexApiUrl(`/works`, { 
                    filter: `authorships.author.id:${openalexId}`,
                    per_page: perPage,
                    page: page
                });

                console.log(`Fetching page ${page} with ${perPage} items per page...`);
                
                try {
                    const data = await openalexRequest(url);
                    
                    if (data && Array.isArray(data.results)) {
                        allWorks.push(...data.results);
                        
                        // Get total count from first page
                        if (page === 1 && data.meta) {
                            totalCount = data.meta.count;
                            console.log(`Total works available: ${totalCount}`);
                        }
                        
                        // Check if we have more pages
                        const currentResultsCount = allWorks.length;
                        hasMorePages = data.results.length === perPage && currentResultsCount < totalCount;
                        
                        console.log(`Retrieved ${data.results.length} works from page ${page}. Total so far: ${currentResultsCount}${totalCount > 0 ? `/${totalCount}` : ''}`);
                        
                        if (hasMorePages) {
                            page++;
                            // Add a small delay between requests to be respectful to the API
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    } else {
                        console.warn(`No results found on page ${page}`);
                        hasMorePages = false;
                    }
                } catch (error) {
                    console.error(`Error fetching page ${page}: ${error.message}`);
                    hasMorePages = false;
                }
            }

            console.log(`Retrieved ${allWorks.length} total works for OpenAlex ID: ${openalexId}`);
            return allWorks;
        }

        async function cacheWorks(openalexId) {
            if (!isEnabled()) {
                return;
            }
            openalexId = decodeURIComponent(openalexId);
            
            if (!openalexId || openalexId.length === 0) {
                throw new Error("Invalid OpenAlex ID provided");
            }
            openalexId = extractOpenAlexId(openalexId);
            if (!openalexId || openalexId.length === 0) {
                throw new Error(`Tiddler has no valid openalex field`);
            }
            const cacheResult = cacheHelper.getCacheByKey(openalexId);
            if (cacheResult) {
                return cacheResult.item;
            }
            const works = await getAuthorWorks(openalexId);
            console.log(`Caching ${works.length} works for OpenAlex ID: ${openalexId}`);
            await cacheHelper.addEntry(openalexId, works);
            return works;
        }


        function extractOpenAlexId(url) {
            if (typeof url !== "string") return null;
            const match = url.match(/openalex\.org\/(W\d+)/i);
            // Handle both author IDs (A followed by numbers) and work IDs (W followed by numbers)
            if (url.includes('openalex.org/works?filter=authorships.author.id:')) {
                const match = url.match(/authorships\.author\.id:(a\d+)/i);
                return match ? match[1] : null;
            }
            // Handle direct OpenAlex URLs with work or author IDs
            return match ? match[1] : null;
        }

        function buildOpenAlexApiUrl(path, query = {}) {
            const normalizedPath = path.startsWith("/") ? path : `/${path}`;
            const queryString = Object.keys(query)
                .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(query[key]))
                .join('&');
            return `${this_host}${normalizedPath}${queryString ? `?${queryString}` : ""}`;
        }

        async function openalexRequest(url) {
            const currentCount = getDailyRequestCount();
            const openalex_daily_limit = getOpenAlexDailyLimit();
            if (currentCount >= openalex_daily_limit) {
                throw new Error(`Daily request limit of ${openalex_daily_limit} for OpenAlex API has been reached.`);
            }
            const headers = {
                "Accept": "application/json"
            };
            const response = await fetch(url, { headers });
            const today = new Date().toISOString().slice(0, 10);
            const countObj = { count: currentCount + 1, day: today };
            //console.log(`OpenAlex API request count for today (${today}): ${countObj.count}`);
            cacheHelper.addEntry(openalex_daily_request_count_key, countObj, undefined, false);
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        }
        function getFromCache(openalexId, doi) {
            return cacheHelper.getCacheByKey([openalexId, doi]);
        }

        async function works_doi(doi) {
            doi = decodeURIComponent(doi);
            if (!/^https:\/\/doi\.org\//.test(doi)) {
                doi = `https://doi.org/${doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '')}`;
            }
            const cacheResult = getFromCache(null, doi);
            if (cacheResult) {
                return cacheResult;
            }

            const url = buildOpenAlexApiUrl(`/works/${encodeURIComponent(doi)}`);
            const result = await openalexRequest(url);
            const openalexId = result.id;
            // Update cache with timestamp
            cacheHelper.addEntry([openalexId, result.doi], result);
            return result;
        }

        async function cites(doi) {
            var results = [];
            const workData = await works_doi(doi);
            if (!workData) {
                console.warn(`No work data found for DOI: ${doi}`);
                return results;
            }
            const openalexId = extractOpenAlexId(workData.id);
            console.log(`Extracted OpenAlex ID for DOI ${doi}: ${openalexId}`);
            if (!openalexId) {
                console.warn(`No OpenAlex ID found for DOI: ${doi}`);
                return results;
            }
            const url = `https://api.openalex.org/works?filter=cites:${encodeURIComponent(openalexId)}`;
            console.log(`Fetching citing works for DOI: ${doi} (${openalexId}) from ${url}`);
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    console.warn(`Failed to fetch citing works: ${response.status} ${response.statusText}`);
                    return results;
                }
                const data = await response.json();

                for (const result of data.results || []) {
                    const openalexId = result.id;
                    cacheHelper.addEntry([openalexId, result.doi], result, undefined, false);
                }
                if (data.results) {
                    results = data.results;
                }
            } catch (error) {
                console.error(`Error fetching citing works: ${error.message}`);
            }
            return results;

        }
        async function references(doi) {
            const results = [];
            const workData = await works_doi(doi);

            const ids = (workData.referenced_works || []);
            if (ids.length === 0) {
                console.warn(`No references found for DOI: ${doi}`);
                return results;
            }
            const uncachedIds = [];
            for (const id of ids) {
                const resultCache = getFromCache(id, null);
                if (resultCache) {
                    results.push(resultCache);
                } else {
                    uncachedIds.push(id);
                }
            }
            if (uncachedIds.length === 0) {
                return results;
            }
            // Helper function to divide the array into chunks of specified size
            const chunkArray = (array, size) => {
                const chunks = [];
                for (let i = 0; i < array.length; i += size) {
                    chunks.push(array.slice(i, i + size));
                }
                return chunks;
            };
            // Divide the IDs into batches
            const batches = chunkArray(uncachedIds, BATCH_SIZE);
            for (const batch of batches) {
                // Construct the filter parameter with pipe-separated IDs
                const filterParam = batch.join('|');
                const url = `https://api.openalex.org/works?filter=openalex:${encodeURIComponent(filterParam)}`;
                try {
                    const response = await fetch(url);
                    if (!response.ok) {
                        console.warn(`Failed to fetch batch: ${response.status} ${response.statusText}`);
                        continue;
                    }

                    const data = await response.json();
                    for (const result of data.results || []) {
                        const openalexId = result.id;
                        cacheHelper.addEntry([openalexId, result.doi], result, undefined, false);
                    }
                    if (data.results) {
                        results.push(...data.results);
                    }
                } catch (error) {
                    console.error(`Error fetching batch: ${error.message}`);
                }
            }

            return results;
        }

        function getWorks(openalexId) {
            if (!isEnabled()) {
                return [];
            }
            if (!openalexId) {
                throw new Error("Invalid OpenAlex ID");
            }
            openalexId = extractOpenAlexId(openalexId);
            if (!openalexId) {
                throw new Error("Invalid OpenAlex ID format");
            }
            const cached = cacheHelper.getCacheByKey(openalexId);
            return cached?.item || [];
        }

        function getLatest(openalexId, limit = 10) {
            if (!isEnabled()) {
                return [];
            }
            if (!openalexId) {
                throw new Error("Invalid OpenAlex ID");
            }
            openalexId = extractOpenAlexId(openalexId);
            if (!openalexId) {
                throw new Error("Invalid OpenAlex ID format");
            }
            const works = getWorks(openalexId);
            if (!works || !Array.isArray(works) || works.length === 0) {
                return [];
            }
            // Sort by year descending (most recent first) and limit results
            const sorted = works
                .filter(work => work && work.year)
                .sort((a, b) => (b.year || 0) - (a.year || 0))
                .slice(0, limit);
            return sorted;
        }

        function getAuthorByDOI(doi) {
            if (!isEnabled()) {
                return [];
            }
            if (!doi || doi.length === 0) {
                throw new Error("Invalid DOI provided");
            }
            if (typeof doi !== "string") {
                throw new Error("DOI must be a string");
            }
            const caches = cacheHelper.getCaches();
            
            if (!caches || caches.length === 0) {
                return [];
            }
            const result = [];
            for (const key in caches) {
                if (key === openalex_daily_request_count_key) {
                    continue;
                }
                if (Object.prototype.hasOwnProperty.call(caches, key)) {
                    const cache = caches[key];
                    if (!cache.item || !Array.isArray(cache.item)) {
                        continue;
                    }
                    for (const item of cache.item) {
                        if (item && item.identifiers && item.identifiers.doi &&
                            item.identifiers.doi.toLowerCase() === doi.toLowerCase()) {
                            result.push(key);
                            break;
                        }
                    }
                }
            }
            if (result.length === 0) {
                return [];
            }
            const filter = `[tag[Colleague]search:openalex:regexp[${result.join("|")}]]`;
            const matchingTiddlers = $tw.wiki.filterTiddlers(filter);
            return matchingTiddlers;
        }

        function removeExpiredEntries() {
            cacheHelper.removeExpiredEntries();
        }
        return {
            isEnabled: isEnabled,
            cacheWorks: cacheWorks,
            getWorks: getWorks,
            getLatest: getLatest,
            getAuthorByDOI: getAuthorByDOI,
            removeExpiredEntries: removeExpiredEntries,
            references: references,
            cites: cites,
            getPlatformField: function () {
                return platform_field;
            },
        };
    }


    exports.OpenAlex = OpenAlex;
})(exports);