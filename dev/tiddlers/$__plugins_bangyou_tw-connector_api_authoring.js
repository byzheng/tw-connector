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
 *
 * @example
 * const authoring = require('$:/plugins/bangyou/tw-connector/api/authoring.js').Authoring();
 * authoring.cacheUpdate();
 * const authors = authoring.bibtex("Some Tiddler Title");
 */



(function (exports) {
    'use strict';
    if (!$tw.node) {
        return;
    }
    // use cache

    var helper = require('$:/plugins/bangyou/tw-connector/utils/helper.js').Helper();
    var platforms = [
        require('$:/plugins/bangyou/tw-connector/api/wos.js').WOS(),
        require('$:/plugins/bangyou/tw-connector/api/homepage.js').Homepage(),
        require('$:/plugins/bangyou/tw-connector/api/orcid.js').ORCID()
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
        }

        function startUpdate() {
            if (isUpdating) return false;
            isUpdating = true;
            updateProgress = {
                started: true,
                finished: false,
                current: 0,
                total: 0,
                lastUpdated: new Date()
            };

            setImmediate(async () => {
                try {
                    await cacheUpdate();
                } catch (err) {
                    console.error('Cache update error:', err);
                } finally {
                    isUpdating = false;
                    updateProgress.finished = true;
                    updateProgress.lastUpdated = new Date();
                }
            });

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

        return {
            getAuthorByTiddler: getAuthorByTiddler,
            getAuthorByDOI: getAuthorByDOI,
            isUpdating: () => isUpdating,
            getProgress: () => updateProgress,
            startUpdate: startUpdate
        };

    }


    exports.Authoring = Authoring;
})(exports);


