/*\
title: $:/plugins/bangyou/tw-connector/utils/literature.js
type: application/javascript
module-type: library
Utils functions

\*/


'use strict';


function Literature() {


    function card(items) {
        let result = document.createElement('div');
        result.className = "tw-literature-list";
        if (!Array.isArray(items) || items.length === 0) {
            result.innerHTML = "No references found.";
            return result;
        }

        for (const item of items) {
            const refItem = document.createElement('div');
            refItem.className = "tw-literature-item";

            // Create a title item with a link to the DOI
            const titleItem = document.createElement('div');
            titleItem.className = "tw-literature-title";

            const titleItemSpan = document.createElement('span');
            titleItemSpan.className = "tw-literature-title-text";
            //titleItemSpan.innerHTML = result.title || "No title available";
            if (item.doi) {
                const doiLink = document.createElement('a');
                doiLink.href = item.doi;
                doiLink.target = "_blank";
                doiLink.rel = "noopener noreferrer";
                doiLink.className = "tw-literature-doi-link";
                doiLink.innerHTML = item.title || "No title available";
                titleItemSpan.appendChild(doiLink);
            }
            titleItem.appendChild(titleItemSpan);
            refItem.appendChild(titleItem);

            // Create a div for the authors
            const authorsDiv = document.createElement('div');
            authorsDiv.className = "literature-authors";

            let authorsEle = []
            if (Array.isArray(item.authorships) && item.authorships.length > 0) {
                for (const author of item.authorships) {
                    const authorSpan = document.createElement('span');
                    authorSpan.className = "tw-literature-author";
                    authorSpan.textContent = author.author.display_name || "Unknown Author";
                    authorsEle.push(authorSpan);
                }
                authorsEle.forEach((el, idx) => {
                    authorsDiv.appendChild(el);
                    if (idx < authorsEle.length - 1) {
                        authorsDiv.appendChild(document.createTextNode(', '));
                    }
                });

            } else {
                authorsDiv.textContent = "No authors available";
            }


            refItem.appendChild(authorsDiv);
            result.appendChild(refItem);
        }
        return result;
    }

    return {
        card: card
    };
}


exports.Literature = Literature;
