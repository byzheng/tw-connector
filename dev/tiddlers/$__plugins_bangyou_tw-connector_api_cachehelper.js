/*\
title: $:/plugins/bangyou/tw-connector/utils/cachehelper.js
type: application/javascript
module-type: library

Caching utility for TiddlyWiki with timestamped caching

\*/

(function (exports) {
    'use strict';
    if (!$tw.node) {
        return;
    }
    const fs = require('fs');
    const path = require('path');
    const zlib = require('zlib');

    // Configuration variables
    const MAX_CACHE_ITEMS = 99999999999; // Maximum number of cache entries
    const MIN_SAVE_INTERVAL_MS = 10000; // Minimum interval between saves in milliseconds

    
    function cacheHelper(cacheName, limit = MAX_CACHE_ITEMS) {
        let cache = {};
        const this_limit = Math.max(2, limit || MAX_CACHE_ITEMS);
        const wikiTiddlersPath = $tw.boot.wikiTiddlersPath;
        let expiredDays = 30; // Default expiration days
        let deleteMaximum = 10; // Default maximum number of items to delete at once

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

        function getExpredDays() {
            const userExpiredDays = $wiki.getTiddlerText('$:/config/tw-connector/authoring/expired-days', '30');
            if (!userExpiredDays || isNaN(userExpiredDays) || parseInt(userExpiredDays, 10) <= 0) {
                return expiredDays;
            }
            // Validate that userExpiredDays is a positive integer
            if (!/^\d+$/.test(userExpiredDays)) {
                console.warn(`Invalid expired days value: ${userExpiredDays}. Using default of ${expiredDays} days.`);
                return expiredDays;
            }
            // Convert userExpiredDays to an integer
            expiredDays = parseInt(userExpiredDays, 10);
            return expiredDays;
        }
        function getDeleteMaximum() {
            const userDeleteMaximum = $wiki.getTiddlerText('$:/config/tw-connector/authoring/delete-maximum', '10');
            if (!userDeleteMaximum || isNaN(userDeleteMaximum) || parseInt(userDeleteMaximum, 10) <= 0) {
                return deleteMaximum;
            }
            // Validate that userDeleteMaximum is a positive integer
            if (!/^\d+$/.test(userDeleteMaximum)) {
                console.warn(`Invalid delete maximum value: ${userDeleteMaximum}. Using default of ${deleteMaximum} items.`);
                return deleteMaximum;
            }
            // Convert userDeleteMaximum to an integer
            deleteMaximum = parseInt(userDeleteMaximum, 10);
            return deleteMaximum;
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
            //if (Object.keys(cache).length < this_limit) return;
            const now = Date.now();
            // Remove entries older than the expiration threshold
            const expirationThreshold = now - getExpredDays() * 24 * 60 * 60 * 1000; // Convert days to milliseconds

            const deleteItemMaximum = getDeleteMaximum();
            // If not enough expired entries, delete oldest items up to deleteMaximum
            cacheKeys.sort((a, b) => cache[a].timestamp - cache[b].timestamp);
            let removedCount = 0;  
            // Remove expired entries, but only up to deleteItemMaximum items
            for (const key of cacheKeys) {
                if (removedCount >= deleteItemMaximum) break;
                if (cache[key].timestamp < expirationThreshold) {
                    delete cache[key];
                    removedCount++;
                }
            }
            // Limit cache size to this_limit
            const cacheKeys = Object.keys(cache);
            if (cacheKeys.length > this_limit) {
                const keysToRemove = cacheKeys.slice(0, cacheKeys.length - this_limit);
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

        function getCacheByKey(key) {
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
