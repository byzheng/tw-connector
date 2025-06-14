/*\
title: $:/plugins/bangyou/tw-connector/utils/cachehelper.js
type: application/javascript
module-type: library

Caching utility for TiddlyWiki with timestamped caching

\*/

(function (exports) {
    'use strict';

    const { dir } = require('console');
    const fs = require('fs');
    const path = require('path');
    const zlib = require('zlib');

    // Configuration variables
    const MAX_CACHE_ITEMS = 1000; // Maximum number of cache entries
    const CACHE_EXPIRATION_DAYS = 30; // Expiration duration in days
    const CACHE_EXPIRATION_MS = CACHE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000; // Expiration duration in milliseconds
    const MIN_SAVE_INTERVAL_MS = 10000; // Minimum interval between saves in milliseconds

    let cache = {};
    function cacheHelper(cacheName) {

        const wikiTiddlersPath = $tw.boot.wikiTiddlersPath;

        // Validate cacheName: only allow alphanumeric characters, underscores, and dashes
        if (!/^[\w\-]+$/.test(cacheName)) {
            throw new Error("Invalid cacheName: only alphanumeric, underscore, and dash allowed.");
        }

        // Determine the wiki root directory
        const wikiRoot = path.resolve(wikiTiddlersPath, '..');

        // Construct the cache directory path
        const cacheDir = path.join(wikiRoot, 'cache');

        // Construct the full path to the cache file
        const resolvedCacheFile = path.resolve(cacheDir, `${cacheName}-cache.json.gz`);

        // Ensure the resolved path is within the cache directory to prevent path traversal
        const normalizedCacheDir = path.normalize(cacheDir + path.sep);
        if (!resolvedCacheFile.startsWith(normalizedCacheDir)) {
            throw new Error("Invalid cacheName: path traversal detected.");
        }

        // Create the cache directory if it doesn't exist
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }

        const CACHE_FILE = resolvedCacheFile;
        
        if (fs.existsSync(CACHE_FILE)) {
            try {
                const compressed = fs.readFileSync(CACHE_FILE);
                const decompressed = zlib.gunzipSync(compressed);
                cache = JSON.parse(decompressed.toString('utf8'));
            } catch (err) {
                console.warn(`Failed to read or parse compressed cache file for ${cacheName}:`, err);
            }
        }

        let saveTimeout = null;
        let lastSaveTime = 0;
        // Add an entry to the cache with a timestamp
        function addEntry(keys, item, timestamp = Date.now(), forceSave = true) {
            if (!Array.isArray(keys)) {
                keys = [keys];
            }
            const cacheEntry = {
                item,
                timestamp
            };
            keys.forEach(key => {
                cache[key] = cacheEntry;
            });
            if (forceSave) {
                saveCache();
            }
        }
        function removeExpiredEntries() {
            if (Object.keys(cache).length < MAX_CACHE_ITEMS) return;
            const now = Date.now();
            // Remove entries older than the expiration threshold
            const expirationThreshold = now - CACHE_EXPIRATION_MS;
            for (const key in cache) {
                if (cache[key].timestamp < expirationThreshold) {
                    delete cache[key];
                }
                if (Object.keys(cache).length < MAX_CACHE_ITEMS) {
                    return; // Stop if we have removed enough entries
                }
            }

            // Limit cache size to MAX_CACHE_ITEMS
            const cacheKeys = Object.keys(cache);
            if (cacheKeys.length > MAX_CACHE_ITEMS) {
                // Sort keys by timestamp ascending
                cacheKeys.sort((a, b) => cache[a].timestamp - cache[b].timestamp);
                const keysToRemove = cacheKeys.slice(0, cacheKeys.length - MAX_CACHE_ITEMS);
                for (const key of keysToRemove) {
                    delete cache[key];
                }
            }

        }
        function saveCache() {
            const now = Date.now();
            const timeSinceLastSave = now - lastSaveTime;
            const delay = timeSinceLastSave >= MIN_SAVE_INTERVAL_MS ? 0 : MIN_SAVE_INTERVAL_MS - timeSinceLastSave;

            if (saveTimeout) return;

            saveTimeout = setTimeout(() => {
                try {
                    const json = JSON.stringify(cache, null, 2);
                    const compressed = zlib.gzipSync(Buffer.from(json, 'utf8'));
                    fs.writeFileSync(CACHE_FILE, compressed);
                    console.log(`Cache saved to ${CACHE_FILE}`);
                    lastSaveTime = Date.now();
                } catch (err) {
                    console.error(`Failed to save cache for ${cacheName}:`, err);
                } finally {
                    saveTimeout = null;
                }
            }, delay);
        }

        async function getCacheByKey(key) {
            if (cache.hasOwnProperty(key)) {
                return cache[key];
            }
            return;
        }

        return {
            getCacheByKey,
            addEntry,
            saveCache,
            removeExpiredEntries,
            getCaches: () => cache
        };
    }
    exports.cacheHelper = cacheHelper;
})(exports);