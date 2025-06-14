/*\
title: $:/plugins/bangyou/tw-connector/api/authoring.js
type: application/javascript
module-type: library

Works for TiddlyWiki

\*/

(function (exports) {
    'use strict';
    const fetch = require('node-fetch');

    // use cache


    function Authoring() {
        async function bibtex(entry) {
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
        return {
            bibtex: bibtex
        };

    }


    exports.Authoring = Authoring;
})(exports);


