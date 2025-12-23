/*\
title: $:/plugins/bangyou/tw-connector/api/authoring.js
type: application/javascript
module-type: library
\*/

/**
 * Authoring module for TiddlyWiki, providing utilities for author information retrieval and cache management
 * across multiple platforms.
 *
 * @module $:/plugins/bangyou/tw-connector/api/authoring.js
 * @type {application/javascript}
 * @library
 *
 * @returns {Object} An object containing the following methods:
 *   - bibtex(entry): Fetches author information for a given tiddler entry.
 *   - cacheUpdate(): Updates the cache for works associated with all platforms and relevant tiddlers.
 *   - getAuthorByDOI(str): Retrieves author information from all platforms using a DOI string.
 *   - getLatest(days): Retrieves recent items from all platforms published within the specified number of days.
 *
 * @example
 * const authoring = require('$:/plugins/bangyou/tw-connector/api/authoring.js').Authoring();
 * authoring.cacheUpdate();
 * const authors = authoring.bibtex("Some Tiddler Title");
 * const recentItems = authoring.getLatest(30); // Get items from last 30 days
 */



(function (exports) {
    'use strict';
    if (!$tw.node) {
        return;
    }
    // use cache

    var helper = require('$:/plugins/bangyou/tw-connector/utils/helper.js').Helper();
    const cacheHelper = require('$:/plugins/bangyou/tw-connector/api/cachehelper.js').cacheHelper('authoring', 9999999);
    const Reading = require('$:/plugins/bangyou/tw-connector/api/reading.js').Reading;

    var platforms = [
        require('$:/plugins/bangyou/tw-connector/api/wos.js').WOS(),
        require('$:/plugins/bangyou/tw-connector/api/homepage.js').Homepage(),
        require('$:/plugins/bangyou/tw-connector/api/orcid.js').ORCID(),
        require('$:/plugins/bangyou/tw-connector/api/scholar.js').Scholar(),
        require('$:/plugins/bangyou/tw-connector/api/openalex.js').OpenAlex()
    ];
    function Authoring() {
        let isUpdating = false;
        let updateProgress = {
            started: false,
            finished: false,
            current: 0,
            total: 0,
            lastUpdated: null
        };
        async function cacheUpdate() {
            isUpdating = true;
            const filter = "[tag[Colleague]!has[draft.of]]";
            const tiddlers = $tw.wiki.filterTiddlers(filter);

            const total = tiddlers.length;
            updateProgress.total = total;
            updateProgress.current = 0;
            updateProgress.lastUpdated = new Date();

            // remove cache for all platforms
            for (const platform of platforms) {
                try {
                    if (typeof platform.clearAllPending === "function") {
                        platform.clearAllPending();
                    }
                    await platform.removeExpiredEntries();
                } catch (error) {
                    console.error(`Error clearing cache for ${platform.constructor.name}:`, error);
                }
            }

            for (const [i, tiddlerTitle] of tiddlers.entries()) {
                const tiddler = $tw.wiki.getTiddler(tiddlerTitle);
                if (!(tiddler && tiddler.fields)) continue;

                for (const platform of platforms) {
                    const platformField = platform.getPlatformField();
                    if (!platformField || !tiddler.fields[platformField]) continue;

                    const ids = $tw.utils.parseStringArray(tiddler.fields[platformField]);
                    for (const id of ids) {
                        if (!id) continue;
                        try {
                            await platform.cacheWorks(id);
                        } catch (error) {
                            console.error(`Error updating cache for ${platform.constructor.name} with ID ${id}:`, error);
                        }
                    }
                }

                updateProgress.current = i + 1;
                updateProgress.lastUpdated = new Date();
            }

            updateProgress.finished = true;
            updateProgress.lastUpdated = new Date();
            console.log("Cache update completed.");
            return;
        }

        function startUpdate() {
            if (isUpdating) return false;
            isUpdating = true;
            // updateProgress = {
            //     started: true,
            //     finished: false,
            //     current: 0,
            //     total: 0,
            //     lastUpdated: new Date()
            // };

            setTimeout(async () => {
                try {
                    await cacheUpdate();
                } catch (err) {
                    console.error('Cache update error:', err);
                } finally {
                    isUpdating = false;
                    updateProgress.finished = true;
                    updateProgress.lastUpdated = new Date();
                }
            }, 0);

            return true;
        }

        function getAuthorByTiddler(entry) {
            if (!entry) {
                throw new Error('No entry provided for bibtex conversion');
            }
            if (entry.length === 0) {
                throw new Error('Empty entry provided for bibtex conversion');
            }
            // Fetch the tiddler with the given title
            const tiddler = $tw.wiki.getTiddler(entry);
            if (!tiddler) {
                throw new Error(`Tiddler with title "${entry}" not found`);
            }
            // Check if the tiddler has required fields (example: 'bibtex')
            if (!tiddler.fields || !tiddler.fields['bibtex-doi']) {
                throw new Error(`Tiddler "${entry}" does not contain a 'bibtex-doi' field`);
            }
            const authors = getAuthorByDOI(tiddler.fields['bibtex-doi']);
            return authors;
        }

        function getAuthorByDOI(str) {
            if (!str) {
                throw new Error('No DOI provided for author retrieval');
            }
            if (typeof str !== 'string') {
                throw new Error('Invalid DOI format');
            }
            const dois = helper.extractDOIs(str);
            if (dois.length === 0) {
                throw new Error('No valid DOIs found in the provided string');
            }
            const doi = dois[0]; // Use the first DOI found
            // get author from all platforms
            
            let authors = [];
            for (const platform of platforms) {
                try {
                    if (typeof platform.getAuthorByDOI !== 'function') {
                        return;
                    }
                    const author_platform = platform.getAuthorByDOI(doi);
    
                    if (author_platform) {
                        authors.push(author_platform);
                    }
                } catch (error) {
                    console.error(`Error fetching author from ${platform.constructor.name}:`, error);
                }
            }
            authors = [...new Set(authors.flat())];
            return authors;
        }

        function getLatest(days) {
            if (!days || typeof days !== 'number' || days <= 0) {
                throw new Error('Invalid days parameter: must be a positive number');
            }
            
            let allItems = [];

            // Get the list of read DOIs from cache
            const reading = new Reading();
            const readDOIs = reading.getReadDOIs();
            // Iterate through all platforms and collect recent items
            for (const platform of platforms) {
                try {
                    if (typeof platform.getLatest !== 'function') {
                        continue;
                    }
                    const items = platform.getLatest(days);
                    if (items && Array.isArray(items)) {
                        // Filter out items that have been marked as read
                        const unreadItems = items.filter(item => {
                            if (!item.doi) return true; // Keep items without DOI
                            const cleanDoi = item.doi.replace('https://doi.org/', '').replace('http://doi.org/', '');
                            return !readDOIs.includes(cleanDoi);
                        });
                        allItems = allItems.concat(unreadItems);
                    }
                } catch (error) {
                    console.error(`Error processing platform ${platform.constructor.name}:`, error);
                }
            }
            return allItems;
        }



        return {
            getAuthorByTiddler: getAuthorByTiddler,
            getAuthorByDOI: getAuthorByDOI,
            getLatest: getLatest,
            isUpdating: () => isUpdating,
            getUpdateProgress: () => updateProgress,
            startUpdate: startUpdate
        };

    }


    exports.Authoring = Authoring;
})(exports);


