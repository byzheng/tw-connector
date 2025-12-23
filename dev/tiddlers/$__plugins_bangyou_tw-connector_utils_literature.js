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
                doiLink.href = item.doi.startsWith('https://doi.org/') ? item.doi : `https://doi.org/${item.doi}`;
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

    function cardFromDOIs(items) {
        let result = document.createElement('div');
        result.className = "tw-literature-list";
        if (!Array.isArray(items) || items.length === 0) {
            result.innerHTML = "No references found.";
            return result;
        }

        for (const item of items) {
            console.log(`Processing item ${items.indexOf(item) + 1} of ${items.length}:`, item);
            
            // Skip items without DOI early
            if (!item.doi) {
                console.warn('Skipping item without DOI:', item);
                continue;
            }

            console.log(`Creating DOM elements for DOI: ${item.doi}`);

            const refItem = document.createElement('div');
            refItem.className = "tw-literature-item";

            // Create a title item with a link to the DOI
            const titleItem = document.createElement('div');
            titleItem.className = "tw-literature-title";

            const titleItemSpan = document.createElement('span');
            titleItemSpan.className = "tw-literature-title-text";

            const doiLink = document.createElement('a');
            doiLink.href = item.doi.startsWith('https://doi.org/') ? item.doi : `https://doi.org/${item.doi}`;
            doiLink.target = "_blank";
            doiLink.rel = "noopener noreferrer";
            doiLink.className = "tw-literature-doi-link";
            doiLink.innerHTML = "Loading...";
            titleItemSpan.appendChild(doiLink);
            titleItem.appendChild(titleItemSpan);
            refItem.appendChild(titleItem);

            // Create a div for the authors
            const authorsDiv = document.createElement('div');
            authorsDiv.className = "literature-authors";
            refItem.appendChild(authorsDiv);
            
            // Add to result immediately after creating the complete structure
            result.appendChild(refItem);
            
            console.log(`Starting async fetch for DOI: ${item.doi}`);
            
            // Fetch data from crossref API (this is async and won't block the loop)
            // Use an immediately invoked async function to ensure complete isolation
            (async (currentItem, currentRefItem, currentDoiLink) => {
                try {
                    const cleanDoi = currentItem.doi.replace('https://doi.org/', '').replace('http://doi.org/', '');
                    console.log(`Fetching crossref data for DOI: ${cleanDoi}`);
                    
                    const response = await fetch(`literature/crossref/${encodeURIComponent(cleanDoi)}`);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const crossref = await response.json();
                    console.log(`Successfully fetched data for DOI: ${cleanDoi}`, crossref);
                    
                    if (!crossref || !crossref.data) {
                        throw new Error('No data found in crossref response');
                    }
                    let crossrefData = crossref.data;

                    if (!crossrefData.message) {
                        throw new Error('No message field in crossref data');
                    }
                    crossrefData = crossrefData.message;
                    // Update title with fetched data
                    if (crossrefData.title && crossrefData.title[0]) {
                        currentDoiLink.innerHTML = crossrefData.title[0];
                    }
                    
                    // Update authors if available
                    if (crossrefData.author && crossrefData.author.length > 0) {
                        const authorsDiv = currentRefItem.querySelector('.literature-authors');
                        if (authorsDiv) {
                            authorsDiv.innerHTML = ''; // Clear existing content
                            const authorNames = crossrefData.author.map(author => 
                                `${author.given || ''} ${author.family || ''}`.trim()
                            ).filter(name => name.length > 0);
                            
                            if (authorNames.length > 0) {
                                authorsDiv.textContent = authorNames.join(', ');
                            } else {
                                authorsDiv.textContent = "No authors available";
                            }
                        }
                    }
                    
                    // Add publication year if available
                    if (crossrefData['published-print'] || crossrefData['published-online']) {
                        const pubDate = crossrefData['published-print'] || crossrefData['published-online'];
                        if (pubDate['date-parts'] && pubDate['date-parts'][0]) {
                            const year = pubDate['date-parts'][0][0];
                            const yearSpan = document.createElement('span');
                            yearSpan.className = "tw-literature-year";
                            yearSpan.textContent = ` (${year})`;
                            currentDoiLink.parentElement.appendChild(yearSpan);
                        }
                    }
                    
                    // Add journal name if available
                    if (crossrefData['container-title'] && crossrefData['container-title'][0]) {
                        let journalDiv = currentRefItem.querySelector('.literature-journal');
                        if (!journalDiv) {
                            journalDiv = document.createElement('div');
                            journalDiv.className = "literature-journal";
                            currentRefItem.appendChild(journalDiv);
                        }
                        journalDiv.innerHTML = `<em>${crossrefData['container-title'][0]}</em>`;
                    }
                    
                } catch (error) {
                    console.warn(`Failed to fetch crossref data for DOI ${currentItem.doi}:`, error);
                    // Keep the original title or show error message for this specific item
                    if (currentDoiLink.innerHTML === "Loading...") {
                        currentDoiLink.innerHTML = currentItem.title || "No title available";
                    }
                    // Set fallback authors
                    const authorsDiv = currentRefItem.querySelector('.literature-authors');
                    if (authorsDiv && !authorsDiv.textContent) {
                        authorsDiv.textContent = "Authors not available";
                    }
                }
            })(item, refItem, doiLink); // Pass current loop variables to avoid closure issues

            console.log(`Completed DOM setup for item ${items.indexOf(item) + 1}, continuing to next item...`);
        }
        
        console.log(`Finished processing all ${items.length} items in the loop`);
        return result;
    }
    return {
        card: card,
        cardFromDOIs: cardFromDOIs
    };
}


exports.Literature = Literature;
