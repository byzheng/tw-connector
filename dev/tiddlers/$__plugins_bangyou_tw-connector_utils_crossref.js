/*\
title: $:/plugins/bangyou/tw-connector/utils/crossref.js
type: application/javascript
module-type: library

Crossref API

\*/


'use strict';


"use strict";

function Crossref(host = "https://api.crossref.org/") {
    const this_host = host;


    // Perform a request to crossref
    var buildCrossRefApiUrl = function (path, query = {}) {
        const host = "https://api.crossref.org/"
        const normalizedHost = host.replace(/\/+$/, "");

        // Ensure the path starts with a single slash
        const normalizedPath = path.startsWith("/") ? path : `/${path}`;

        // Convert query object to URL search parameters
        const queryString = new URLSearchParams(query).toString();

        // Construct the full URL
        return `${normalizedHost}${normalizedPath}${queryString ? `?${queryString}` : ""}`;
    }

    var crossrefRequest = function (url) {
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Crossref request failed: ${response.status} ${response.statusText}`);
                }
                return response.json();
            });
        
    }

    // Fetch first PDF attachment for an item
    var crossrefWorks = function (doi) {
        const path = "/works/" + doi;
        const query = {};

        const url = buildCrossRefApiUrl(path, query);
        return crossrefRequest(url);
    }

    this.crossrefWorks = crossrefWorks;
}

exports.Crossref = Crossref;
