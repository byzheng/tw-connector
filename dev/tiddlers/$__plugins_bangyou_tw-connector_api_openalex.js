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
    const fs = require('fs');
    const path = require('path');
    const zlib = require('zlib');
    const fetch = require('node-fetch');

    // use cache


    const openAlexCache = require('$:/plugins/bangyou/tw-connector/api/cachehelper.js').cacheHelper('openalex');


    function OpenAlex(host = "https://api.openalex.org/") {
        const this_host = host.replace(/\/+$/, "");
        const BATCH_SIZE = 50;

        function extractOpenAlexId(url) {
            if (typeof url !== "string") return null;
            const match = url.match(/openalex\.org\/(W\d+)/i);
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
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        }
        function getFromCache(openalexId, doi) {
            return openAlexCache.getCacheByKey([openalexId, doi]);
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
            openAlexCache.addEntry([openalexId, result.doi], result);
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
                    openAlexCache.addEntry([openalexId, result.doi], result, undefined, false);
                }
                openAlexCache.saveCache();
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
                        openAlexCache.addEntry([openalexId, result.doi], result, undefined, false);
                    }
                    openAlexCache.saveCache();
                    if (data.results) {
                        results.push(...data.results);
                    }
                } catch (error) {
                    console.error(`Error fetching batch: ${error.message}`);
                }
            }

            return results;
        }

        return {
            references: references,
            cites: cites
        };
    }


    exports.OpenAlex = OpenAlex;
})(exports);