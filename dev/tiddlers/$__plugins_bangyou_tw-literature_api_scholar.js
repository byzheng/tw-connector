/*\
title: $:/plugins/bangyou/tw-literature/utils/scholar.js
type: application/javascript
module-type: library

Google Scholar utility for TiddlyWiki (via external Chrome extension)
\*/
(function (exports) {
    'use strict';
    if (!$tw.node) return;

    const cacheHelper = require('$:/plugins/bangyou/tw-literature/api/cachehelper.js').cacheHelper("scholar", 9999999);
    const crossref = require('$:/plugins/bangyou/tw-literature/api/crossref.js').Crossref();
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
            let tiddler = $tw.wiki.getTiddler("$:/config/tw-literature/authoring/scholar/enable");
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

        function incrementCheckHits(workItem) {
            if (workItem['check-hits'] === undefined) {
                workItem['check-hits'] = 1;
            } else {
                workItem['check-hits'] += 1;
            }
            return workItem;
        }

        function shouldSkipDOILookup(workItem, maxHits = 10) {
            return workItem['check-hits'] !== undefined && workItem['check-hits'] >= maxHits;
        }

        function cacheWorks(id, works) {
            
            if (!isEnabled()) {
                return Promise.resolve();
            }
            if (!id) {
                throw new Error("Invalid ID");
            }
            id = extractUserFromUrl(id);
            if (!id) {
                throw new Error("Invalid ID format");
            }
            const cached = getWorks(id);
            // Get today's date in YYYY-MM-DD format
            const today = new Date().toISOString().split('T')[0];

            // Go through all items in works and update access-date based on cached data
            if (works && Array.isArray(works)) {
                const promises = works.map(workItem => {
                    if (workItem && workItem.cites) {
                        // Find matching item in cached based on cites
                        const cachedMatch = cached && Array.isArray(cached) 
                            ? cached.find(cachedItem => cachedItem && cachedItem.cites === workItem.cites)
                            : null;
                        // Use cached access-date if exists, otherwise use today or construct from workItem.year
                        if (cachedMatch && cachedMatch['access-date']) {
                            workItem['access-date'] = cachedMatch['access-date'];
                        } else if (workItem.year) {
                            // Use workItem.year with January 1st
                            workItem['access-date'] = `${workItem.year}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
                        } else {
                            workItem['access-date'] = today;
                        }
                        if (cachedMatch && cachedMatch['check-hits']) {
                            workItem['check-hits'] = cachedMatch['check-hits'];
                        }
                        if (cachedMatch && cachedMatch['doi'] && cachedMatch['doi-similarity']) {
                            workItem['doi'] = cachedMatch['doi'];
                            workItem['doi-similarity'] = cachedMatch['doi-similarity'];
                            workItem['check-hits'] = cachedMatch['check-hits'];
                            return Promise.resolve(workItem);
                        } else if (shouldSkipDOILookup(workItem)) {
                            console.log('Skipping DOI lookup after max hits for:', workItem.title);
                            return Promise.resolve(workItem);
                        } else {
                            // DOI lookup is async, wait for it to complete
                            return crossref.findDOI(workItem.title, workItem.author, workItem.publisher).then(data => {
                                workItem = incrementCheckHits(workItem);
                                if (!data || !data.doi) {
                                    return workItem;
                                }
                                workItem['doi'] = data.doi;
                                workItem['doi-similarity'] = data.similarity;
                                return workItem;
                            }).catch(err => {
                                console.error('Error finding DOI:', err);
                                return workItem;
                            });
                        }
                    }
                    return Promise.resolve(null);
                });

                return Promise.all(promises).then(updatedItems => {
                    // Filter out null items and log
                    const validItems = updatedItems.filter(item => item !== null);
                    // validItems.forEach(item => console.log(JSON.stringify(item)));
                    
                    // Cache the updated works
                    cacheHelper.addEntry(id, validItems);
                    clearPending(id);
                });
            } else if (!works || !Array.isArray(works)) {
                // If works is null or not an array, mark as pending
                addPending(id);
                return Promise.resolve();
            }
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

        // Get latest works within the past 'days' days
        async function getLatest(days = 90) {
            if (!isEnabled()) {
                return [];
            }
            
            // Get cached map of authorId -> colleague name for fast lookup
            //const authoridToColleague = getAuthorIdToColleagueMap();
            
            const works = cacheHelper.getCaches();
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            const recentWorks = [];

            for (const authorId in works) {
                if (authorId === pendingKey) {
                    continue;
                }
                
                if (!Object.prototype.hasOwnProperty.call(works, authorId)) {
                    continue;
                }
                const authorWorks = works[authorId];
                if (!Array.isArray(authorWorks.item)) {
                    continue;
                }
                for (const work of authorWorks.item) {
                    if (!work || !work.doi) {
                        continue;
                    }
                    
                    try {
                        const workCF = await crossref.getWorksByDOI(work.doi, true);
                        
                        if (!workCF || !workCF.message) {
                            continue;
                        }
                        
                        if (!workCF.message.publicationDate) {
                            continue;
                        }
                        
                        const workDate = workCF.message.publicationDate;
                        
                        if (isNaN(workDate.getTime()) || workDate < cutoffDate) {
                            continue;
                        }
                        let workScholar = workCF.message;
                        workScholar.platform = "Google Scholar";
                        recentWorks.push(workScholar);
                    } catch (err) {
                        console.error('Error fetching work by DOI:', err);
                    }
                }
            }
            
            console.log("Recent works from Google Scholar:", recentWorks.length);
            return recentWorks;
        }

        return {
            isEnabled,
            getStatus,
            clearAllPending,
            cacheWorks,
            getWorks,
            addPending,
            getAuthorByDOI,
            getLatest,
            getPlatformField: () => platform_field,
            removeExpiredEntries: removeExpiredEntries
        };
    }

    exports.Scholar = Scholar;
})(exports);
