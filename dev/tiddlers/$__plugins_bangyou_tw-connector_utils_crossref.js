/*\
title: $:/plugins/bangyou/tw-connector/utils/crossref.js
type: application/javascript
module-type: library

Crossref API

\*/

'use strict';
const fetch = require("node-fetch"); // Required even in Node 20 under TiddlyWiki



function Crossref(host = "https://api.crossref.org/") {
    const this_host = host.replace(/\/+$/, "");

    function buildCrossRefApiUrl(path, query = {}) {
        const normalizedPath = path.startsWith("/") ? path : `/${path}`;
        const queryString = Object.keys(query)
            .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(query[key]))
            .join('&');
        return `${this_host}${normalizedPath}${queryString ? `?${queryString}` : ""}`;
    }

    async function crossrefRequest(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }

    async function works(doi) {
        const path = `/works/${encodeURIComponent(doi)}`;
        const url = buildCrossRefApiUrl(path);
        return crossrefRequest(url);
    }

    return {
        works
    };
}

exports.Crossref = Crossref;
