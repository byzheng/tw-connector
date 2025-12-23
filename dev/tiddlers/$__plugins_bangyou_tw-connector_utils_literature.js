/*\
title: $:/plugins/bangyou/tw-connector/utils/literature.js
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
                    // Fade out the card
                    currentRefItem.style.transition = 'all 0.5s ease';
                    currentRefItem.style.opacity = '0.3';
                    currentRefItem.style.transform = 'scale(0.95)';
                    currentRefItem.style.pointerEvents = 'none';
                    
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
            const emptyState = document.createElement('div');
            emptyState.className = 'tw-literature-empty-state';
            emptyState.innerHTML = `
                <div class="tw-literature-empty-icon">📚</div>
                <h3 class="tw-literature-empty-title">No references found</h3>
                <p class="tw-literature-empty-subtitle">Try adjusting your search criteria</p>
            `;
            result.appendChild(emptyState);
            return result;
        }

        for (const item of items) {
            // Skip items without DOI early
            if (!item.doi) {
                console.warn('Skipping item without DOI:', item);
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
                    const response = await fetch(`literature/crossref/${encodeURIComponent(cleanDoi)}`);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const crossref = await response.json();
                    if (!crossref || !crossref.data || !crossref.data.message) {
                        throw new Error('Invalid crossref response structure');
                    }
                    
                    const data = crossref.data.message;
                    
                    // Clear the existing simple structure and rebuild with rich content
                    currentRefItem.innerHTML = '';
                    
                    // Create read button
                    const readButton = createReadButton(cleanDoi, currentRefItem);
                    currentRefItem.appendChild(readButton);
                    
                    // Create status badge
                    const statusBadge = document.createElement('div');
                    statusBadge.className = 'tw-literature-status-badge';
                    statusBadge.textContent = 'Published';
                    currentRefItem.appendChild(statusBadge);
                    
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
                    titleLink.textContent = data.title?.[0] || currentItem.title || 'No title available';
                    
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
                        
                        data.author.forEach((author, index) => {
                            const authorSpan = document.createElement('span');
                            authorSpan.className = 'tw-literature-author-chip';
                            const authorName = `${author.given || ''} ${author.family || ''}`.trim();
                            
                            if (author.ORCID) {
                                authorSpan.innerHTML = `
                                    ${authorName}
                                    <a href="${author.ORCID}" target="_blank" class="tw-literature-author-orcid">🆔</a>
                                `;
                            } else {
                                authorSpan.textContent = authorName;
                            }
                            
                            authorsContainer.appendChild(authorSpan);
                        });
                        
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
                    
                    const pubDate = data['published-online'] || data['published-print'] || data.published;
                    if (pubDate?.['date-parts']?.[0]) {
                        const year = pubDate['date-parts'][0][0];
                        const month = pubDate['date-parts'][0][1];
                        const dateSpan = document.createElement('span');
                        dateSpan.className = 'tw-literature-date-badge';
                        dateSpan.textContent = month ? `${year}-${month.toString().padStart(2, '0')}` : year;
                        journalSection.appendChild(dateSpan);
                    }
                    
                    contentContainer.appendChild(journalSection);
                    
                    // Footer with additional info
                    const footer = document.createElement('div');
                    footer.className = 'tw-literature-footer';
                    
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
                    const sourceSpan = document.createElement('span');
                    sourceSpan.textContent = '🔗 Crossref';
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
