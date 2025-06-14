/*\
title: $:/plugins/bangyou/tw-connector/api/scholar.js
type: application/javascript
module-type: library

Scholar API utility for TiddlyWiki with timestamped caching

\*/


// 'use strict';

// const fs = require('fs');
// const path = require('path');
// const zlib = require('zlib');
// const fetch = require('node-fetch');

// // Define cache directory and file
// const CACHE_DIR = path.resolve($tw.boot.wikiTiddlersPath, "../cache", "scholar");
// $tw.utils.createDirectory(CACHE_DIR);
// const CACHE_FILE = path.join(CACHE_DIR, "scholar-cache.json.gz");

// // Load cache at startup
// let cache = {};
// if (fs.existsSync(CACHE_FILE)) {
//     try {
//         const compressed = fs.readFileSync(CACHE_FILE);
//         const decompressed = zlib.gunzipSync(compressed);
//         cache = JSON.parse(decompressed.toString("utf8"));
//     } catch (err) {
//         console.warn("Failed to read or parse compressed cache file:", err);
//     }
// }

// // Debounced save
// let saveTimeout = null;
// let lastSaveTime = 0;

// function saveCache() {
//     const now = Date.now();
//     const minInterval = 10000; // 10 seconds

//     if (saveTimeout) return;

//     const timeSinceLastSave = now - lastSaveTime;
//     const delay = timeSinceLastSave >= minInterval ? 0 : minInterval - timeSinceLastSave;

//     saveTimeout = setTimeout(() => {
//         const json = JSON.stringify(cache, null, 2);
//         const compressed = zlib.gzipSync(Buffer.from(json, "utf8"));
//         fs.writeFileSync(CACHE_FILE, compressed);
//         console.log("Cache saved to", CACHE_FILE);
//         lastSaveTime = Date.now();
//         saveTimeout = null;
//     }, delay);
// }

// function Scholar(host = "https://scholar.google.com/") {
//     const this_host = host.replace(/\/+$/, "");
//     function buildScholarApiUrl(path, query = {}) {
//         const normalizedPath = path.startsWith("/") ? path : `/${path}`;
//         const queryString = Object.keys(query)
//             .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(query[key]))
//             .join('&');
//         return `${this_host}${normalizedPath}${queryString ? `?${queryString}` : ""}`;
//     }

//     async function scholarRequest(url) {
//         const response = await fetch(url);
//         if (!response.ok) {
//             throw new Error(`HTTP error! status: ${response.status}`);
//         }
//         return response.json();
//     }

//     function getFromCache(openalexId, doi) {
//         let result;
//         // get from openalex id
//         if (openalexId && cache[openalexId]) {
//             result = cache[openalexId].data;
//         } else if (doi) {
//             for (const [key, entry] of Object.entries(cache)) {
//                 if (entry.doi === doi) {
//                     result = entry.data;
//                 }
//             }
//         }
//         if (!result) {
//             return;
//         }

//         const now = Date.now();
//         const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

//         if ((now - result.timestamp > THIRTY_DAYS_MS)) {
//             return;
//         }
//         return result;
//     }

//     async function articles(user) {
//         // const cacheResult = getFromCache(null, doi);
//         // if (cacheResult) {
//         //     return cacheResult;
//         // }

//         const url = buildScholarApiUrl(`/citations?user=${user}`);
//         const result = await scholarRequest(url);
//         return result;
//         const openalexId = result.id;
//         // Update cache with timestamp
//         const now = Date.now();
//         cache[openalexId] = {
//             timestamp: now,
//             data: result,
//             doi: doi
//         };
//         // Save cache
//         saveCache();

//         return result;
//     }

//     async function cites(doi) {
//         var results = [];
//         const workData = await works_doi(doi);
//         if (!workData) {
//             console.warn(`No work data found for DOI: ${doi}`);
//             return results;
//         }
//         const openalexId = extractOpenAlexId(workData.id);
//         if (!openalexId) {
//             console.warn(`No OpenAlex ID found for DOI: ${doi}`);
//             return results;
//         }
//         const url = `https://api.openalex.org/works?filter=cites:${encodeURIComponent(openalexId)}`;
//         console.log(`Fetching citing works for DOI: ${doi} (${openalexId}) from ${url}`);
//         try {
//             const response = await fetch(url);
//             if (!response.ok) {
//                 console.warn(`Failed to fetch citing works: ${response.status} ${response.statusText}`);
//                 return results;
//             }
//             const data = await response.json();
//             const now = Date.now();
//             for (const result of data.results || []) {
//                 const openalexId = result.id;
//                 cache[openalexId] = {
//                     timestamp: now,
//                     data: result,
//                     doi: result.doi || null
//                 };
//             }
//             saveCache();
//             if (data.results) {
//                 results = data.results;
//             }
//         } catch (error) {
//             console.error(`Error fetching citing works: ${error.message}`);
//         }
//         return results;

//     }
//     async function references(doi) {
//         const results = [];
//         const workData = await works_doi(doi);

//         const ids = (workData.referenced_works || []);
//         if (ids.length === 0) {
//             console.warn(`No references found for DOI: ${doi}`);
//             return results;
//         }
//         const uncachedIds = [];
//         for (const id of ids) {
//             const resultCache = getFromCache(id, null);
//             if (resultCache) {
//                 results.push(resultCache);
//             } else {
//                 uncachedIds.push(id);
//             }
//         }
//         if (uncachedIds.length === 0) {
//             return results;
//         }
//         // Helper function to divide the array into chunks of specified size
//         const chunkArray = (array, size) => {
//             const chunks = [];
//             for (let i = 0; i < array.length; i += size) {
//                 chunks.push(array.slice(i, i + size));
//             }
//             return chunks;
//         };
//         // Divide the IDs into batches
//         const batches = chunkArray(uncachedIds, BATCH_SIZE);
//         for (const batch of batches) {
//             // Construct the filter parameter with pipe-separated IDs
//             const filterParam = batch.join('|');
//             const url = `https://api.openalex.org/works?filter=openalex:${encodeURIComponent(filterParam)}`;
//             try {
//                 const response = await fetch(url);
//                 if (!response.ok) {
//                     console.warn(`Failed to fetch batch: ${response.status} ${response.statusText}`);
//                     continue;
//                 }

//                 const data = await response.json();
//                 const now = Date.now();
//                 for (const result of data.results || []) {
//                     const openalexId = result.id;
//                     cache[openalexId] = {
//                         timestamp: now,
//                         data: result,
//                         doi: result.doi || null
//                     };
//                 }
//                 saveCache();
//                 if (data.results) {
//                     results.push(...data.results);
//                 }
//             } catch (error) {
//                 console.error(`Error fetching batch: ${error.message}`);
//             }
//         }

//         return results;
//     }

//     return {
//         references: references,
//         cites: cites
//     };
// }


// exports.Scholar = Scholar;
