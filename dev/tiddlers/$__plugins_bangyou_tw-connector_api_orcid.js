/*\
title: $:/plugins/bangyou/tw-connector/utils/wos.js
type: application/javascript
module-type: library

Web of Science utility for TiddlyWiki

\*/
/*\
title: $:/plugins/bangyou/tw-connector/utils/orcid.js
type: application/javascript
module-type: library

ORCID utility for TiddlyWiki

\*/
(function (exports) {
    'use strict';
    if (!$tw.node) {
        return;
    }
    const fetch = require('node-fetch');
    
    const orcid_daily_request_count_key = "__orcid_daily_request_count";
    const platform_field = "orcid"; // Field in tiddler that contains the ORCID ID
    const cacheHelper = require('$:/plugins/bangyou/tw-connector/api/cachehelper.js').cacheHelper("orcid", 9999999);
    function ORCID(host = "https://pub.orcid.org") {
        const this_host = host.replace(/\/+$/, "");
        const path_works = "/v3.0";

        function isEnabled() {
            let tiddler = $tw.wiki.getTiddler("$:/config/tw-connector/authoring/orcid/enable");
            if (!tiddler) {
                return true; // default to enabled ("yes")
            }
            return tiddler && tiddler.fields.text === "enable";
        }
        function getORCIDDailyLimit() {
            if (typeof $tw !== "undefined" && $tw.wiki) {
                const limitText = $tw.wiki.getTiddlerText("$:/config/tw-connector/authoring/orcid/daily-limit", "").trim();
                const limit = parseInt(limitText, 10);
                return isNaN(limit) ? 25000 : limit;
            }
            return 25000;
        }
        function buildORCIDApiUrl(orcid, endpoint = "record") {
            return `${this_host}${path_works}/${encodeURIComponent(orcid)}/${endpoint}`;
        }
        function getDailyRequestCount() {
            const today = new Date().toISOString().slice(0, 10);
            let countObj = cacheHelper.getCacheByKey(orcid_daily_request_count_key);
            if (!countObj || !countObj.item || countObj.item.day !== today) {
                countObj = { count: 0, day: today };
                cacheHelper.addEntry(orcid_daily_request_count_key, countObj, undefined, false);
                return 0;
            }
            return typeof countObj.item.count === "number" ? countObj.item.count : 0;
        }
        async function orcidRequest(url) {
            const currentCount = getDailyRequestCount();
            const orcid_daily_limit = getORCIDDailyLimit();
            if (currentCount >= orcid_daily_limit) {
                throw new Error(`Daily request limit of ${orcid_daily_limit} for ORCID API has been reached.`);
            }
            const headers = {
                "Accept": "application/json"
            };
            const response = await fetch(url, { headers });
            const today = new Date().toISOString().slice(0, 10);
            const countObj = { count: currentCount + 1, day: today };
            console.log(`ORCID API request count for today (${today}): ${countObj.count}`);
            cacheHelper.addEntry(orcid_daily_request_count_key, countObj, undefined, false);
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        }

        async function orcidWorksGet(orcid) {
            const url = buildORCIDApiUrl(orcid, "works");
            const data = await orcidRequest(url);
            // ORCID returns works in data.group
            let works = [];
            if (data && Array.isArray(data.group)) {
                works = data.group.map(g => {
                    const workSummary = g['work-summary'] && g['work-summary'][0] ? g['work-summary'][0] : {};
                    const doi = (workSummary.externalIds && workSummary.externalIds.externalId || [])
                        .filter(eid => eid.externalIdType === "doi")
                        .map(eid => eid.externalIdValue)[0] || "";
                    return {
                        title: workSummary.title && workSummary.title.title && workSummary.title.title.value,
                        identifiers: { doi },
                        ...workSummary
                    };
                });
            }
            return works;
        }

        function extractORCID(input) {
            if (!input) return "";
            // If input is just the id (e.g., "0000-0002-1825-0097"), return as is
            if (/^\d{4}-\d{4}-\d{4}-\d{3}[0-9X]$/.test(input)) {
                return input;
            }
            // Try to extract from known URL patterns
            const match = input.match(/orcid\.org\/(\d{4}-\d{4}-\d{4}-\d{3}[0-9X])/i);
            return match ? match[1] : input;
        }

        async function cacheWorks(orcid) {
            if (!isEnabled()) {
                return;
            }
            orcid = decodeURIComponent(orcid);
            if (!orcid || orcid.length === 0) {
                throw new Error("Invalid ORCID provided");
            }
            orcid = extractORCID(orcid);
            if (!orcid || orcid.length === 0) {
                throw new Error(`Tiddler has no valid orcid field`);
            }
            const cacheResult = cacheHelper.getCacheByKey(orcid);
            if (cacheResult) {
                return cacheResult.item;
            }
            const works = await orcidWorksGet(orcid);
            await cacheHelper.addEntry(orcid, works);
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
                if (key === orcid_daily_request_count_key) {
                    continue;
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
            if (result.length === 0) {
                return [];
            }
            const filter = `[tag[Colleague]search:orcid:regexp[${result.join("|")}]]`;
            const matchingTiddlers = $tw.wiki.filterTiddlers(filter);
            return matchingTiddlers;
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

    exports.ORCID = ORCID;
})(exports);
