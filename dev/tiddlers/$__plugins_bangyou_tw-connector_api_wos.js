/*\
title: $:/plugins/bangyou/tw-connector/utils/wos.js
type: application/javascript
module-type: library

Web of Science utility for TiddlyWiki

\*/


(function (exports) {
    'use strict';
    if (!$tw.node) {
        return;
    }
    const fetch = require('node-fetch');
    const cacheHelper = require('$:/plugins/bangyou/tw-connector/api/cachehelper.js').cacheHelper("wos", 9999999);
    const wos_daily_request_count_key = "__wos_daily_request_count";
    
    const platform_field = "researcherid"; // Field in tiddler that contains the WOS researcher ID

    function WOS(host = "https://api.clarivate.com") {
        const this_host = host.replace(/\/+$/, "");
        const path_document = "/apis/wos-starter/v1/documents"

        function isEnabled() {
            let tiddler = $tw.wiki.getTiddler("$:/config/tw-connector/authoring/wos/enable");
            if (!tiddler) {
                return true; // default to enabled ("yes")
            }
            return tiddler && tiddler.fields.text === "enable";
        }
        function getWOSDailyLimit() {
            // In TiddlyWiki, global $tw object provides access to tiddlers
            if (typeof $tw !== "undefined" && $tw.wiki) {
                const limitText = $tw.wiki.getTiddlerText("$:/config/tw-connector/authoring/wos/daily-limit", "").trim();
                const limit = parseInt(limitText, 10);
                return isNaN(limit) ? 5000 : limit; 
            }
            return 5000;
        }
        function getWOSApiKey() {
            // In TiddlyWiki, global $tw object provides access to tiddlers
            if (typeof $tw !== "undefined" && $tw.wiki) {
                return $tw.wiki.getTiddlerText("$:/config/tw-connector/authoring/wos/api", "").trim();
            }
            return "";
        }
        function buildWOSApiUrl(path, query = {}) {
            const normalizedPath = path.startsWith("/") ? path : `/${path}`;
            const queryString = Object.keys(query)
                .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(query[key]))
                .join('&');
            return `${this_host}${normalizedPath}${queryString ? `?${queryString}` : ""}`;
        }
        function getDailyRequestCount() {
            const today = new Date().toISOString().slice(0, 10);
            let countObj = cacheHelper.getCacheByKey(wos_daily_request_count_key);
            if (!countObj || !countObj.item || countObj.item.day !== today) {
                countObj = { count: 0, day: today };
                cacheHelper.addEntry(wos_daily_request_count_key, countObj, undefined, false);
                return (0)
            }
            return typeof countObj.item.count === "number" ? countObj.item.count : 0;
        }
        async function wosRequest(url) {
            const currentCount = getDailyRequestCount();
            const wos_daily_limit = getWOSDailyLimit();
            if (currentCount >= wos_daily_limit) {
                throw new Error(`Daily request limit of ${wos_daily_limit} for Web of Science API has been reached.`);
            }
            const apiKey = getWOSApiKey();
            if (!apiKey || apiKey === "") {
                console.error("Web of Science API key is not configured. Please set it in $:/config/tw-connector/api/wos tiddler.");
                return;
            }
            const headers = {
                "X-ApiKey": apiKey
            };
            const response = await fetch(url, { headers });
            const today = new Date().toISOString().slice(0, 10);
            const countObj = { count: currentCount + 1, day: today };
            //console.log(`Web of Science API request count for today (${today}): ${countObj.count}`);
            cacheHelper.addEntry(wos_daily_request_count_key, countObj, undefined, false);
            // Simulate a delay to avoid hitting rate limits too quickly
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        }


        async function wosWorksGet(query) {
            // Helper to request a page of results
            async function wosStarterRequest({ query, page = 1, limit = 50 }) {
                const url = buildWOSApiUrl(path_document, { q: query, page, limit });

                return await wosRequest(url);
            }

            const firstPage = await wosStarterRequest({ query, page: 1, limit: 50 });
            const worksTotal = firstPage.metadata && firstPage.metadata.total ? firstPage.metadata.total : 0;
            const pagesTotal = Math.ceil(worksTotal / 50);
            let allHits = firstPage.hits || [];

            if (pagesTotal > 1) {
                for (let i = 2; i <= pagesTotal; i++) {
                    const pageResult = await wosStarterRequest({ query, page: i, limit: 50 });
                    if (pageResult.hits) {
                        allHits = allHits.concat(pageResult.hits);
                    }
                }
            }
            return allHits;
        }

        function extractResearchId(input) {
            if (!input) return "";
            // If input is just the id (e.g., "A-1234-5678"), return as is
            if (/^[A-Z]-\d{4}-\d{4}$/i.test(input)) {
                return input;
            }
            // Try to extract from known URL patterns
            const match = input.match(/(?:\/record\/|\/author\/record\/)([A-Z]-\d{4}-\d{4})/i);
            return match ? match[1] : input;
        }
        async function cacheWorks(researcherid) {
            if (!isEnabled()) {
                return;
            }
            researcherid = decodeURIComponent(researcherid);
            if (!researcherid || researcherid.length === 0) {
                throw new Error("Invalid researcherid provided");
            }
            researcherid = extractResearchId(researcherid);
            if (!researcherid || researcherid.length === 0) {
                throw new Error(`Tiddler ${colleague} has no valid researcherid field for web of science`);
            }
            const cacheResult = cacheHelper.getCacheByKey(researcherid);
            if (cacheResult) {
                return cacheResult.item;
            }
            const works = await wosWorksGet(`AI=${researcherid}`);
            await cacheHelper.addEntry(researcherid, works);

            return works;
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
                if (key === wos_daily_request_count_key) {
                    continue; // Skip the daily request count cache
                }
                if (Object.prototype.hasOwnProperty.call(caches, key)) {
                    const cache = caches[key];
                    for (const item of cache.item) {
                        if (item && item.identifiers && item.identifiers.doi &&
                            item.identifiers.doi.toLowerCase() === doi.toLowerCase()) {
                            result.push(key);
                            break;
                        }
                    }
                }
            }
            // Find tiddlers whose 'researcherid' field matches any key in result using a filter
            if (result.length === 0) {
                return [];
            }
            const filter = `[tag[Colleague]search:researcherid:regexp[${result.join("|")}]]`;
            const matchingTiddlers = $tw.wiki.filterTiddlers(filter);
            return matchingTiddlers;
        }
        function removeExpiredEntries() {
            cacheHelper.removeExpiredEntries();
        }

        // Get latest works within the past 'days' days
        function getLatest(days = 90) {
            if (!isEnabled()) {
                return [];
            }
            
            const works = cacheHelper.getCaches();
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            const recentWorks = [];

            for (const colleagueId in works) {
                if (colleagueId === wos_daily_request_count_key) {
                    continue;
                }
                
                if (!Object.prototype.hasOwnProperty.call(works, colleagueId)) {
                    continue;
                }
                const colleagueWorks = works[colleagueId];
                if (!Array.isArray(colleagueWorks.item)) {
                    continue;
                }
                for (const work of colleagueWorks.item) {
                    if (!work || !work['source']) {
                        continue;
                    }
                    const pubDate = work['source'];
                    if (!pubDate.publishYear) {
                        continue;
                    }
                    if (!pubDate.publishMonth) {
                        continue;
                    }
                    const year = pubDate.publishYear;
                    const month = pubDate.publishMonth;
                    // Parse month and year from strings (e.g., "AUG 25" and "2025")
                    const workDate = new Date(`${month}, ${year}`);
                    if (workDate < cutoffDate) {
                        continue;
                    }
                    
                    if (!work.identifiers || !work.identifiers.doi || work.identifiers.doi === "") {
                        continue;
                    }
                    const doi = work.identifiers.doi;
                    recentWorks.push({
                        colleagueId: colleagueId,
                        // work: work,
                        doi: doi,
                        title: work.title ? work.title : "",
                        publicationDate: workDate,
                        platform: "Web of Science" 
                    });
                }
            }

            return recentWorks;
        }
        return {
            isEnabled: isEnabled,
            cacheWorks: cacheWorks,
            getAuthorByDOI: getAuthorByDOI,
            getPlatformField: function () {
                return platform_field;
            },
            removeExpiredEntries: removeExpiredEntries,
            getLatest: getLatest
        };

    }


    exports.WOS = WOS;
})(exports);


