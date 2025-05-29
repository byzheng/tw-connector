/*\
title: $:/plugins/bangyou/tw-connector/script/highlight.js
type: application/javascript
module-type: library
Utils functions

\*/


'use strict';



function getURL(document) {
    var urlSelt = [
        "meta[name='prism.url' i]",
        "meta[property='og:url' i]"
    ]
    var url;
    for (let i = 0; i < urlSelt.length; i++) {

        var ele = document.querySelector(urlSelt[i]);
        if (ele === undefined || ele === null) {
            continue;
        }
        var attributes = ["content", "href"];
        for (let j = 0; j < attributes.length; j++) {
            url = ele.getAttribute(attributes[j]);
            if (url) {
                break;
            }
        }
        break;
    }
    return url;
}


// Function to get article content for a literature
function getArticle(document) {
    const url = getURL(document);
    if (!url) {
        response.writeHead(500, { "Content-Type": "text/plain" });
        response.end("No valid URL found in the HTML content");
        console.log("No valid URL found in the HTML content");
        return;
    }
    console.log("Found URL:", url);
    // Remove existing script tags
    const scripts = document.querySelectorAll('script');
    console.log("Removing existing script tags:", scripts.length);
    scripts.forEach(script => script.remove());

    // only keep article
    // Define selectors to keep (and their children)
    const keepSelectors = ['div#article__content', 'style'];

    const clones = [];
    keepSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            clones.push(el.cloneNode(true)); // true = deep clone
        });
    });

    document.body.innerHTML = '';
    clones.forEach(clone => {
        document.body.appendChild(clone);
    });
    return document

}
exports.getArticle = getArticle;
