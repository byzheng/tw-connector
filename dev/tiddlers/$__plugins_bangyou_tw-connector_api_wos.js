/*\
title: $:/plugins/bangyou/tw-connector/utils/wos.js
type: application/javascript
module-type: library

Web of Science utility for TiddlyWiki

\*/

(function (exports) {
    'use strict';

    const fs = require('fs');
    const path = require('path');
    const zlib = require('zlib');
    const fetch = require('node-fetch');

    // use cache


    const cacheHelper = require('$:/plugins/bangyou/tw-connector/api/cachehelper.js');

    const wosCache = cacheHelper('wos');

    function getWOSApiKey() {
        // In TiddlyWiki, global $tw object provides access to tiddlers
        if (typeof $tw !== "undefined" && $tw.wiki) {
            return $tw.wiki.getTiddlerText("$:/config/tw-connector/api/wos", "").trim();
        }
        return "";
    }

    function WOS(host = "https://api.clarivate.com/apis/wos-starter/v1/documents") {
        const this_host = host.replace(/\/+$/, "");
        function buildWOSApiUrl(path, query = {}) {
            const normalizedPath = path.startsWith("/") ? path : `/${path}`;
            const queryString = Object.keys(query)
                .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(query[key]))
                .join('&');
            return `${this_host}${normalizedPath}${queryString ? `?${queryString}` : ""}`;
        }
        async function wosRequest(url) {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        }

    }


    exports.WOS = WOS;
})(exports);