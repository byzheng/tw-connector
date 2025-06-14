/*\
title: $:/plugins/bangyou/tw-connector/api/authoring.js
type: application/javascript
module-type: library

Works for TiddlyWiki

\*/

(function (exports) {
    'use strict';

    // use cache

    var helper = require('$:/plugins/bangyou/tw-connector/utils/helper.js').Helper();
    var platforms = [
        require('$:/plugins/bangyou/tw-connector/api/wos.js').WOS(),
        // Add other platforms here, e.g.:
        // require('$:/plugins/bangyou/tw-connector/api/scopus.js').Scopus(),
        // require('$:/plugins/bangyou/tw-connector/api/google-scholar.js').GoogleScholar()
    ];
    function Authoring() {
        
        async function updateCache() {
            const filter = "[tag[Colleague]!has[draft.of]]";
            const tiddlers = $tw.wiki.filterTiddlers(filter);
            for (const tiddlerTitle of tiddlers) {
                const tiddler = $tw.wiki.getTiddler(tiddlerTitle);
                if (!(tiddler && tiddler.fields))) {
                    continue;
                }
                for (const platform of platforms) {
                    const platformField = platform.getPlatformField();
                    if (!platformField || !tiddler.fields[platformField]) {
                        continue; // Skip if the platform field is not defined or empty
                    }
                    const id = tiddler.fields[platformField];
                    if (!id || id === "") {
                        continue; // Skip if the researcher ID is not defined or empty
                    }
                    try {
                        await platform.works(id);
                    } catch (error) {
                        console.error(`Error updating cache for ${platform.constructor.name} with researcher ID ${id}:`, error);
                    }
                }
            }
        }

        // get author for a tiddler entry
        /**
         * Fetches the author information for a given tiddler entry in TiddlyWiki.
         * @param {string} entry - The title of the tiddler to fetch author information from.
         * @returns {Promise<string>} - A promise that resolves to the author information.
         * @throws {Error} - Throws an error if the entry is not provided, is empty, or if the tiddler does not exist or lacks required fields.
         */
        async function bibtex(entry) {
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
            // Return the bibtex field
            const dois = helper.extractDOIs(tiddler.fields['bibtex-doi']);
            if (dois.length === 0) {
                throw new Error(`No valid DOIs found in tiddler "${entry}"`);
            }   
            const doi = dois[0]; // Use the first DOI found
            // get author from all platforms
            let authors = [];
            for (const platform of platforms) {
                try {
                    const author_platform = platform.authorDOI(doi);
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
            bibtex: bibtex
        };

    }


    exports.Authoring = Authoring;
})(exports);


