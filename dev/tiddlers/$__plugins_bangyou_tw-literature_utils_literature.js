/*\
title: $:/plugins/bangyou/tw-literature/utils/literature.js
type: application/javascript
module-type: library
Utils functions

\*/


'use strict';


function Literature() {

    function createReadButton(cleanDoi, currentRefItem) {
        const readButton = document.createElement('button');
        readButton.className = 'tw-literature-read-button';
        readButton.innerHTML = '✕';
        readButton.title = 'Mark as read';
        readButton.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (readButton.classList.contains('reading')) return;
            
            readButton.classList.add('reading');
            readButton.innerHTML = '⌛';
            readButton.title = 'Marking as read...';
            
            try {
                const response = await fetch('/literature/mark-read', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ doi: cleanDoi })
                });
                
                if (response.ok) {
                    // Hide the refItem with smooth transition
                    currentRefItem.style.transition = 'all 0.5s ease';
                    currentRefItem.style.opacity = '0';
                    currentRefItem.style.transform = 'scale(0.95)';
                    
                    // Completely hide the element after transition
                    setTimeout(() => {
                        currentRefItem.style.display = 'none';
                    }, 500);
                    
                    // Update button to show success
                    readButton.innerHTML = '✓';
                    readButton.title = 'Marked as read';
                    readButton.style.background = '#d1fae5';
                    readButton.style.color = '#059669';
                    readButton.style.borderColor = '#10b981';
                } else {
                    throw new Error('Failed to mark as read');
                }
            } catch (error) {
                console.error('Error marking item as read:', error);
                readButton.classList.remove('reading');
                readButton.innerHTML = '✕';
                readButton.title = 'Mark as read (click to retry)';
                
                // Show error state briefly
                readButton.style.background = '#fee2e2';
                readButton.style.color = '#dc2626';
                setTimeout(() => {
                    readButton.style.background = '';
                    readButton.style.color = '';
                }, 2000);
            }
        });
        return readButton;
    }

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
                const maxAuthors = 5;
                const authorsToShow = item.authorships.slice(0, maxAuthors);
                
                for (const author of authorsToShow) {
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
                
                // Add "and X more" if there are more than maxAuthors
                if (item.authorships.length > maxAuthors) {
                    const moreSpan = document.createElement('span');
                    moreSpan.className = "tw-literature-author-more";
                    moreSpan.textContent = ` and ${item.authorships.length - maxAuthors} more`;
                    moreSpan.style.fontStyle = 'italic';
                    moreSpan.style.color = '#64748b';
                    authorsDiv.appendChild(moreSpan);
                }

            } else {
                authorsDiv.textContent = "No authors available";
            }


            refItem.appendChild(authorsDiv);
            result.appendChild(refItem);
        }
        return result;
    }

    const crossrefCache = new Map();

    function cardFromDOIs(items, current_tiddler) {
        let result = document.createElement('div');
        result.className = "tw-literature-list";
        
        // Create TiddlyWiki story instance once for reuse
        const story = (typeof $tw !== 'undefined' && $tw.wiki) ? new $tw.Story({ wiki: $tw.wiki }) : null;
        var openLinkFromInsideRiver = $tw.wiki.getTiddler("$:/config/Navigation/openLinkFromInsideRiver").fields.text;
        var openLinkFromOutsideRiver = $tw.wiki.getTiddler("$:/config/Navigation/openLinkFromOutsideRiver").fields.text;
        
        if (!Array.isArray(items) || items.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'tw-literature-empty-state';
            emptyState.innerHTML = `
                <div class="tw-literature-empty-icon">📚</div>
                <h3 class="tw-literature-empty-title">No references found</h3>
            `;
            result.appendChild(emptyState);
            return result;
        }

        for (const item of items) {
            // Handle items without DOI with error card
            if (!item.doi) {
                console.warn('Skipping item without DOI:', item);
                
                const refItem = document.createElement('div');
                refItem.className = "tw-literature-item tw-literature-error";
                
                const errorContent = document.createElement('div');
                errorContent.className = 'tw-literature-fallback';
                errorContent.innerHTML = `
                    <div class="tw-literature-fallback-icon">⚠️</div>
                    <h3 class="tw-literature-fallback-title">${item.title || 'No title available'}</h3>
                    <p class="tw-literature-fallback-subtitle">Missing DOI - Cannot load details</p>
                `;
                
                // Add platform information to error case
                const errorFooter = document.createElement('div');
                errorFooter.className = 'tw-literature-footer';
                
                const errorLeftInfo = document.createElement('div');
                errorLeftInfo.className = 'tw-literature-footer-left';
                errorFooter.appendChild(errorLeftInfo);
                
                const errorRightInfo = document.createElement('div');
                errorRightInfo.className = 'tw-literature-footer-right';
                const sourceSpan = document.createElement('span');
                sourceSpan.className = 'tw-literature-source-badge';
                sourceSpan.textContent = `🔗 ${item.platform || 'Unknown'}`;
                errorRightInfo.appendChild(sourceSpan);
                errorFooter.appendChild(errorRightInfo);
                errorContent.appendChild(errorFooter);
                
                refItem.appendChild(errorContent);
                result.appendChild(refItem);
                continue;
            }
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
            
            
            // Fetch data from crossref API (this is async and won't block the loop)
            (async (currentItem, currentRefItem, currentDoiLink, currentTitleItem, currentAuthorsDiv) => {
                try {
                    const cleanDoi = currentItem.doi.replace('https://doi.org/', '').replace('http://doi.org/', '');

                    let crossrefData;
                    
                    // Check if data is already cached
                    if (crossrefCache.has(cleanDoi)) {
                        crossrefData = crossrefCache.get(cleanDoi);
                    } else if (currentItem.platform === "Web of Science" || currentItem.platform === "Scopus") {
                        crossrefData = currentItem;
                    } else {
                        const response = await fetch(`literature/crossref/${encodeURIComponent(cleanDoi)}`);
                        
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        
                        crossrefData = await response.json();
                        if (!crossrefData || !crossrefData.data || !crossrefData.data.message) {
                            throw new Error('Invalid crossref response structure');
                        }
                        crossrefData = crossrefData.data.message;
                        // Cache the successful response
                        crossrefCache.set(cleanDoi, crossrefData);
                    }

                    
                    const data = crossrefData;
                    
                    // Clear the existing simple structure and rebuild with rich content
                    currentRefItem.innerHTML = '';
                    
                    // Create read button
                    const readButton = createReadButton(cleanDoi, currentRefItem);
                    currentRefItem.appendChild(readButton);
                    
                    // Create main content container
                    const contentContainer = document.createElement('div');
                    contentContainer.className = 'tw-literature-content';
                    
                    // Title section
                    const titleSection = document.createElement('div');
                    titleSection.className = 'tw-literature-title-section';
                    
                    const titleElement = document.createElement('h3');
                    titleElement.className = 'tw-literature-title';
                    
                    const titleLink = document.createElement('a');
                    titleLink.href = currentItem.doi.startsWith('https://') ? currentItem.doi : `https://doi.org/${currentItem.doi}`;
                    titleLink.target = '_blank';
                    titleLink.rel = 'noopener noreferrer';
                    titleLink.className = 'tw-literature-title-link';
                    titleLink.innerHTML = data.title || data.title?.[0] || currentItem.title || 'No title available';
                    
                    titleElement.appendChild(titleLink);
                    titleSection.appendChild(titleElement);
                    
                    // DOI badge
                    const doiBadge = document.createElement('span');
                    doiBadge.className = 'tw-literature-doi-badge';
                    doiBadge.textContent = `DOI: ${cleanDoi}`;
                    titleSection.appendChild(doiBadge);
                    
                    contentContainer.appendChild(titleSection);
                    
                    // Authors section
                    const authorsSection = document.createElement('div');
                    authorsSection.className = 'tw-literature-authors-section';
                    
                    if (data.author && data.author.length > 0) {
                        const authorsContainer = document.createElement('div');
                        authorsContainer.className = 'tw-literature-authors-container';
                        
                        const authorsLabel = document.createElement('span');
                        authorsLabel.className = 'tw-literature-authors-label';
                        authorsLabel.textContent = 'Authors:';
                        authorsContainer.appendChild(authorsLabel);
                        
                        const maxAuthors = 5;
                        const authorsToShow = data.author.slice(0, maxAuthors);
                        
                        authorsToShow.forEach((author, index) => {
                            const authorSpan = document.createElement('span');
                            authorSpan.className = 'tw-literature-author-chip';
                            const authorName = `${author.given || ''} ${author.family || ''}`.trim();
                            
                            // Create author name with optional colleague link
                            if (author.colleague) {
                                const colleagueLink = document.createElement('a');
                                colleagueLink.href = `#${encodeURIComponent(author.colleague)}`;
                                colleagueLink.className = 'tc-tiddlylink tc-tiddlylink-resolves';
                                colleagueLink.style.textDecoration = 'none';
                                colleagueLink.style.color = 'inherit';
                                colleagueLink.style.fontWeight = '500';
                                colleagueLink.textContent = author.colleague;
                                colleagueLink.addEventListener('click', function(e) {
                                    e.preventDefault();
                                    if (story) {
                                        story.addToStory(author.colleague, current_tiddler, {
                                            openLinkFromInsideRiver: openLinkFromInsideRiver,
                                            openLinkFromOutsideRiver: openLinkFromOutsideRiver
                                        });
                                        story.addToHistory(author.colleague);
                                    }
                                });
                                authorSpan.appendChild(colleagueLink);
                            } else {
                                const nameText = document.createTextNode(authorName);
                                authorSpan.appendChild(nameText);
                            }
                            
                            // Add identifier links
                            if (author.ORCID) {
                                const orcidUrl = author.ORCID.startsWith('http') ? author.ORCID : `https://orcid.org/${author.ORCID}`;
                                const orcidLink = document.createElement('a');
                                orcidLink.href = orcidUrl;
                                orcidLink.target = '_blank';
                                orcidLink.className = 'tw-literature-author-orcid';
                                orcidLink.title = 'ORCID';
                                orcidLink.textContent = ' 🆔';
                                authorSpan.appendChild(orcidLink);
                            }
                            if (author.researcherId) {
                                const wosLink = document.createElement('a');
                                wosLink.href = `https://www.webofscience.com/wos/author/record/${author.researcherId}`;
                                wosLink.target = '_blank';
                                wosLink.className = 'tw-literature-author-orcid';
                                wosLink.title = 'Web of Science';
                                wosLink.textContent = ' 🔬';
                                authorSpan.appendChild(wosLink);
                            }
                            if (author.authorId) {
                                const scopusLink = document.createElement('a');
                                scopusLink.href = `https://www.scopus.com/authid/detail.uri?authorId=${author.authorId}`;
                                scopusLink.target = '_blank';
                                scopusLink.className = 'tw-literature-author-orcid';
                                scopusLink.title = 'Scopus';
                                scopusLink.textContent = ' 🔍';
                                authorSpan.appendChild(scopusLink);
                            }
                            
                            authorsContainer.appendChild(authorSpan);
                        });
                        
                        // Add "and X more" if there are more than maxAuthors
                        if (data.author.length > maxAuthors) {
                            const moreSpan = document.createElement('span');
                            moreSpan.className = 'tw-literature-author-more';
                            moreSpan.textContent = ` and ${data.author.length - maxAuthors} more`;
                            moreSpan.style.fontStyle = 'italic';
                            moreSpan.style.color = '#64748b';
                            authorsContainer.appendChild(moreSpan);
                        }
                        
                        authorsSection.appendChild(authorsContainer);
                    }
                    
                    contentContainer.appendChild(authorsSection);
                    
                    // Journal and publication info
                    const journalSection = document.createElement('div');
                    journalSection.className = 'tw-literature-journal-section';
                    
                    if (data['container-title']?.[0]) {
                        const journalName = document.createElement('span');
                        journalName.className = 'tw-literature-journal-name';
                        journalName.textContent = data['container-title'][0];
                        journalSection.appendChild(journalName);
                    }
                    
                    if (data.publisher) {
                        const publisherSpan = document.createElement('span');
                        publisherSpan.className = 'tw-literature-publisher';
                        publisherSpan.textContent = data.publisher;
                        journalSection.appendChild(publisherSpan);
                    }
                    
                    const pubDate = data['publicationDate'] || data['published-print'] || data.published;
                    if (pubDate?.['date-parts']?.[0]) {
                        const year = pubDate['date-parts'][0][0];
                        const month = pubDate['date-parts'][0][1];
                        const day = pubDate['date-parts'][0][2];
                        
                        const dateSpan = document.createElement('span');
                        dateSpan.className = 'tw-literature-date-badge';
                        dateSpan.textContent = month ? `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}` : year;
                        journalSection.appendChild(dateSpan);
                    }
                    
                    contentContainer.appendChild(journalSection);
                    
                    // Footer with additional info
                    const footer = document.createElement('div');
                    footer.className = 'tw-literature-footer';
                    footer.style.display = 'flex';
                    footer.style.alignItems = 'center';
                    
                    const leftInfo = document.createElement('div');
                    leftInfo.className = 'tw-literature-footer-left';
                    
                    if (data['reference-count']) {
                        const refsSpan = document.createElement('span');
                        refsSpan.textContent = `📚 ${data['reference-count']} references`;
                        leftInfo.appendChild(refsSpan);
                    }
                    
                    if (data['is-referenced-by-count']) {
                        const citedSpan = document.createElement('span');
                        citedSpan.textContent = `📈 Cited ${data['is-referenced-by-count']} times`;
                        leftInfo.appendChild(citedSpan);
                    }
                    
                    footer.appendChild(leftInfo);
                    
                    const rightInfo = document.createElement('div');
                    rightInfo.className = 'tw-literature-footer-right';
                    rightInfo.style.marginLeft = 'auto';
                    const sourceSpan = document.createElement('span');
                    sourceSpan.className = 'tw-literature-source-badge';
                    sourceSpan.textContent = `🔗 ${item.platform}`;
                    rightInfo.appendChild(sourceSpan);
                    footer.appendChild(rightInfo);
                    
                    contentContainer.appendChild(footer);
                    currentRefItem.appendChild(contentContainer);
                    
                } catch (error) {
                    console.warn(`Failed to fetch crossref data for DOI ${currentItem.doi}:`, error);
                    
                    // Create fallback card design
                    currentRefItem.innerHTML = '';
                    
                    // Create read button for fallback case too
                    const cleanDoi = currentItem.doi.replace('https://doi.org/', '').replace('http://doi.org/', '');
                    const readButton = createReadButton(cleanDoi, currentRefItem);
                    currentRefItem.appendChild(readButton);
                    
                    const fallbackContent = document.createElement('div');
                    fallbackContent.className = 'tw-literature-fallback';
                    fallbackContent.innerHTML = `
                        <div class="tw-literature-fallback-icon">📄</div>
                        <h3 class="tw-literature-fallback-title">${currentItem.title || 'No title available'}</h3>
                        <p class="tw-literature-fallback-subtitle">Unable to load additional details</p>
                        <a href="${currentItem.doi.startsWith('https://') ? currentItem.doi : `https://doi.org/${currentItem.doi}`}" 
                           target="_blank" 
                           class="tw-literature-fallback-button">
                            View DOI
                        </a>
                    `;
                    
                    // Add platform information to fallback
                    const fallbackFooter = document.createElement('div');
                    fallbackFooter.className = 'tw-literature-footer';
                    
                    const fallbackLeftInfo = document.createElement('div');
                    fallbackLeftInfo.className = 'tw-literature-footer-left';
                    fallbackFooter.appendChild(fallbackLeftInfo);
                    
                    const fallbackRightInfo = document.createElement('div');
                    fallbackRightInfo.className = 'tw-literature-footer-right';
                    const sourceSpan = document.createElement('span');
                    sourceSpan.className = 'tw-literature-source-badge';
                    sourceSpan.textContent = `🔗 ${currentItem.platform || 'Unknown'}`;
                    fallbackRightInfo.appendChild(sourceSpan);
                    fallbackFooter.appendChild(fallbackRightInfo);
                    fallbackContent.appendChild(fallbackFooter);
                    
                    currentRefItem.appendChild(fallbackContent);
                }
            })(item, refItem, doiLink, titleItem, authorsDiv);
        }
        
        return result;
    }
    return {
        card: card,
        cardFromDOIs: cardFromDOIs
    };
}


exports.Literature = Literature;
