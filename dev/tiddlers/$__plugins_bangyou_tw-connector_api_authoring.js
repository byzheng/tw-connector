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
    var wos = require('$:/plugins/bangyou/tw-connector/api/wos.js').WOS();
    function Authoring() {
        
        // get author for a tiddler entry
        /**
         * Fetches the author information for a given tiddler entry in TiddlyWiki.
         * @param {string} entry - The title of the tiddler to fetch author information from.
         * @returns {Promise<string>} - A promise that resolves to the author information.
         * @throws {Error} - Throws an error if the entry is not provided, is empty, or if the tiddler does not exist or lacks required fields.
         */
        function bibtex(entry) {
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
            // get author from WOS
            const authorWOS = wos.authorDOI(doi);
            return authorWOS;

        }
        return {
            bibtex: bibtex
        };

    }


    exports.Authoring = Authoring;
})(exports);


