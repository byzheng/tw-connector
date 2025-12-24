/*\
title: $:/plugins/bangyou/tw-literature/api/homepage.js
type: application/javascript
module-type: library

Authoring publication from homepage. Assume all dois in the homepage are published by the author
\*/

(function (exports) {
    'use strict';
    if (!$tw.node) {
        return;
    }
    const fetch = require('node-fetch');

    // use cache

    const helper = require('$:/plugins/bangyou/tw-literature/utils/helper.js').Helper();
    const cacheHelper = require('$:/plugins/bangyou/tw-literature/api/cachehelper.js').cacheHelper("homepage", 9999999);

    const platform_field = "url"; // Field in tiddler that contains the WOS researcher ID

    function Homepage() {

        function isEnabled() {
            let tiddler = $tw.wiki.getTiddler("$:/config/tw-literature/authoring/homepage/enable");
            if (!tiddler) {
                return true; // default to enabled ("yes")
            }
            return tiddler && tiddler.fields.text === "enable";
        }
        async function cacheWorks(url) {
            if (!isEnabled()) {
                return;
            }
            if (!url || typeof url !== "string") {
                throw new Error("Invalid URL provided");
            }
            const cacheResult = cacheHelper.getCacheByKey(url);
            if (cacheResult) {
                return cacheResult.item;
            }
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    await cacheHelper.addEntry(url, []);
                    return;
                }
                const html = await response.text();
                const dois = helper.extractDOIs(html);
                await cacheHelper.addEntry(url, dois);
                return dois;
            } catch (err) {
                console.error("Error processing request:", err.message);
                await cacheHelper.addEntry(url, []);
            }


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
            let matchedUrls = [];
            for (const key in caches) {
                if (Object.prototype.hasOwnProperty.call(caches, key)) {
                    const cache = caches[key];
                    if (!Array.isArray(cache.item)) continue;
                    if (cache.item.some(d => typeof d === "string" && d.toLowerCase() === doi.toLowerCase())) {
                        matchedUrls.push(key);
                        break;
                    }
                }
            }
            if (matchedUrls.length === 0) {
                return [];
            }
            let results = [];
            for (matchedUrl in matchedUrls) {
                const filter = `[tag[Colleague]] :filter[get[url]match:caseinsensitive[${matchedUrl}]]`;
                const matchingTiddlers = $tw.wiki.filterTiddlers(filter);
                if (matchingTiddlers.length > 0) {
                    results.push(matchingTiddlers);
                }
            }
            return results;
        }

        function removeExpiredEntries() {
            cacheHelper.removeExpiredEntries();
        }
        return {
            isEnabled: isEnabled,
            cacheWorks: cacheWorks,
            getAuthorByDOI: getAuthorByDOI,
            getPlatformField: function () {
                return platform_field;
            },
            removeExpiredEntries: removeExpiredEntries
        };

    }


    exports.Homepage = Homepage;
})(exports);


