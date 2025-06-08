/*\
title: $:/plugins/bangyou/tw-connector/utils/crossref.js
type: application/javascript
module-type: library

Crossref API utility for TiddlyWiki

\*/

'use strict';


const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const fetch = require('node-fetch');

const CACHE_DIR = path.resolve($tw.boot.wikiTiddlersPath, "../cache", "crossref");
$tw.utils.createDirectory(CACHE_DIR);
const CACHE_FILE = path.join(CACHE_DIR, "crossref-cache.json.gz");

// Load cache at startup
let cache = {};
if (fs.existsSync(CACHE_FILE)) {
    try {
        const compressed = fs.readFileSync(CACHE_FILE);
        const decompressed = zlib.gunzipSync(compressed);
        cache = JSON.parse(decompressed.toString("utf8"));
    } catch (err) {
        console.warn("Failed to read or parse compressed cache file:", err);
    }
}

// Debounced save
let saveTimeout = null;
let lastSaveTime = 0;

function saveCache() {
    const now = Date.now();
    const minInterval = 10000; // 10 seconds

    if (saveTimeout) return;

    const timeSinceLastSave = now - lastSaveTime;
    const delay = timeSinceLastSave >= minInterval ? 0 : minInterval - timeSinceLastSave;

    saveTimeout = setTimeout(() => {
        const json = JSON.stringify(cache, null, 2);
        const compressed = zlib.gzipSync(Buffer.from(json, "utf8"));
        fs.writeFileSync(CACHE_FILE, compressed);
        console.log("Cache saved to", CACHE_FILE);
        lastSaveTime = Date.now();
        saveTimeout = null;
    }, delay);
}


function Crossref(host = "https://api.crossref.org/") {
    const this_host = host.replace(/\/+$/, "");

    function buildCrossRefApiUrl(path, query = {}) {
        const normalizedPath = path.startsWith("/") ? path : `/${path}`;
        const queryString = Object.keys(query)
            .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(query[key]))
            .join('&');
        return `${this_host}${normalizedPath}${queryString ? `?${queryString}` : ""}`;
    }

    async function crossrefRequest(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }

    async function works(doi) {
        const key = `works/${doi}`;
        if (cache[key]) {
            return cache[key];
        }

        const url = buildCrossRefApiUrl(`/works/${encodeURIComponent(doi)}`);
        const result = await crossrefRequest(url);

        // Update cache
        cache[key] = result;
        // Save cache
        saveCache()

        return result;
    }

    return {
        works
    };
}

exports.Crossref = Crossref;
