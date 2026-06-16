/**
 * BigQuery Release Notes Hub & Broadcaster
 * Core Frontend Controller (Vanilla JavaScript)
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // STATE MANAGEMENT
    // ==========================================================================
    const state = {
        releases: [],          // Raw releases parsed from the backend
        activeFilter: 'all',   // Currently active category filter
        searchQuery: '',       // Active search term
        mockTweets: [],        // Saved mock tweets
        selectedItem: null,    // The note currently open in the tweet composer
        isFetching: false      // Spinner status
    };

    const TWEET_CHAR_LIMIT = 280;
    const CIRCUMFERENCE = 2 * Math.PI * 12; // ~75.4 (Radius is 12)

    // ==========================================================================
    // DOM ELEMENTS
    // ==========================================================================
    const elements = {
        refreshBtn: document.getElementById('refresh-btn'),
        refreshSpinner: document.getElementById('refresh-spinner'),
        lastUpdatedText: document.getElementById('last-updated-text'),
        searchInput: document.getElementById('search-input'),
        filterTagsList: document.getElementById('filter-tags-list'),
        releaseFeedContainer: document.getElementById('release-feed-container'),
        mockTimelineContainer: document.getElementById('mock-timeline-container'),
        timelineEmptyMessage: document.getElementById('timeline-empty-message'),
        
        // Modal elements
        tweetModal: document.getElementById('tweet-modal'),
        closeModalBtn: document.getElementById('close-modal-btn'),
        modalCancelBtn: document.getElementById('modal-cancel-btn'),
        modalMockPostBtn: document.getElementById('modal-mock-post-btn'),
        modalRealTweetBtn: document.getElementById('modal-real-tweet-btn'),
        modalBadgeType: document.getElementById('modal-badge-type'),
        modalBadgeDate: document.getElementById('modal-badge-date'),
        modalNotePreview: document.getElementById('modal-note-preview'),
        tweetTextarea: document.getElementById('tweet-textarea'),
        charCountText: document.getElementById('char-count-text'),
        charProgressCircle: document.getElementById('char-progress-circle'),
        hashtagHelpers: document.querySelector('.hashtag-helpers')
    };

    // ==========================================================================
    // INITIALIZATION & FEED FETCHING
    // ==========================================================================
    function init() {
        loadMockTweets();
        fetchReleases(false);
        setupEventListeners();
    }

    async function fetchReleases(forceRefresh = false) {
        if (state.isFetching) return;
        
        setLoadingState(true);
        try {
            const url = forceRefresh ? '/api/releases?refresh=true' : '/api/releases';
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Server returned error status ${response.status}`);
            }
            
            const data = await response.json();
            if (data.status === 'success') {
                state.releases = data.releases;
                renderFeed();
                updateSyncStatus(data.from_cache, data.last_updated);
            } else {
                showErrorState(data.message || 'An unknown error occurred while retrieving releases.');
            }
        } catch (error) {
            console.error('Error fetching release notes:', error);
            showErrorState(
                'Could not connect to the release feed. Please verify that the Flask server is running and try again.'
            );
        } finally {
            setLoadingState(false);
        }
    }

    function setLoadingState(isLoading) {
        state.isFetching = isLoading;
        if (isLoading) {
            elements.refreshBtn.disabled = true;
            elements.refreshSpinner.classList.add('spin-animation');
            if (state.releases.length === 0) {
                elements.releaseFeedContainer.innerHTML = `
                    <div class="loading-state">
                        <div class="pulse-loader"></div>
                        <p>Fetching the latest BigQuery release notes...</p>
                    </div>
                `;
            }
        } else {
            elements.refreshBtn.disabled = false;
            elements.refreshSpinner.classList.remove('spin-animation');
        }
    }

    function updateSyncStatus(isFromCache, lastUpdated) {
        const cacheIndicator = isFromCache ? ' (Cached)' : ' (Synced)';
        elements.lastUpdatedText.innerText = `Updated: ${lastUpdated}${cacheIndicator}`;
    }

    function showErrorState(message) {
        elements.releaseFeedContainer.innerHTML = `
            <div class="loading-state" style="border-color: rgba(244, 63, 94, 0.3);">
                <div class="empty-state-icon" style="color: var(--accent-red)">⚠️</div>
                <h3>Failed to load release notes</h3>
                <p style="color: var(--text-muted); max-width: 500px; font-size: 0.9rem;">${message}</p>
                <button id="retry-btn" class="btn btn-secondary btn-card-action" style="margin-top: 10px;">Retry Now</button>
            </div>
        `;
        
        // Bind retry button dynamically
        const retryBtn = document.getElementById('retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => fetchReleases(true));
        }
    }

    // ==========================================================================
    // RENDERING LOGIC
    // ==========================================================================
    function renderFeed() {
        const container = elements.releaseFeedContainer;
        container.innerHTML = '';
        
        if (state.releases.length === 0) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="empty-state-icon">📡</div>
                    <h3>No release notes available</h3>
                    <p>The feed data is currently empty. Try clicking Refresh Feed.</p>
                </div>
            `;
            return;
        }

        let renderedCount = 0;

        state.releases.forEach(entry => {
            // Filter and search elements inside the entry
            const filteredItems = entry.items.filter(item => {
                // Category Filter Match
                const categoryMatch = state.activeFilter === 'all' || 
                    item.type.toLowerCase() === state.activeFilter.toLowerCase();
                
                // Search Match (checks in text description and title type)
                const searchMatch = state.searchQuery === '' ||
                    item.text.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
                    item.type.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
                    entry.date.toLowerCase().includes(state.searchQuery.toLowerCase());
                
                return categoryMatch && searchMatch;
            });

            if (filteredItems.length > 0) {
                renderedCount += filteredItems.length;

                // Create date group element
                const groupEl = document.createElement('div');
                groupEl.className = 'entry-group';
                
                const headerEl = document.createElement('div');
                headerEl.className = 'entry-group-header';
                
                const titleEl = document.createElement('h4');
                titleEl.className = 'entry-group-title';
                titleEl.innerText = entry.date;
                
                const lineEl = document.createElement('div');
                lineEl.className = 'entry-group-line';
                
                headerEl.appendChild(titleEl);
                headerEl.appendChild(lineEl);
                groupEl.appendChild(headerEl);

                // Render notes inside this date group
                filteredItems.forEach(item => {
                    const cardEl = document.createElement('article');
                    const normalizedType = item.type.toLowerCase();
                    let typeClass = 'type-general';
                    
                    if (normalizedType === 'feature') typeClass = 'type-feature';
                    else if (normalizedType === 'deprecated') typeClass = 'type-deprecated';
                    else if (normalizedType.includes('change') || normalizedType.includes('modif')) typeClass = 'type-changed';

                    cardEl.className = `release-card ${typeClass}`;
                    
                    // Card header
                    const cardHeader = document.createElement('div');
                    cardHeader.className = 'card-header';
                    
                    const cardMeta = document.createElement('div');
                    cardMeta.className = 'card-meta';
                    
                    const badge = document.createElement('span');
                    badge.className = `badge badge-${normalizedType === 'feature' ? 'feature' : normalizedType === 'deprecated' ? 'deprecated' : normalizedType.includes('change') ? 'changed' : 'general'}`;
                    badge.innerText = item.type;
                    
                    cardMeta.appendChild(badge);
                    cardHeader.appendChild(cardMeta);
                    
                    // Card Body
                    const cardBody = document.createElement('div');
                    cardBody.className = 'card-body';
                    cardBody.innerHTML = item.html;
                    
                    // Card Actions
                    const cardActions = document.createElement('div');
                    cardActions.className = 'card-actions';
                    
                    // Documentation link button
                    if (entry.link) {
                        const linkBtn = document.createElement('a');
                        linkBtn.href = entry.link;
                        linkBtn.target = '_blank';
                        linkBtn.rel = 'noopener noreferrer';
                        linkBtn.className = 'btn btn-secondary btn-card-action';
                        linkBtn.innerHTML = `
                            <span>View Docs</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
                            </svg>
                        `;
                        cardActions.appendChild(linkBtn);
                    }
                    
                    // Tweet button
                    const tweetBtn = document.createElement('button');
                    tweetBtn.className = 'btn card-tweet-btn btn-card-action';
                    tweetBtn.innerHTML = `
                        <span>🐦 Tweet</span>
                    `;
                    tweetBtn.addEventListener('click', () => openTweetComposer(entry, item));
                    
                    cardActions.appendChild(tweetBtn);
                    
                    cardEl.appendChild(cardHeader);
                    cardEl.appendChild(cardBody);
                    cardEl.appendChild(cardActions);
                    groupEl.appendChild(cardEl);
                });

                container.appendChild(groupEl);
            }
        });

        // Show empty state if filters cleared all items
        if (renderedCount === 0) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="empty-state-icon">🔍</div>
                    <h3>No results match your search</h3>
                    <p>Try clearing your search query or selecting a different filter category.</p>
                </div>
            `;
        }
    }

    // ==========================================================================
    // TWEET COMPOSER MODAL LOGIC
    // ==========================================================================
    function openTweetComposer(entry, item) {
        state.selectedItem = { entry, item };
        
        // Update modal info card
        elements.modalBadgeType.innerText = item.type;
        elements.modalBadgeType.className = `badge badge-${item.type.toLowerCase() === 'feature' ? 'feature' : item.type.toLowerCase() === 'deprecated' ? 'deprecated' : item.type.toLowerCase().includes('change') ? 'changed' : 'general'}`;
        elements.modalBadgeDate.innerText = entry.date;
        elements.modalNotePreview.innerText = item.text;
        
        // Generate pre-populated tweet draft
        // Clean draft format: "BigQuery Update [Date]: [Brief text summary] [DocsLink] #BigQuery #GoogleCloud"
        const cleanDateStr = entry.date;
        
        // Truncate note text to fit into Twitter character constraints
        let maxTextLen = TWEET_CHAR_LIMIT - `BigQuery [${item.type}] (${cleanDateStr}): `.length - ` #BigQuery #GoogleCloud`.length - 30; // 30 buffer for link
        let textSummary = item.text;
        if (textSummary.length > maxTextLen) {
            textSummary = textSummary.substring(0, maxTextLen - 3) + '...';
        }
        
        let draftText = `BigQuery [${item.type}] (${cleanDateStr}): ${textSummary}`;
        if (entry.link) {
            draftText += ` ${entry.link}`;
        }
        draftText += ` #BigQuery #GoogleCloud`;
        
        elements.tweetTextarea.value = draftText;
        updateCharCount();
        
        // Display modal
        elements.tweetModal.style.display = 'flex';
        elements.tweetTextarea.focus();
        // Prevent background scrolling
        document.body.style.overflow = 'hidden';
    }

    function closeTweetComposer() {
        elements.tweetModal.style.display = 'none';
        state.selectedItem = null;
        document.body.style.overflow = '';
    }

    function updateCharCount() {
        const text = elements.tweetTextarea.value;
        const remaining = TWEET_CHAR_LIMIT - text.length;
        
        elements.charCountText.innerText = remaining;
        
        // Update circular character progress bar
        const progressPercentage = Math.min(text.length / TWEET_CHAR_LIMIT, 1);
        const offset = CIRCUMFERENCE - (progressPercentage * CIRCUMFERENCE);
        elements.charProgressCircle.style.strokeDashoffset = offset;
        
        // Warning/Error color schemes
        if (remaining < 0) {
            elements.charCountText.style.color = 'var(--accent-red)';
            elements.charProgressCircle.style.stroke = 'var(--accent-red)';
            elements.modalRealTweetBtn.disabled = true;
            elements.modalMockPostBtn.disabled = true;
        } else if (remaining <= 20) {
            elements.charCountText.style.color = 'var(--accent-amber)';
            elements.charProgressCircle.style.stroke = 'var(--accent-amber)';
            elements.modalRealTweetBtn.disabled = false;
            elements.modalMockPostBtn.disabled = false;
        } else {
            elements.charCountText.style.color = 'var(--text-muted)';
            elements.charProgressCircle.style.stroke = 'var(--accent-blue)';
            elements.modalRealTweetBtn.disabled = false;
            elements.modalMockPostBtn.disabled = false;
        }
    }

    // ==========================================================================
    // TWITTER INTEGRATIONS (REAL & MOCK)
    // ==========================================================================
    function postRealTweet() {
        const text = elements.tweetTextarea.value;
        if (text.length > TWEET_CHAR_LIMIT) return;
        
        const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterIntentUrl, '_blank', 'noopener,noreferrer');
        
        // Also log it as a simulation log for user convenience!
        addMockTweet(text, true);
        closeTweetComposer();
    }

    function postMockTweet() {
        const text = elements.tweetTextarea.value;
        if (text.length > TWEET_CHAR_LIMIT || text.trim() === '') return;
        
        addMockTweet(text, false);
        closeTweetComposer();
    }

    function addMockTweet(content, launchedReal = false) {
        const newTweet = {
            id: 'tweet_' + Date.now(),
            content: content,
            timestamp: new Date().toISOString(),
            launchedReal: launchedReal,
            likes: 0,
            retweets: 0,
            liked: false,
            retweeted: false
        };

        state.mockTweets.unshift(newTweet);
        saveMockTweets();
        renderMockTimeline();
    }

    function renderMockTimeline() {
        const container = elements.mockTimelineContainer;
        
        // Clear all except empty state
        const tweets = container.querySelectorAll('.mock-tweet');
        tweets.forEach(t => t.remove());
        
        if (state.mockTweets.length === 0) {
            elements.timelineEmptyMessage.style.display = 'block';
            return;
        }
        
        elements.timelineEmptyMessage.style.display = 'none';
        
        state.mockTweets.forEach(tweet => {
            const tweetEl = document.createElement('div');
            tweetEl.className = 'mock-tweet';
            tweetEl.dataset.id = tweet.id;
            
            const timeFormatted = formatTweetTime(tweet.timestamp);
            const badgeMeta = tweet.launchedReal ? 
                `<span class="tweet-username" style="color:#1da1f2; font-weight:600;">(Sent to X)</span>` : 
                `<span class="tweet-username">(Simulated)</span>`;

            tweetEl.innerHTML = `
                <div class="tweet-avatar">BQ</div>
                <div class="tweet-content-area">
                    <div class="tweet-user-info">
                        <span class="tweet-display-name">BigQuery Broadcasts</span>
                        ${badgeMeta}
                        <span class="tweet-dot">•</span>
                        <span class="tweet-time">${timeFormatted}</span>
                    </div>
                    <div class="tweet-text">${escapeHtml(tweet.content)}</div>
                    <div class="tweet-actions-bar">
                        <div class="tweet-action-item retweet ${tweet.retweeted ? 'active' : ''}" style="${tweet.retweeted ? 'color: var(--accent-green)' : ''}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="17 1 21 5 17 9"></polyline>
                                <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                                <polyline points="7 23 3 19 7 15"></polyline>
                                <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                            </svg>
                            <span class="rt-count">${tweet.retweets}</span>
                        </div>
                        <div class="tweet-action-item like ${tweet.liked ? 'active' : ''}" style="${tweet.liked ? 'color: var(--accent-red)' : ''}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="${tweet.liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                            <span class="like-count">${tweet.likes}</span>
                        </div>
                        <div class="tweet-action-item delete-tweet" style="margin-left: auto; color: var(--accent-red); opacity: 0.6;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                        </div>
                    </div>
                </div>
            `;
            
            // Add interaction event listeners to mock tweet elements
            const likeBtn = tweetEl.querySelector('.like');
            likeBtn.addEventListener('click', () => toggleLike(tweet.id));
            
            const rtBtn = tweetEl.querySelector('.retweet');
            rtBtn.addEventListener('click', () => toggleRetweet(tweet.id));

            const delBtn = tweetEl.querySelector('.delete-tweet');
            delBtn.addEventListener('click', () => deleteTweet(tweet.id));
            
            container.appendChild(tweetEl);
        });
    }

    function toggleLike(tweetId) {
        const tweet = state.mockTweets.find(t => t.id === tweetId);
        if (tweet) {
            tweet.liked = !tweet.liked;
            tweet.likes += tweet.liked ? 1 : -1;
            saveMockTweets();
            renderMockTimeline();
        }
    }

    function toggleRetweet(tweetId) {
        const tweet = state.mockTweets.find(t => t.id === tweetId);
        if (tweet) {
            tweet.retweeted = !tweet.retweeted;
            tweet.retweets += tweet.retweeted ? 1 : -1;
            saveMockTweets();
            renderMockTimeline();
        }
    }

    function deleteTweet(tweetId) {
        state.mockTweets = state.mockTweets.filter(t => t.id !== tweetId);
        saveMockTweets();
        renderMockTimeline();
    }

    // ==========================================================================
    // PERSISTENCE & UTILITIES
    // ==========================================================================
    function loadMockTweets() {
        const saved = localStorage.getItem('bq_release_mock_tweets');
        if (saved) {
            try {
                state.mockTweets = JSON.parse(saved);
                renderMockTimeline();
            } catch (e) {
                console.error('Error parsing stored mock tweets:', e);
                state.mockTweets = [];
            }
        }
    }

    function saveMockTweets() {
        localStorage.setItem('bq_release_mock_tweets', JSON.stringify(state.mockTweets));
    }

    function formatTweetTime(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMin = Math.floor(diffMs / 60000);
        
        if (diffMin < 1) return 'just now';
        if (diffMin < 60) return `${diffMin}m`;
        
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `${diffHr}h`;
        
        // Otherwise format as Mon Day
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.innerText = text;
        return div.innerHTML;
    }

    // ==========================================================================
    // EVENT LISTENERS
    // ==========================================================================
    function setupEventListeners() {
        // Refresh Button
        elements.refreshBtn.addEventListener('click', () => fetchReleases(true));
        
        // Search Input
        elements.searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            renderFeed();
        });
        
        // Filter Tags List
        elements.filterTagsList.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-tag')) {
                // Remove active class from all tags
                const tags = elements.filterTagsList.querySelectorAll('.filter-tag');
                tags.forEach(t => t.classList.remove('active'));
                
                // Add active class to selected tag
                e.target.classList.add('active');
                
                state.activeFilter = e.target.dataset.type;
                renderFeed();
            }
        });
        
        // Modal controllers
        elements.closeModalBtn.addEventListener('click', closeTweetComposer);
        elements.modalCancelBtn.addEventListener('click', closeTweetComposer);
        elements.modalMockPostBtn.addEventListener('click', postMockTweet);
        elements.modalRealTweetBtn.addEventListener('click', postRealTweet);
        
        // Close modal when clicking outside the card
        elements.tweetModal.addEventListener('click', (e) => {
            if (e.target === elements.tweetModal) {
                closeTweetComposer();
            }
        });
        
        // Character counter input listener
        elements.tweetTextarea.addEventListener('input', updateCharCount);
        
        // Hashtag Helper Buttons
        elements.hashtagHelpers.addEventListener('click', (e) => {
            if (e.target.classList.contains('tag-helper')) {
                const tagText = e.target.dataset.tag;
                const textarea = elements.tweetTextarea;
                
                // Add tag text to textarea if it does not already exist
                if (!textarea.value.includes(tagText)) {
                    // Check if whitespace is needed
                    const spacing = textarea.value.endsWith(' ') || textarea.value.length === 0 ? '' : ' ';
                    textarea.value = textarea.value + spacing + tagText;
                    updateCharCount();
                    textarea.focus();
                }
            }
        });
    }

    // Run initialization
    init();
});
