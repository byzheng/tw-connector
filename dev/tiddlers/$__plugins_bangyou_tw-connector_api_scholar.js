/*\
title: $:/plugins/bangyou/tw-connector/utils/scholar.js
type: application/javascript
module-type: library

Google Scholar utility for TiddlyWiki (via external Chrome extension)
\*/
(function (exports) {
    'use strict';
    if (!$tw.node) return;

    const cacheHelper = require('$:/plugins/bangyou/tw-connector/api/cachehelper.js').cacheHelper("scholar", 9999999);
    const platform_field = "google-scholar"; // This should be a Google Scholar ID or URL

    // Keys to track
    const pendingKey = "__scholar_pending_status";

    function Scholar() {
        function extractUserFromUrl(urlOrId) {
            if (typeof urlOrId !== "string") return null;
            // If it's just an ID (alphanumeric, _, or -), return as is
            if (/^[a-zA-Z0-9_-]+$/.test(urlOrId)) {
                return urlOrId;
            }
            // Otherwise, try to extract from a Google Scholar URL
            const match = urlOrId.match(/[?&]user=([a-zA-Z0-9_-]+)/);
            return match ? match[1] : null;
        }
        function isEnabled() {
            let tiddler = $tw.wiki.getTiddler("$:/config/tw-connector/authoring/scholar/enable");
            if (!tiddler) {
                return false; // default to disabled
            }
            return tiddler && tiddler.fields.text === "enable";
        }

        function getPending() {
            const pending = cacheHelper.getCacheByKey(pendingKey);
            return pending?.item || [];
        }

        function addPending(id) {
            if (!isEnabled()) {
                return;
            }
            if (!id) {
                throw new Error("Invalid ID");
            }
            id = extractUserFromUrl(id);
            if (!id) {
                throw new Error("Invalid ID format");
            }
            const current = getPending();
            if (!current.includes(id)) {
                current.push(id);
                cacheHelper.addEntry(pendingKey, current);
            }
        }
        function clearAllPending() {
            if (!isEnabled()) {
                return;
            }
            cacheHelper.addEntry(pendingKey, []);
        }
        function clearPending(id) {
            if (!isEnabled()) {
                return;
            }
            if (!id) {
                throw new Error("Invalid ID");
            }
            id = extractUserFromUrl(id);
            if (!id) {
                throw new Error("Invalid ID format");
            }
            let current = getPending();
            current = current.filter(entry => entry !== id);
            cacheHelper.addEntry(pendingKey, current);
        }

        function getStatus() {
            return {
                pending: getPending()
            };
        }
        function cacheWorks(id, works) {
            if (!isEnabled()) {
                return;
            }
            if (!id) {
                throw new Error("Invalid ID");
            }
            id = extractUserFromUrl(id);
            if (!id) {
                throw new Error("Invalid ID format");
            }
            const cached = getWorks(id);
            if (cached && Array.isArray(cached) && cached.length > 0) {
                // Already cached, skip
                return;
            }
            if (!works || !Array.isArray(works)) {
                // If works is null or not an array, mark as pending
                addPending(id);
                return;
            }

            cacheHelper.addEntry(id, works);
            clearPending(id);
        }


        function getWorks(id) {
            if (!isEnabled()) {
                return [];
            }
            if (!id) {
                throw new Error("Invalid ID");
            }
            id = extractUserFromUrl(id);
            if (!id) {
                throw new Error("Invalid ID format");
            }
            const cached = cacheHelper.getCacheByKey(id);
            return cached?.item || [];
        }
        function removeExpiredEntries() {
            cacheHelper.removeExpiredEntries();
        }

        function getCitesByDOI(doi) {
            if (!doi || doi.length === 0) {
                throw new Error("Invalid DOI provided");
            }
            if (typeof doi !== "string") {
                throw new Error("DOI must be a string");
            }
            const filter = `[tag[bibtex-entry]search:bibtex-doi:regexp[${doi}]]`;
            const tiddlers = $tw.wiki.filterTiddlers(filter);
            if (tiddlers.length === 0) {
                return;
            } 
            if (tiddlers.length > 1) {
                return;
            }
            return tiddlers[0]['scholar-cites'];
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
            const cites = getCitesByDOI(doi);
            if (!cites || cites.length === 0) {
                return [];
            }
            const caches = cacheHelper.getCaches();

            if (!caches || caches.length === 0) {
                return [];
            }
            const result = [];
            for (const key in caches) {
                if (key === pendingKey) {
                    continue;
                }
                if (Object.prototype.hasOwnProperty.call(caches, key)) {
                    const cache = caches[key];
                    if (!cache.item || !Array.isArray(cache.item)) {
                        continue;
                    }
                    if (cache.item.some(item => item && item === cites)) {
                        result.push(key);
                        continue;
                    }
                }
            }
            if (result.length === 0) {
                return [];
            }
            const filter = `[tag[Colleague]search:google-scholar:regexp[${result.join("|")}]]`;
            const matchingTiddlers = $tw.wiki.filterTiddlers(filter);
            return matchingTiddlers;
        }

        return {
            isEnabled,
            getStatus,
            clearAllPending,
            cacheWorks,
            getWorks,
            addPending,
            getAuthorByDOI,
            getPlatformField: () => platform_field,
            removeExpiredEntries: removeExpiredEntries
        };
    }

    exports.Scholar = Scholar;
})(exports);
