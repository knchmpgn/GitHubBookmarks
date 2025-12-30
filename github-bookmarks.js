// ==UserScript==
// @name         GitHub Bookmarks
// @namespace    http://tampermonkey.net/
// @version      5.0.4
// @description  Complete system to bookmark GitHub repositories with lists and syncing via Gist.
// @icon         https://github.githubassets.com/pinned-octocat.svg
// @author       knchmpgn
// @match        https://github.com/*
// @grant        none
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ============================================================================
    // CONSTANTS & SHARED STATE
    // ============================================================================

    const STORAGE_KEYS = {
        SYNC_TOKEN: 'ghBookmarkSyncToken',
        SYNC_GIST_ID: 'ghBookmarkSyncGistId',
        CACHE: 'ghBookmarkCache',
        CACHE_TIMESTAMP: 'ghBookmarkCacheTimestamp',
        MODAL_OPEN: 'ghBookmarkModalOpen' // Track if modal was open
    };

    const DEFAULT_LIST = 'Unassigned';
    const SYNC_HELP_URL = 'https://github.com/settings/tokens/new';
    const CACHE_DURATION = 30000; // 30 seconds
    const GIST_FILENAME = 'github-bookmarks.json';

    // SVG Icons - Updated tag icon to be linear
    const ICONS = {
        bookmarkHollow: `<svg class="octicon octicon-bookmark" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M3 2.75C3 1.784 3.784 1 4.75 1h6.5c.966 0 1.75.784 1.75 1.75v11.5a.75.75 0 0 1-1.227.579L8 11.722l-3.773 3.107A.75.75 0 0 1 3 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.91l3.023-2.489a.75.75 0 0 1 .954 0l3.023 2.49V2.75a.25.25 0 0 0-.25-.25Z"></path></svg>`,
        bookmarkFilled: `<svg class="octicon octicon-bookmark-fill" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M3 2.75C3 1.784 3.784 1 4.75 1h6.5c.966 0 1.75.784 1.75 1.75v11.5a.75.75 0 0 1-1.227.579L8 11.722l-3.773 3.107A.75.75 0 0 1 3 14.25Z"></path></svg>`,
        triangleDown: `<svg class="octicon octicon-triangle-down" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="m4.427 7.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"></path></svg>`,
        close: `<svg class="octicon octicon-x" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path></svg>`,
        plus: `<svg class="octicon octicon-plus" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"></path></svg>`,
        trash: `<svg class="octicon" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z"></path></svg>`,
        questionMark: `<svg class="octicon" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.92 6.085h.001a.749.749 0 1 1-1.342-.67c.169-.339.436-.701.849-.977C6.845 4.16 7.369 4 8 4a2.756 2.756 0 0 1 1.638.525c.503.377.862.965.862 1.725 0 .448-.115.83-.329 1.15-.205.307-.47.513-.692.662-.109.072-.22.138-.313.195l-.006.004a6.24 6.24 0 0 0-.26.16.952.952 0 0 0-.276.245.75.75 0 0 1-1.248-.832c.184-.264.42-.489.692-.661.103-.067.207-.132.313-.195l.007-.004c.1-.061.182-.11.258-.161a.969.969 0 0 0 .277-.245C8.96 6.514 9 6.427 9 6.25c0-.412-.155-.826-.57-1.12A1.256 1.256 0 0 0 8 4.75c-.361 0-.67.1-.894.27-.228.173-.4.412-.534.714v.001ZM8 11a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>`,
        pencil: `<svg class="octicon" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064Zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354Z"></path></svg>`,
        gear: `<svg class="octicon" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path fill="currentColor" d="M8 0a8.2 8.2 0 0 1 .701.031C9.444.095 9.99.645 10.16 1.29l.288 1.107c.018.066.079.158.212.224.231.114.454.243.668.386.123.082.233.09.299.071l1.103-.303c.644-.176 1.392.021 1.82.63.27.385.506.792.704 1.218.315.675.111 1.422-.364 1.891l-.814.806c-.049.048-.098.147-.088.294.016.257.016.515 0 .772-.01.147.038.246.088.294l.814.806c.475.469.679 1.216.364 1.891a7.977 7.977 0 0 1-.704 1.217c-.428.61-1.176.807-1.82.63l-1.102-.302c-.067-.019-.177-.011-.3.071a5.909 5.909 0 0 1-.668.386c-.133.066-.194.158-.211.224l-.29 1.106c-.168.646-.715 1.196-1.458 1.26a8.006 8.006 0 0 1-1.402 0c-.743-.064-1.289-.614-1.458-1.26l-.289-1.106c-.018-.066-.079-.158-.212-.224a5.738 5.738 0 0 1-.668-.386c-.123-.082-.233-.09-.299-.071l-1.103.303c-.644.176-1.392-.021-1.82-.63a8.12 8.12 0 0 1-.704-1.218c-.315-.675-.111-1.422.363-1.891l.815-.806c.05-.048.098-.147.088-.294a6.214 6.214 0 0 1 0-.772c.01-.147-.038-.246-.088-.294l-.815-.806C.635 6.045.431 5.298.746 4.623a7.92 7.92 0 0 1 .704-1.217c.428-.61 1.176-.807 1.82-.63l1.102.302c.067.019.177.011.3-.071.214-.143.437-.272.668-.386.133-.066.194-.158.211-.224l.29-1.106C6.009.645 6.556.095 7.299.03 7.53.01 7.764 0 8 0Zm-.571 1.525c-.036.003-.108.036-.137.146l-.289 1.105c-.147.561-.549.967-.998 1.189-.173.086-.34.183-.5.29-.417.278-.97.423-1.529.27l-1.103-.303c-.109-.03-.175.016-.195.045-.22.312-.412.644-.573.99-.014.031-.021.11.059.19l.815.806c.411.406.562.957.53 1.456a4.709 4.709 0 0 0 0 .582c.032.499-.119 1.05-.53 1.456l-.815.806c-.081.08-.073.159-.059.19.162.346.353.677.573.989.02.03.085.076.195.046l1.102-.303c.56-.153 1.113-.008 1.53.27.161.107.328.204.501.29.447.222.85.629.997 1.189l.289 1.105c.029.109.101.143.137.146a6.6 6.5 0 0 0 1.142 0c.036-.003.108-.036.137-.146l.289-1.105c.147-.561.549-.967.998-1.189.173-.086.34-.183.5-.29.417-.278.97-.423 1.529-.27l1.103.303c.109.029.175-.016.195-.045.22-.313.411-.644.573-.99.014-.031.021-.11-.059-.19l-.815-.806c-.411-.406-.562-.957-.53-1.456a4.709 4.709 0 0 0 0-.582c-.032-.499.119-1.05.53-1.456l.815-.806c.081-.08.073-.159.059-.19a6.464 6.464 0 0 0-.573-.989c-.02-.03-.085-.076-.195-.046l-1.102.303c-.56.153-1.113.008-1.53-.27a4.44 4.44 0 0 0-.501-.29c-.447-.222-.85-.629-.997-1.189l-.289-1.105c-.029-.11-.101-.143-.137-.146a6.6 6.6 0 0 0-1.142 0ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9.5 8a1.5 1.5 0 1 0-3.001.001A1.5 1.5 0 0 0 9.5 8Z"></path></svg>`,
        gripVertical: `<svg class="octicon" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M10 13a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm0-4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm-4 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm5-9a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>`,
        lock: `<svg class="octicon" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M4 4a4 4 0 0 1 8 0v2h.25c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-5.5C2 6.784 2.784 6 3.75 6H4Zm8.25 3.5h-8.5a.25.25 0 0 0-.25.25v5.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25ZM10.5 6V4a2.5 2.5 0 1 0-5 0v2Z"></path></svg>`,
        tag: `<svg class="octicon octicon-tag" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M1 7.775V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 0 1 0 2.474l-5.026 5.026a1.75 1.75 0 0 1-2.474 0l-6.25-6.25A1.752 1.752 0 0 1 1 7.775Zm1.75-.25a.25.25 0 0 0-.25.25v3.5c0 .138.112.25.25.25h3.5a.25.25 0 0 0 .25-.25v-3.5a.25.25 0 0 0-.25-.25h-3.5Z"></path></svg>`
    };

    let modalOpen = false;
    let syncInProgress = false;

    // ============================================================================
    // GIST-BASED STORAGE UTILITIES
    // ============================================================================

    const Storage = {
        // Local cache for faster reads
        cache: null,
        cacheTimestamp: 0,

        getSyncToken() {
            return localStorage.getItem(STORAGE_KEYS.SYNC_TOKEN) || '';
        },

        setSyncToken(token) {
            localStorage.setItem(STORAGE_KEYS.SYNC_TOKEN, token);
        },

        getGistId() {
            return localStorage.getItem(STORAGE_KEYS.SYNC_GIST_ID) || '';
        },

        setGistId(id) {
            localStorage.setItem(STORAGE_KEYS.SYNC_GIST_ID, id);
        },

        // Check if cache is still valid
        isCacheValid() {
            return this.cache && (Date.now() - this.cacheTimestamp < CACHE_DURATION);
        },

        // Invalidate cache
        invalidateCache() {
            this.cache = null;
            this.cacheTimestamp = 0;
        },

        // Fetch data from Gist
        async fetchFromGist(silent = false) {
            const token = this.getSyncToken();
            const gistId = this.getGistId();

            if (!token || !gistId) {
                if (!silent) {
                    console.log('No token or gist ID configured');
                }
                return null;
            }

            try {
                const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const gist = await response.json();
                const content = gist.files[GIST_FILENAME]?.content;

                if (!content) {
                    throw new Error('Bookmark data not found in gist');
                }

                const data = JSON.parse(content);
                this.cache = data;
                this.cacheTimestamp = Date.now();
                return data;
            } catch (error) {
                console.error('Failed to fetch from Gist:', error);
                if (!silent) {
                    alert(`Failed to load bookmarks: ${error.message}`);
                }
                return null;
            }
        },

        // Save data to Gist
        async saveToGist(data, silent = true) {
            if (syncInProgress) {
                console.log('Sync already in progress');
                return { success: false, error: 'Sync in progress' };
            }

            syncInProgress = true;

            const token = this.getSyncToken();
            if (!token) {
                syncInProgress = false;
                if (!silent) alert('Please configure your GitHub token first');
                return { success: false, error: 'No token configured' };
            }

            const gistId = this.getGistId();
            const url = gistId ? `https://api.github.com/gists/${gistId}` : 'https://api.github.com/gists';

            const payload = {
                ...data,
                lastSync: new Date().toISOString()
            };

            try {
                const response = await fetch(url, {
                    method: gistId ? 'PATCH' : 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        description: 'GitHub Bookmarks',
                        public: false,
                        files: {
                            [GIST_FILENAME]: {
                                content: JSON.stringify(payload, null, 2)
                            }
                        }
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || `HTTP ${response.status}`);
                }

                const result = await response.json();
                this.setGistId(result.id);
                this.cache = payload;
                this.cacheTimestamp = Date.now();
                this.dispatchUpdate();

                syncInProgress = false;
                return { success: true, time: payload.lastSync };
            } catch (error) {
                console.error('Save to Gist failed:', error);
                syncInProgress = false;
                if (!silent) {
                    alert(`Failed to save: ${error.message}\n\nMake sure your token has the 'gist' scope.`);
                }
                return { success: false, error: error.message };
            }
        },

        // Get data with caching
        async getData() {
            if (this.isCacheValid()) {
                return this.cache;
            }

            const data = await this.fetchFromGist(true);
            if (data) return data;

            // Return default structure if no data exists
            return {
                bookmarks: {},
                lists: [DEFAULT_LIST],
                listOrder: []
            };
        },

        // Get bookmarks
        async getBookmarks() {
            const data = await this.getData();
            return data.bookmarks || {};
        },

        // Get lists - exclude DEFAULT_LIST from visible lists
        async getLists() {
            const data = await this.getData();
            const lists = data.lists || [DEFAULT_LIST];
            const order = data.listOrder || [];

            const generalList = lists.find(l => l === DEFAULT_LIST);
            const otherLists = lists.filter(l => l !== DEFAULT_LIST).sort((a, b) => {
                const indexA = order.indexOf(a);
                const indexB = order.indexOf(b);
                if (indexA === -1 && indexB === -1) return 0;
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            });

            return generalList ? [generalList, ...otherLists] : otherLists;
        },

        // Get visible lists (excluding DEFAULT_LIST)
        async getVisibleLists() {
            const data = await this.getData();
            const lists = data.lists || [DEFAULT_LIST];
            const order = data.listOrder || [];

            const otherLists = lists.filter(l => l !== DEFAULT_LIST).sort((a, b) => {
                const indexA = order.indexOf(a);
                const indexB = order.indexOf(b);
                if (indexA === -1 && indexB === -1) return 0;
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            });

            return otherLists;
        },

        async getListOrder() {
            const data = await this.getData();
            return data.listOrder || [];
        },

        async saveListOrder(order) {
            const data = await this.getData();
            data.listOrder = order;
            await this.saveToGist(data);
        },

        async getTotalCount() {
            const bookmarks = await this.getBookmarks();
            return Object.values(bookmarks).reduce((total, list) => total + list.length, 0);
        },

        async isBookmarked(repo) {
            const bookmarks = await this.getBookmarks();
            return Object.values(bookmarks).some(list => list.some(b => b.repo === repo));
        },

        async isBookmarkedInList(repo, listName) {
            const bookmarks = await this.getBookmarks();
            return bookmarks[listName]?.some(b => b.repo === repo) || false;
        },

        async addBookmark(repo, repoUrl, listName) {
            const data = await this.getData();
            if (!data.bookmarks[listName]) data.bookmarks[listName] = [];

            if (!data.bookmarks[listName].some(b => b.repo === repo)) {
                data.bookmarks[listName].push({ repo, repoUrl });
                await this.saveToGist(data);
                return true;
            }
            return false;
        },

        async removeBookmark(repo, listName) {
            const data = await this.getData();
            if (data.bookmarks[listName]) {
                data.bookmarks[listName] = data.bookmarks[listName].filter(b => b.repo !== repo);
                if (data.bookmarks[listName].length === 0) {
                    delete data.bookmarks[listName];
                }
                // Invalidate cache before saving to ensure fresh data on next read
                this.invalidateCache();
                await this.saveToGist(data);
                return true;
            }
            return false;
        },

        async addList(listName) {
            const data = await this.getData();
            if (!data.lists.includes(listName)) {
                // Count custom lists (excluding General)
                const customLists = data.lists.filter(l => l !== DEFAULT_LIST);
                if (customLists.length >= 7) {
                    alert('Maximum of 7 custom lists reached. Please delete a list before creating a new one.');
                    return false;
                }
                data.lists.push(listName);
                if (!data.listOrder.includes(listName)) {
                    data.listOrder.push(listName);
                }
                await this.saveToGist(data);
                return true;
            }
            return false;
        },

        async renameList(oldName, newName) {
            if (oldName === DEFAULT_LIST) {
                alert('Cannot rename the default list.');
                return false;
            }

            const data = await this.getData();
            if (!data.lists.includes(oldName)) return false;
            if (data.lists.includes(newName)) {
                alert('A list with that name already exists.');
                return false;
            }

            data.lists = data.lists.map(l => l === oldName ? newName : l);

            if (data.bookmarks[oldName]) {
                data.bookmarks[newName] = data.bookmarks[oldName];
                delete data.bookmarks[oldName];
            }

            data.listOrder = data.listOrder.map(l => l === oldName ? newName : l);

            await this.saveToGist(data);
            return true;
        },

        async deleteList(listName) {
            if (listName === DEFAULT_LIST) {
                alert('Cannot delete the default list.');
                return false;
            }

            const data = await this.getData();
            if (!data.lists.includes(listName)) return false;

            data.lists = data.lists.filter(l => l !== listName);
            if (data.bookmarks[listName]) {
                delete data.bookmarks[listName];
            }
            data.listOrder = data.listOrder.filter(l => l !== listName);

            await this.saveToGist(data);
            return true;
        },

        dispatchUpdate() {
            window.dispatchEvent(new CustomEvent('ghBookmarksUpdated'));
        },

        async initialize() {
            // Try to load from Gist on startup
            await this.fetchFromGist(true);
        },

        // Modal state persistence
        setModalOpen(isOpen) {
            localStorage.setItem(STORAGE_KEYS.MODAL_OPEN, isOpen ? 'true' : 'false');
        },

        getModalOpen() {
            return localStorage.getItem(STORAGE_KEYS.MODAL_OPEN) === 'true';
        }
    };

    // ============================================================================
    // REPOSITORY UTILITIES
    // ============================================================================

    const Repo = {
        getInfo() {
            const pathParts = window.location.pathname.split('/').filter(Boolean);
            if (pathParts.length >= 2) {
                return {
                    repo: `${pathParts[0]}/${pathParts[1]}`,
                    repoUrl: `${window.location.origin}/${pathParts.slice(0, 2).join('/')}`
                };
            }
            return null;
        },

        isRepoPage() {
            const pathParts = window.location.pathname.split('/').filter(Boolean);
            return pathParts.length >= 2 && !pathParts[0].startsWith('?');
        }
    };

    // ============================================================================
    // STYLES (updated for proper tag icon styling)
    // ============================================================================

    function injectStyles() {
        if (document.getElementById('gh-bookmarks-styles')) return;

        const style = document.createElement('style');
        style.id = 'gh-bookmarks-styles';
        style.textContent = `
            /* Bookmark Button on Repo Pages */
            .gh-bookmark-button-group {
                display: inline-flex;
                vertical-align: middle;
            }

            .gh-bookmark-dropdown-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                padding: 0;
                border-top-left-radius: 0;
                border-bottom-left-radius: 0;
                border-left: 1px solid var(--borderColor-default, var(--color-border-default)) !important;
                height: 100%;
            }

            .gh-bookmark-icon svg {
                display: inline-block;
                overflow: visible;
                vertical-align: text-bottom;
            }

            .gh-bookmark-counter {
                display: inline-block;
                padding: 0 6px;
                font-size: 12px;
                font-weight: 500;
                line-height: 18px;
                color: var(--fgColor-default, var(--color-fg-default));
                background-color: var(--bgColor-neutral-muted, var(--color-neutral-muted));
                border-radius: 2em;
                margin-left: 4px;
            }

            /* Dropdown Details */
            .gh-bookmark-details {
                position: relative;
                display: inline-block;
            }

            .gh-bookmark-details summary {
                list-style: none;
            }

            .gh-bookmark-details summary::-webkit-details-marker {
                display: none;
            }

            /* SelectMenu Dropdown */
            .SelectMenu {
                position: absolute;
                right: 0;
                left: auto;
                z-index: 99;
                width: 300px;
                margin-top: 4px;
            }

            .SelectMenu-modal {
                position: relative;
                z-index: 99;
                display: flex;
                flex-direction: column;
                max-height: 480px;
                overflow: hidden;
                background-color: var(--overlay-bgColor, var(--color-canvas-overlay));
                border: 1px solid var(--borderColor-default, var(--color-border-default));
                border-radius: 12px;
                box-shadow: var(--shadow-floating-large, var(--color-shadow-large));
            }

            .SelectMenu-header {
                display: flex;
                flex: none;
                align-items: center;
                justify-content: space-between;
                padding: 16px;
                border-bottom: 1px solid var(--borderColor-muted, var(--color-border-muted));
            }

            .SelectMenu-title {
                flex: 1;
                font-size: 14px;
                font-weight: 600;
                color: var(--fgColor-default, var(--color-fg-default));
            }

            .SelectMenu-closeButton {
                padding: 4px;
                background: transparent;
                border: 0;
                color: var(--fgColor-muted, var(--color-fg-muted));
                cursor: pointer;
                border-radius: 6px;
            }

            .SelectMenu-closeButton:hover {
                background-color: var(--bgColor-neutral-muted, var(--color-neutral-muted));
            }

            .SelectMenu-list {
                position: relative;
                flex: 1 1 auto;
                overflow-x: hidden;
                overflow-y: auto;
                padding: 8px 0;
            }

            .SelectMenu-item {
                display: flex;
                align-items: center;
                width: 100%;
                overflow: hidden;
                color: var(--fgColor-default, var(--color-fg-default));
                text-align: left;
                cursor: pointer;
                background-color: transparent;
                border: 0;
                font-size: 14px;
                width: calc(100% - 16px);
                padding: 6px 8px;
                margin: 0 8px;
                gap: 8px;
                border-radius: 6px;
                position: relative;
            }

            .SelectMenu-item:hover {
                background-color: transparent !important;
            }

            .SelectMenu-checkbox {
                flex-shrink: 0;
                margin: 0;
                cursor: pointer;
                width: 16px;
                height: 16px;
                border-radius: 4px;
                border: 1px solid var(--control-borderColor-rest, var(--color-border-default));
                border-color: var(--control-borderColor-emphasis, var(--color-accent-emphasis));
                background-color: var(--bgColor-default, var(--color-canvas-default));
                appearance: none;
                -webkit-appearance: none;
                -moz-appearance: none;
                position: relative;
                transition: background-color 0.1s ease, border-color 0.1s ease;
            }

            .SelectMenu-checkbox:hover {
                border-color: var(--control-borderColor-emphasis, var(--color-accent-emphasis));
            }

            .SelectMenu-checkbox:checked {
                background-color: #0969da;
                border-color: #0969da;
            }

            .SelectMenu-checkbox:checked::after {
                content: '';
                position: absolute;
                top: 2px;
                left: 5px;
                width: 4px;
                height: 8px;
                border: solid white;
                border-width: 0 2px 2px 0;
                transform: rotate(45deg);
            }

            .SelectMenu-item-text {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .SelectMenu-item--add .SelectMenu-item-text {
                flex: 0;
                overflow: visible;
                white-space: nowrap;
                position: relative;
                top: -1px;
            }

            .SelectMenu-footer {
                display: flex;
                flex: none;
                padding: 0px 8px 8px 8px;
                border-top: 0px;
                margin-top: 0px;
            }

            .SelectMenu-item--add {
                margin: 0 !important;
                padding: 6px 6px !important;
                width: 100% !important;
            }

            .SelectMenu-item--add:hover {
                background-color: var(--bgColor-neutral-muted, var(--color-neutral-muted)) !important;
            }

            .SelectMenu-plus-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                color: var(--fgColor-muted, var(--color-fg-muted)) !important;
                width: 16px;
                height: 16px;
            }

            .SelectMenu-plus-icon svg {
                width: 16px;
                height: 16px;
                display: block;
                fill: currentColor;
            }

            /* Loading indicator */
            .bookmarks-loading {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 40px;
                color: var(--fgColor-muted, var(--color-fg-muted));
            }

            /* Modal Overlay and other styles continue... */
            .bookmarks-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(0, 0, 0, 0.5);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                animation: fadeIn 0.15s ease-in-out forwards;
            }

            @keyframes fadeIn {
                to { opacity: 1; }
            }

            .bookmarks-modal {
                background-color: var(--overlay-bgColor, var(--color-canvas-overlay));
                border: 1px solid var(--borderColor-default, var(--color-border-default));
                border-radius: 12px;
                box-shadow: var(--shadow-floating-xlarge);
                width: 90%;
                max-width: 1000px;
                max-height: 80vh;
                display: flex;
                flex-direction: column;
                animation: slideUp 0.2s ease-out;
            }

            @keyframes slideUp {
                from {
                    transform: translateY(20px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }

            .bookmarks-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 24px;
                border-bottom: 1px solid var(--borderColor-muted, var(--color-border-muted));
            }

            .bookmarks-modal-title {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 20px;
                font-weight: 600;
                color: var(--fgColor-default, var(--color-fg-default));
                margin: 0;
            }

            .bookmarks-modal-close {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                padding: 0;
                background: transparent;
                border: 0;
                border-radius: 6px;
                color: var(--fgColor-muted, var(--color-fg-muted));
                cursor: pointer;
            }

            .bookmarks-modal-close:hover {
                background-color: var(--bgColor-neutral-muted, var(--color-neutral-muted));
            }

            /* UPDATED: Bookmarks filter layout */
            .bookmarks-filter {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 24px 24px 24px 24px;
                flex-wrap: wrap;
            }

            .bookmarks-filter-left {
                display: flex;
                gap: 8px;
                align-items: center;
                flex-wrap: wrap;
                flex: 1;
            }

            .bookmarks-filter-right {
                display: flex;
                gap: 8px;
                align-items: center;
                flex-shrink: 0;
            }

            .bookmarks-filter-separator {
                width: 1px;
                height: 20px;
                background-color: var(--borderColor-muted, var(--color-border-muted));
            }

            .bookmarks-manage-btn {
                padding: 5px 12px;
                border: 1px solid var(--button-default-borderColor-rest, var(--color-btn-border));
                border-radius: 6px;
                background-color: var(--button-default-bgColor-rest, var(--color-btn-bg));
                color: var(--button-default-fgColor-rest, var(--color-btn-text));
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                white-space: nowrap;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                flex-shrink: 0;
                height: 32px;
            }

            .bookmarks-manage-btn:hover {
                background-color: var(--button-default-bgColor-hover, var(--color-btn-hover-bg));
                border-color: var(--button-default-borderColor-hover, var(--color-btn-hover-border));
            }

            .bookmarks-filter-btn {
                padding: 5px 16px;
                border: 1px solid var(--button-default-borderColor-rest, var(--color-btn-border));
                border-radius: 6px;
                background-color: var(--button-default-bgColor-rest, var(--color-btn-bg));
                color: var(--button-default-fgColor-rest, var(--color-btn-text));
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                white-space: nowrap;
                display: flex;
                align-items: center;
                gap: 6px;
                height: 32px;
            }

            .bookmarks-filter-btn:hover {
                background-color: var(--button-default-bgColor-hover, var(--color-btn-hover-bg));
                border-color: var(--button-default-borderColor-hover, var(--color-btn-hover-border));
            }

            .bookmarks-filter-btn.active {
                background-color: var(--button-primary-bgColor-rest, var(--color-btn-primary-bg));
                border-color: var(--button-primary-bgColor-rest, var(--color-btn-primary-bg));
                color: var(--button-primary-fgColor-rest, var(--color-btn-primary-text));
            }

            .bookmarks-modal-content {
                flex: 1;
                overflow-y: auto;
                padding: 0px 24px 0px 24px;
                margin-bottom: 24px;
            }

            .bookmarks-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .bookmarks-empty {
                text-align: center;
                padding: 24px 48px 24px 72px;
                color: var(--fgColor-muted, var(--color-fg-muted));
            }

            .bookmarks-empty-icon {
                display: inline-block;
                margin-bottom: 24px;
                opacity: 0.5;
                scale: 3;
            }

            .bookmarks-empty-title {
                font-size: 24px;
                font-weight: 600;
                color: var(--fgColor-default, var(--color-fg-default));
                margin-bottom: 3px;
            }

            /* UPDATED: Bookmark item layout */
            .bookmark-item {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 12px 16px;
                background-color: var(--bgColor-default, var(--color-canvas-default));
                border: 1px solid var(--borderColor-default, var(--color-border-default));
                border-radius: 6px;
                cursor: pointer;
                position: relative;
            }

            .bookmark-item:hover {
                background-color: var(--bgColor-neutral-muted, var(--color-neutral-muted));
            }

            .bookmark-icon-container {
                flex-shrink: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: flex-start;
                justify-content: center;
                color: var(--fgColor-muted, var(--color-fg-muted));
                margin-top: 5px;
            }

            .bookmark-icon-container svg {
                width: 20px;
                height: 20px;
            }

            .bookmark-info {
                flex: 1;
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 4px;
                padding-right: 100px;
            }

            .bookmark-title {
                font-size: 14px;
                font-weight: 500;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .bookmark-title a {
                color: var(--fgColor-accent, var(--color-accent-fg));
                text-decoration: none;
                font-weight: 600;
            }

            .bookmark-title a:hover {
                text-decoration: underline;
            }

            .bookmark-description {
                font-size: 12px;
                color: var(--fgColor-muted, var(--color-fg-muted));
                line-height: 1.5;
            }

            /* UPDATED: Bookmark right container - aligned to the right */
            .bookmark-right-container {
                position: absolute;
                right: 16px;
                top: 50%;
                transform: translateY(-50%);
                display: flex;
                align-items: center;
                gap: 8px;
            }

            /* FIXED: Tag icon styling - linear version */
            .bookmark-list-tag-icon {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 28px;
                height: 28px;
                padding: 0;
                background: transparent;
                border: 1px solid var(--borderColor-default, var(--color-border-default));
                border-radius: 6px;
                color: var(--fgColor-muted, var(--color-fg-muted));
                cursor: pointer;
                fill: none;
                stroke: currentColor;
            }

            .bookmark-list-tag-icon:hover {
                background-color: var(--bgColor-neutral-muted, var(--color-neutral-muted));
                border-color: var(--borderColor-accent-muted, var(--color-accent-muted));
                color: var(--fgColor-accent, var(--color-accent-fg));
            }

            .bookmark-list-tag-icon svg {
                width: 14px;
                height: 14px;
                fill: none !important;
                stroke: currentColor;
                stroke-width: 1.5;
            }

            .bookmark-action-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 28px;
                height: 28px;
                padding: 0;
                background: transparent;
                border: 1px solid var(--borderColor-default, var(--color-border-default));
                border-radius: 6px;
                color: var(--fgColor-muted, var(--color-fg-muted));
                cursor: pointer;
            }

            .bookmark-action-btn:hover {
                background-color: var(--bgColor-neutral-muted, var(--color-neutral-muted));
                color: var(--danger-fgColor, var(--color-danger-fg));
                border-color: var(--danger-borderColor, var(--color-danger-emphasis));
            }

            .bookmark-list-dropdown {
                position: fixed;
                z-index: 10000;
                margin-top: 4px;
                width: 200px;
                background-color: var(--overlay-bgColor, var(--color-canvas-overlay));
                border: 1px solid var(--borderColor-default, var(--color-border-default));
                border-radius: 6px;
                box-shadow: var(--shadow-floating-medium);
                padding: 8px 0;
            }

            .bookmark-list-dropdown-item {
                display: flex;
                align-items: center;
                width: 100%;
                padding: 6px 16px;
                background: transparent;
                border: 0;
                color: var(--fgColor-default, var(--color-fg-default));
                font-size: 14px;
                text-align: left;
                cursor: pointer;
                gap: 8px;
            }

            .bookmark-list-dropdown-item:hover {
                background-color: var(--bgColor-neutral-muted, var(--color-neutral-muted));
            }

            /* List Management Modal */
            .list-management-modal {
                background-color: var(--overlay-bgColor, var(--color-canvas-overlay));
                border: 1px solid var(--borderColor-default, var(--color-border-default));
                border-radius: 12px;
                box-shadow: var(--shadow-floating-xlarge);
                width: 90%;
                max-width: 500px;
                max-height: 600px;
                display: flex;
                flex-direction: column;
            }

            .list-management-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 24px;
                border-bottom: 1px solid var(--borderColor-muted, var(--color-border-muted));
            }

            .list-management-title {
                font-size: 18px;
                font-weight: 600;
                color: var(--fgColor-default, var(--color-fg-default));
                margin: 0;
            }

            .list-management-content {
                flex: 1;
                overflow-y: auto;
                padding: 24px 24px 12px 24px;
            }

            .list-management-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                background-color: var(--bgColor-default, var(--color-canvas-default));
                border: 1px solid var(--borderColor-default, var(--color-border-default));
                border-radius: 6px;
                margin-bottom: 12px;
            }

            .list-management-item.default-list {
                background-color: var(--bgColor-neutral-muted, var(--color-neutral-muted));
                opacity: 0.7;
            }

            .list-management-item-name {
                flex: 1;
                font-size: 14px;
                font-weight: 500;
                color: var(--fgColor-default, var(--color-fg-default));
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .list-management-item-count {
                font-size: 12px;
                color: var(--fgColor-muted, var(--color-fg-muted));
                padding: 2px 8px;
                background-color: var(--bgColor-neutral-muted, var(--color-neutral-muted));
                border-radius: 12px;
            }

            .list-management-item-actions {
                display: flex;
                gap: 4px;
            }

            .list-management-action-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 28px;
                height: 28px;
                padding: 0;
                background: transparent;
                border: 1px solid var(--borderColor-default, var(--color-border-default));
                border-radius: 6px;
                color: var(--fgColor-muted, var(--color-fg-muted));
                cursor: pointer;
            }

            .list-management-action-btn:hover {
                background-color: var(--bgColor-neutral-muted, var(--color-neutral-muted));
            }

            .list-management-action-btn.danger:hover {
                background-color: var(--button-default-bgColor-hover, var(--color-btn-hover-bg));
                border-color: var(--button-default-borderColor-hover, var(--color-btn-hover-border));
                color: var(--button-default-fgColor-rest, var(--color-btn-text));
            }

            .list-management-action-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .list-management-footer {
                display: flex;
                padding: 24px;
                border-top: 1px solid var(--borderColor-muted, var(--color-border-muted));
            }

            .list-management-create-btn {
                width: 100%;
                padding: 8px 16px;
                border: 1px solid var(--button-default-borderColor-rest, var(--color-btn-border));
                border-radius: 6px;
                background-color: var(--button-default-bgColor-rest, var(--color-btn-bg));
                color: var(--button-default-fgColor-rest, var(--color-btn-text));
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
            }

            .list-management-create-btn:hover {
                background-color: var(--button-default-bgColor-hover, var(--color-btn-hover-bg));
                border-color: var(--button-default-borderColor-hover, var(--color-btn-hover-border));
            }

            .bookmarks-stats {
                padding: 16px 24px 16px 24px;
                border-top: 1px solid var(--borderColor-muted, var(--color-border-muted));
                font-size: 12px;
                color: var(--fgColor-muted, var(--color-fg-muted));
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .bookmarks-sync-section {
                display: flex;
                gap: 8px;
                align-items: center;
            }

            .bookmarks-sync-status {
                font-size: 11px;
                color: var(--fgColor-muted, var(--color-fg-muted));
            }

            .bookmarks-sync-help {
                position: relative;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 20px;
                height: 20px;
                cursor: help;
                color: var(--fgColor-muted, var(--color-fg-muted));
                margin-right: 3px;
            }

            .bookmarks-sync-help:hover {
                color: var(--fgColor-default, var(--color-fg-default));
            }

            .bookmarks-sync-help-tooltip {
                position: absolute;
                bottom: calc(100% + 8px);
                right: 0;
                width: 320px;
                padding: 12px;
                background-color: var(--overlay-bgColor, var(--color-canvas-overlay));
                border: 1px solid var(--borderColor-default, var(--color-border-default));
                border-radius: 6px;
                box-shadow: var(--shadow-floating-medium);
                font-size: 12px;
                line-height: 1.5;
                color: var(--fgColor-default, var(--color-fg-default));
                z-index: 10000;
                display: none;
            }

            .bookmarks-sync-help:hover .bookmarks-sync-help-tooltip {
                display: block;
            }

            .bookmarks-sync-help-tooltip h4 {
                margin: 0 0 8px 0;
                font-size: 13px;
                font-weight: 600;
            }

            .bookmarks-sync-help-tooltip ol {
                margin: 0;
                padding-left: 20px;
            }

            .bookmarks-sync-help-tooltip code {
                padding: 2px 4px;
                background-color: var(--bgColor-neutral-muted, var(--color-neutral-muted));
                border-radius: 3px;
                font-family: monospace;
                font-size: 11px;
            }

            /* Configure button styles */
            .bookmarks-sync-btn {
                padding: 5px 12px !important;
                border: 1px solid var(--button-default-borderColor-rest, var(--color-btn-border)) !important;
                border-radius: 6px !important;
                background-color: var(--button-default-bgColor-rest, var(--color-btn-bg)) !important;
                color: var(--button-default-fgColor-rest, var(--color-btn-text)) !important;
                font-size: 12px !important;
                font-weight: 500 !important;
                cursor: pointer !important;
                white-space: nowrap !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                text-decoration: none !important;
                height: 28px !important;
                line-height: 20px !important;
                transition: 80ms cubic-bezier(0.33, 1, 0.68, 1) !important;
                transition-property: color,background-color,box-shadow,border-color !important;
                position: relative !important;
            }

            .bookmarks-sync-btn:hover {
                background-color: var(--button-default-bgColor-hover, var(--color-btn-hover-bg)) !important;
                border-color: var(--button-default-borderColor-hover, var(--color-btn-hover-border)) !important;
                text-decoration: none !important;
            }

            .bookmarks-sync-btn:focus {
                outline: 2px solid var(--focus-outlineColor, var(--color-accent-fg)) !important;
                outline-offset: 2px !important;
            }

            .bookmarks-sync-btn:active {
                background-color: var(--button-default-bgColor-active, var(--color-btn-active-bg)) !important;
                border-color: var(--button-default-borderColor-active, var(--color-btn-active-border)) !important;
            }

            @media (max-width: 768px) {
                .bookmarks-filter {
                    flex-direction: column;
                    gap: 12px;
                    align-items: stretch;
                }

                .bookmarks-filter-left,
                .bookmarks-filter-right {
                    width: 100%;
                    justify-content: center;
                }

                .bookmarks-filter-separator-mobile {
                    width: 100%;
                    height: 1px;
                    background-color: var(--borderColor-muted, var(--color-border-muted));
                    margin: 4px 0;
                }

                .bookmark-info {
                    padding-right: 80px;
                }

                .bookmark-right-container {
                    gap: 4px;
                }
            }

            @media (prefers-color-scheme: dark) {
                .SelectMenu-checkbox:checked {
                    background-color: #1f6feb;
                    border-color: #1f6feb;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // ============================================================================
    // BOOKMARK BUTTON (REPO PAGES) - FIXED TOGGLE FUNCTIONALITY
    // ============================================================================

    function createSelectMenuDropdown(repo, repoUrl) {
        const modal = document.createElement('div');
        modal.className = 'SelectMenu-modal';

        const renderDropdown = async () => {
            modal.innerHTML = '<div class="bookmarks-loading">Loading...</div>';

            const header = document.createElement('div');
            header.className = 'SelectMenu-header';
            header.innerHTML = `
                <span class="SelectMenu-title">Lists</span>
                <button class="SelectMenu-closeButton" type="button" aria-label="Close menu">${ICONS.close}</button>
            `;

            header.querySelector('.SelectMenu-closeButton').addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const details = modal.closest('details');
                if (details) {
                    details.removeAttribute('open');
                }
            });

            const listContainer = document.createElement('div');
            listContainer.className = 'SelectMenu-list';

            // Get visible lists (excluding DEFAULT_LIST)
            const visibleLists = await Storage.getVisibleLists();

            // Add visible list checkboxes
            for (const listName of visibleLists) {
                const label = document.createElement('label');
                label.className = 'SelectMenu-item';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'SelectMenu-checkbox';
                checkbox.checked = await Storage.isBookmarkedInList(repo, listName);

                checkbox.addEventListener('change', async (e) => {
                    e.stopPropagation();
                    if (e.target.checked) {
                        await Storage.addBookmark(repo, repoUrl, listName);
                    } else {
                        await Storage.removeBookmark(repo, listName);
                    }
                    await renderDropdown();
                });

                const text = document.createElement('span');
                text.className = 'SelectMenu-item-text';
                text.textContent = listName;

                label.appendChild(checkbox);
                label.appendChild(text);
                listContainer.appendChild(label);
            }

            const footer = document.createElement('div');
            footer.className = 'SelectMenu-footer';
            const addButton = document.createElement('button');
            addButton.className = 'SelectMenu-item SelectMenu-item--add';
            addButton.innerHTML = `
                <span class="SelectMenu-plus-icon">${ICONS.plus}</span>
                <span class="SelectMenu-item-text">Create list</span>
            `;
            addButton.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const newList = prompt('Enter new list name:');
                if (newList?.trim()) {
                    await Storage.addList(newList.trim());
                    await renderDropdown();
                }
            });
            footer.appendChild(addButton);

            modal.innerHTML = '';
            modal.appendChild(header);
            modal.appendChild(listContainer);
            modal.appendChild(footer);
        };

        renderDropdown();
        return modal;
    }

    async function updateBookmarkButton() {
        const repoInfo = Repo.getInfo();
        if (!repoInfo) return;

        const mainButton = document.querySelector('.gh-bookmark-main-button');
        if (!mainButton) return;

        const { repo } = repoInfo;
        const bookmarked = await Storage.isBookmarked(repo);
        const totalCount = await Storage.getTotalCount();

        // Update icon
        const svg = mainButton.querySelector('svg');
        if (svg) {
            svg.outerHTML = bookmarked ? ICONS.bookmarkFilled : ICONS.bookmarkHollow;
            const newSvg = mainButton.querySelector('svg');
            if (newSvg && bookmarked) {
                newSvg.style.fill = '#da3633';
            }
        }

        // Update text
        const textSpan = mainButton.querySelector('span[data-bookmark-text="true"]');
        if (textSpan) {
            textSpan.textContent = bookmarked ? 'Bookmarked' : 'Bookmark';
        }

        // Update counter
        let counter = mainButton.querySelector('.Counter');
        if (totalCount > 0) {
            const countText = totalCount.toLocaleString();
            const countTitle = `${totalCount} bookmark${totalCount !== 1 ? 's' : ''}`;

            if (counter) {
                counter.textContent = countText;
                counter.setAttribute('title', countTitle);
            } else {
                counter = document.createElement('span');
                counter.className = 'Counter';
                counter.textContent = countText;
                counter.setAttribute('title', countTitle);
                mainButton.appendChild(counter);
            }
        } else if (counter) {
            counter.remove();
        }
    }

    async function addBookmarkButton() {
        const repoInfo = Repo.getInfo();
        if (!repoInfo || !Repo.isRepoPage()) return;

        const actionBar = document.querySelector('.pagehead-actions');
        if (!actionBar || document.querySelector('.gh-bookmark-container')) return;

        const starContainer = Array.from(actionBar.children).find(child =>
            child.querySelector('form[action*="/star"], form[action*="/unstar"]')
        );
        if (!starContainer) return;

        const starButton = starContainer.querySelector('button[type="submit"]');
        if (!starButton) return;

        const { repo, repoUrl } = repoInfo;
        const bookmarked = await Storage.isBookmarked(repo);
        const totalCount = await Storage.getTotalCount();

        // Create container
        const bookmarkContainer = document.createElement('li');
        bookmarkContainer.classList.add('gh-bookmark-container');

        // Clone and customize main button
        const mainButton = starButton.cloneNode(true);
        mainButton.classList.add('gh-bookmark-main-button', 'btn', 'btn-sm', 'gh-bookmark-btn');
        mainButton.type = 'button';
        mainButton.removeAttribute('name');
        mainButton.removeAttribute('value');
        mainButton.removeAttribute('data-hydro-click');
        mainButton.removeAttribute('data-hydro-click-hmac');
        mainButton.removeAttribute('data-ga-click');
        mainButton.style.borderTopRightRadius = '0';
        mainButton.style.borderBottomRightRadius = '0';
        mainButton.style.borderRight = '1px solid var(--borderColor-default, var(--color-border-default))';

        // Update icon
        const svg = mainButton.querySelector('svg');
        if (svg) {
            svg.outerHTML = bookmarked ? ICONS.bookmarkFilled : ICONS.bookmarkHollow;
            if (bookmarked) {
                const newSvg = mainButton.querySelector('svg');
                if (newSvg) newSvg.style.fill = '#da3633';
            }
        }

        // Update text
        const spans = mainButton.querySelectorAll('span');
        let textFound = false;
        for (const span of spans) {
            const text = span.textContent.trim();
            if ((text === 'Star' || text === 'Starred' || text === 'Unstar') && !span.children.length) {
                span.textContent = bookmarked ? 'Bookmarked' : 'Bookmark';
                span.setAttribute('data-bookmark-text', 'true');
                textFound = true;
                break;
            }
        }

        if (!textFound) {
            const iconSpan = mainButton.querySelector('svg')?.parentElement;
            if (iconSpan?.nextElementSibling?.tagName === 'SPAN') {
                iconSpan.nextElementSibling.textContent = bookmarked ? 'Bookmarked' : 'Bookmark';
                iconSpan.nextElementSibling.setAttribute('data-bookmark-text', 'true');
            }
        }

        // Update counter
        let counter = mainButton.querySelector('.Counter');
        if (totalCount > 0) {
            const countText = totalCount.toLocaleString();
            const countTitle = `${totalCount} bookmark${totalCount !== 1 ? 's' : ''}`;

            if (counter) {
                counter.textContent = countText;
                counter.setAttribute('title', countTitle);
            } else {
                counter = document.createElement('span');
                counter.className = 'Counter';
                counter.textContent = countText;
                counter.setAttribute('title', countTitle);
                mainButton.appendChild(counter);
            }
        } else if (counter) {
            counter.remove();
        }

        // FIXED: Proper toggle functionality
        mainButton.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const bookmarked = await Storage.isBookmarked(repo);
            if (bookmarked) {
                // Remove from all lists
                const lists = await Storage.getLists();
                for (const listName of lists) {
                    if (await Storage.isBookmarkedInList(repo, listName)) {
                        await Storage.removeBookmark(repo, listName);
                    }
                }
                // Also check DEFAULT_LIST
                if (await Storage.isBookmarkedInList(repo, DEFAULT_LIST)) {
                    await Storage.removeBookmark(repo, DEFAULT_LIST);
                }
            } else {
                // Add to DEFAULT_LIST (backend only)
                await Storage.addBookmark(repo, repoUrl, DEFAULT_LIST);
            }

            // Update the button immediately
            await updateBookmarkButton();
        };

        // Create button group with dropdown
        const btnGroup = document.createElement('div');
        btnGroup.className = 'BtnGroup d-flex';
        btnGroup.appendChild(mainButton);

        const summary = document.createElement('summary');
        summary.className = 'btn btn-sm gh-bookmark-dropdown gh-bookmark-dropdown-btn';
        summary.setAttribute('aria-haspopup', 'menu');
        summary.setAttribute('aria-label', 'Manage bookmark lists');
        summary.innerHTML = ICONS.triangleDown;

        const details = document.createElement('details');
        details.className = 'details-reset details-overlay d-inline-block position-relative gh-bookmark-details';

        const menuContainer = document.createElement('details-menu');
        menuContainer.className = 'SelectMenu';
        menuContainer.setAttribute('role', 'menu');
        menuContainer.appendChild(createSelectMenuDropdown(repo, repoUrl));

        details.appendChild(summary);
        details.appendChild(menuContainer);
        btnGroup.appendChild(details);
        bookmarkContainer.appendChild(btnGroup);

        // Close dropdown on outside click
        const closeHandler = (e) => {
            if (e && e.target && typeof e.target.closest === 'function') {
                if (!details.contains(e.target) && details.hasAttribute('open')) {
                    details.removeAttribute('open');
                }
            }
        };
        document.addEventListener('click', closeHandler);

        actionBar.insertBefore(bookmarkContainer, starContainer);
    }

    // ============================================================================
    // BOOKMARKS VIEWER MODAL - UPDATED WITH FIXED TAG ICON
    // ============================================================================

    async function renderBookmarksModal(contentEl, filterEl, statsEl, activeFilter = 'All') {
        contentEl.innerHTML = '<div class="bookmarks-loading">Loading...</div>';
        filterEl.innerHTML = '';

        // Force cache invalidation to ensure fresh data
        Storage.invalidateCache();
        const bookmarks = await Storage.getBookmarks();

        // Create container for left side (filter buttons)
        const filterLeft = document.createElement('div');
        filterLeft.className = 'bookmarks-filter-left';

        // Create container for right side (Manage lists button)
        const filterRight = document.createElement('div');
        filterRight.className = 'bookmarks-filter-right';

        // Add "All" button (only in modal) - LEFT SIDE
        const allBtn = document.createElement('button');
        allBtn.className = `bookmarks-filter-btn ${'All' === activeFilter ? 'active' : ''}`;
        allBtn.textContent = 'All';
        allBtn.dataset.listName = 'All';
        allBtn.addEventListener('click', () => {
            renderBookmarksModal(contentEl, filterEl, statsEl, 'All');
        });
        filterLeft.appendChild(allBtn);

        // Get visible lists (excluding DEFAULT_LIST)
        const visibleLists = await Storage.getVisibleLists();

        // Add separator after "All"
        const separator1 = document.createElement('div');
        separator1.className = 'bookmarks-filter-separator';
        filterLeft.appendChild(separator1);

        // Add visible list filter buttons
        visibleLists.forEach((listName) => {
            const btn = document.createElement('button');
            btn.className = `bookmarks-filter-btn ${listName === activeFilter ? 'active' : ''}`;
            btn.textContent = listName;
            btn.dataset.listName = listName;

            btn.addEventListener('click', () => {
                renderBookmarksModal(contentEl, filterEl, statsEl, listName);
            });

            filterLeft.appendChild(btn);
        });

        // Add "Manage lists" button to the RIGHT SIDE
        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'bookmarks-manage-btn';
        settingsBtn.innerHTML = `${ICONS.gear}`;
        settingsBtn.title = 'Manage Lists';
        settingsBtn.addEventListener('click', openListManagementModal);
        filterRight.appendChild(settingsBtn);

        // Add mobile separator after custom lists
        if (window.innerWidth <= 768) {
            const mobileSeparator = document.createElement('div');
            mobileSeparator.className = 'bookmarks-filter-separator-mobile';
            filterLeft.appendChild(mobileSeparator);
        }

        // Append both sides to the filter container
        filterEl.appendChild(filterLeft);
        filterEl.appendChild(filterRight);

        let displayBookmarks = [];
        if (activeFilter === 'All') {
            // Show all bookmarks from all lists including DEFAULT_LIST
            Object.entries(bookmarks).forEach(([listName, items]) => {
                items.forEach(item => {
                    const existing = displayBookmarks.find(b => b.repo === item.repo);
                    if (existing) {
                        // Only add list name if it's not DEFAULT_LIST
                        if (listName !== DEFAULT_LIST) {
                            existing.lists.push(listName);
                        }
                    } else {
                        displayBookmarks.push({
                            ...item,
                            lists: listName !== DEFAULT_LIST ? [listName] : []
                        });
                    }
                });
            });
        } else if (bookmarks[activeFilter]) {
            // Show bookmarks from specific list
            displayBookmarks = bookmarks[activeFilter].map(item => ({
                ...item,
                lists: [activeFilter]
            }));
        }

        contentEl.innerHTML = '';

        if (displayBookmarks.length === 0) {
            contentEl.innerHTML = `
                <div class="bookmarks-empty">
                    <div class="bookmarks-empty-icon">${ICONS.bookmarkHollow}</div>
                    <div class="bookmarks-empty-title">No bookmarks yet</div>
                    <div class="bookmarks-empty-text">Start bookmarking repositories to see them here!</div>
                </div>
            `;
            statsEl.querySelector('.bookmarks-stats-text').textContent = 'No bookmarks';
        } else {
            const listEl = document.createElement('div');
            listEl.className = 'bookmarks-list';

            for (const bookmark of displayBookmarks) {
                const item = document.createElement('div');
                item.className = 'bookmark-item';
                item.dataset.repo = bookmark.repo;

                // Get visible lists for this bookmark (excluding DEFAULT_LIST)
                const visibleLists = await Storage.getVisibleLists();
                const currentLists = [];
                for (const listName of visibleLists) {
                    if (await Storage.isBookmarkedInList(bookmark.repo, listName)) {
                        currentLists.push(listName);
                    }
                }

                // Check if bookmark is in DEFAULT_LIST (backend only)
                const isInDefaultList = await Storage.isBookmarkedInList(bookmark.repo, DEFAULT_LIST);
                const showTagIcon = currentLists.length > 0 || isInDefaultList;

                item.innerHTML = `
                    <div class="bookmark-icon-container">${ICONS.bookmarkHollow}</div>
                    <div class="bookmark-info">
                        <div class="bookmark-title">
                            <a href="${bookmark.repoUrl}" target="_blank" rel="noopener noreferrer">${bookmark.repo}</a>
                        </div>
                        <div class="bookmark-description">${bookmark.repoUrl}</div>
                    </div>
                    ${showTagIcon ? `
                        <div class="bookmark-right-container">
                            <button class="bookmark-list-tag-icon" title="Manage lists" data-repo="${bookmark.repo}">
                                ${ICONS.tag}
                            </button>
                            <button class="bookmark-action-btn danger" title="Remove bookmark" data-repo="${bookmark.repo}">
                                ${ICONS.trash}
                            </button>
                        </div>
                    ` : `
                        <div class="bookmark-right-container">
                            <button class="bookmark-action-btn danger" title="Remove bookmark" data-repo="${bookmark.repo}">
                                ${ICONS.trash}
                            </button>
                        </div>
                    `}
                `;

                item.addEventListener('click', (e) => {
                    if (e && e.target && typeof e.target.closest === 'function') {
                        if (!e.target.closest('.bookmark-right-container')) {
                            window.open(bookmark.repoUrl, '_blank');
                        }
                    }
                });

                const tagIcon = item.querySelector('.bookmark-list-tag-icon');
                if (tagIcon) {
                    tagIcon.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showListManagementDropdown(tagIcon, bookmark.repo, currentLists);
                    });
                }

                const removeBtn = item.querySelector('.bookmark-action-btn.danger');
                removeBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const repo = removeBtn.dataset.repo;

                    if (confirm(`Remove "${repo}" from all lists?`)) {
                        // Immediately hide the item with a fade-out animation
                        const bookmarkItem = removeBtn.closest('.bookmark-item');
                        if (bookmarkItem) {
                            bookmarkItem.style.opacity = '0';
                            bookmarkItem.style.transition = 'opacity 0.2s ease-out';
                            bookmarkItem.style.pointerEvents = 'none';
                        }

                        // Remove from all lists including DEFAULT_LIST
                        const allLists = await Storage.getLists();
                        for (const listName of allLists) {
                            if (await Storage.isBookmarkedInList(repo, listName)) {
                                await Storage.removeBookmark(repo, listName);
                            }
                        }
                        // Also remove from DEFAULT_LIST if it exists
                        if (await Storage.isBookmarkedInList(repo, DEFAULT_LIST)) {
                            await Storage.removeBookmark(repo, DEFAULT_LIST);
                        }

                        // Invalidate cache and re-render immediately
                        Storage.invalidateCache();
                        await renderBookmarksModal(contentEl, filterEl, statsEl, activeFilter);
                    }
                });

                listEl.appendChild(item);
            }

            contentEl.appendChild(listEl);

            const total = displayBookmarks.length;
            statsEl.querySelector('.bookmarks-stats-text').textContent =
                `${total} bookmark${total !== 1 ? 's' : ''}`;
        }
    }

    // ============================================================================
    // THE REST OF THE FUNCTIONS (unchanged from previous working version)
    // ============================================================================

    // [All other functions remain exactly as they were in your previous working script]
    // Including: showListManagementDropdown, openListManagementModal, renderListManagementContent,
    // closeListManagementModal, openBookmarksModal, configureSyncToken, closeBookmarksModal,
    // addBookmarksToProfileMenu, addBookmarksTabToProfilePage, event listeners, init,
    // watchForProfileMenu, start]

    // Let me just show the key functions that need to be kept from the previous version:

    function showListManagementDropdown(targetElement, repo, currentLists) {
        const existing = document.querySelector('.bookmark-list-dropdown');
        if (existing) {
            if (existing.dataset.targetRepo === repo) {
                existing.remove();
                return;
            }
            existing.remove();
        }

        const dropdown = document.createElement('div');
        dropdown.className = 'bookmark-list-dropdown';
        dropdown.dataset.targetRepo = repo;

        (async () => {
            // Get all lists including DEFAULT_LIST for backend management
            const allLists = await Storage.getLists();
            const bookmarks = await Storage.getBookmarks();

            let repoUrl = '';
            for (const [listName, items] of Object.entries(bookmarks)) {
                const found = items.find(b => b.repo === repo);
                if (found) {
                    repoUrl = found.repoUrl;
                    break;
                }
            }

            for (const listName of allLists) {
                const item = document.createElement('label');
                item.className = 'bookmark-list-dropdown-item';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';

                // Check if bookmark is in this list
                const isInList = listName === DEFAULT_LIST ?
                    await Storage.isBookmarkedInList(repo, DEFAULT_LIST) :
                    currentLists.includes(listName);
                checkbox.checked = isInList;

                // For DEFAULT_LIST, show it but with lock icon
                if (listName === DEFAULT_LIST) {
                    checkbox.disabled = true;
                    checkbox.title = 'Default list (cannot be modified)';
                }

                checkbox.addEventListener('change', async (e) => {
                    if (listName === DEFAULT_LIST) return; // Skip for DEFAULT_LIST

                    e.stopPropagation();
                    if (e.target.checked) {
                        await Storage.addBookmark(repo, repoUrl, listName);
                    } else {
                        await Storage.removeBookmark(repo, listName);
                    }

                    // Update current lists
                    const newLists = [];
                    for (const list of allLists) {
                        if (list === DEFAULT_LIST) continue; // Skip DEFAULT_LIST
                        if (await Storage.isBookmarkedInList(repo, list)) {
                            newLists.push(list);
                        }
                    }

                    // Update the tag icon
                    const rightContainer = document.querySelector(`.bookmark-item[data-repo="${repo}"] .bookmark-right-container`);
                    if (rightContainer) {
                        const isInDefaultList = await Storage.isBookmarkedInList(repo, DEFAULT_LIST);
                        const showTagIcon = newLists.length > 0 || isInDefaultList;

                        if (showTagIcon) {
                            if (!rightContainer.querySelector('.bookmark-list-tag-icon')) {
                                const tagIcon = document.createElement('button');
                                tagIcon.className = 'bookmark-list-tag-icon';
                                tagIcon.title = 'Manage lists';
                                tagIcon.setAttribute('data-repo', repo);
                                tagIcon.innerHTML = ICONS.tag;

                                tagIcon.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    showListManagementDropdown(tagIcon, repo, newLists);
                                });

                                rightContainer.insertBefore(tagIcon, rightContainer.firstChild);
                            }
                        } else {
                            const tagIcon = rightContainer.querySelector('.bookmark-list-tag-icon');
                            if (tagIcon) {
                                tagIcon.remove();
                            }
                        }
                    }
                });

                const text = document.createElement('span');
                text.className = 'SelectMenu-item-text';

                if (listName === DEFAULT_LIST) {
                    text.innerHTML = `${listName} ${ICONS.lock}`;
                } else {
                    text.textContent = listName;
                }

                item.appendChild(checkbox);
                item.appendChild(text);
                dropdown.appendChild(item);
            }

            const rect = targetElement.getBoundingClientRect();
            dropdown.style.left = rect.left + 'px';
            dropdown.style.top = (rect.bottom + 4) + 'px';

            document.body.appendChild(dropdown);

            const closeDropdown = (e) => {
                if (e && e.target) {
                    if (!dropdown.contains(e.target) && e.target !== targetElement) {
                        dropdown.remove();
                        document.removeEventListener('click', closeDropdown);
                    }
                }
            };
            setTimeout(() => document.addEventListener('click', closeDropdown), 0);
        })();
    }

    function openListManagementModal() {
        const overlay = document.createElement('div');
        overlay.className = 'bookmarks-modal-overlay';

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeListManagementModal();
            }
        });

        const modal = document.createElement('div');
        modal.className = 'list-management-modal';

        const header = document.createElement('div');
        header.className = 'list-management-header';

        const title = document.createElement('h3');
        title.className = 'list-management-title';
        title.textContent = 'Manage Lists';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'bookmarks-modal-close';
        closeBtn.innerHTML = ICONS.close;
        closeBtn.addEventListener('click', closeListManagementModal);

        header.appendChild(title);
        header.appendChild(closeBtn);

        const content = document.createElement('div');
        content.className = 'list-management-content';

        renderListManagementContent(content);

        const footer = document.createElement('div');
        footer.className = 'list-management-footer';

        const createBtn = document.createElement('button');
        createBtn.className = 'list-management-create-btn';
        createBtn.innerHTML = `${ICONS.plus} Create List`;
        createBtn.addEventListener('click', async () => {
            const newList = prompt('Enter new list name:');
            if (newList?.trim()) {
                if (await Storage.addList(newList.trim())) {
                    await renderListManagementContent(content);
                    Storage.dispatchUpdate();
                } else {
                    alert('A list with that name already exists.');
                }
            }
        });

        footer.appendChild(createBtn);

        modal.appendChild(header);
        modal.appendChild(content);
        modal.appendChild(footer);
        overlay.appendChild(modal);

        document.body.appendChild(overlay);

        const escapeHandler = (e) => {
            if (e.key === 'Escape') closeListManagementModal();
        };
        document.addEventListener('keydown', escapeHandler);
        overlay.escapeHandler = escapeHandler;
    }

    async function renderListManagementContent(content) {
        content.innerHTML = '<div class="bookmarks-loading">Loading...</div>';

        const allLists = await Storage.getLists();
        const bookmarks = await Storage.getBookmarks();

        content.innerHTML = '';

        allLists.forEach((listName, index) => {
            const item = document.createElement('div');
            item.className = 'list-management-item';
            if (listName === DEFAULT_LIST) {
                item.classList.add('default-list');
            }
            item.draggable = listName !== DEFAULT_LIST;
            item.dataset.listName = listName;
            item.dataset.index = index;

            const dragHandle = document.createElement('div');
            dragHandle.className = 'list-management-item-drag-handle';
            dragHandle.innerHTML = ICONS.gripVertical;
            if (listName === DEFAULT_LIST) {
                dragHandle.style.opacity = '0.3';
                dragHandle.style.cursor = 'not-allowed';
            }

            const name = document.createElement('div');
            name.className = 'list-management-item-name';
            if (listName === DEFAULT_LIST) {
                name.innerHTML = `${listName} ${ICONS.lock}`;
            } else {
                name.textContent = listName;
            }

            const count = document.createElement('div');
            count.className = 'list-management-item-count';
            const itemCount = bookmarks[listName]?.length || 0;
            count.textContent = `${itemCount} item${itemCount !== 1 ? 's' : ''}`;

            const actions = document.createElement('div');
            actions.className = 'list-management-item-actions';

            const renameBtn = document.createElement('button');
            renameBtn.className = 'list-management-action-btn';
            renameBtn.innerHTML = ICONS.pencil;
            renameBtn.title = 'Rename list';
            renameBtn.disabled = listName === DEFAULT_LIST;
            renameBtn.addEventListener('click', async () => {
                const newName = prompt(`Rename list "${listName}" to:`, listName);
                if (newName?.trim() && newName.trim() !== listName) {
                    if (await Storage.renameList(listName, newName.trim())) {
                        await renderListManagementContent(content);
                        Storage.dispatchUpdate();
                    }
                }
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'list-management-action-btn danger';
            deleteBtn.innerHTML = ICONS.trash;
            deleteBtn.title = 'Delete list';
            deleteBtn.disabled = listName === DEFAULT_LIST;
            deleteBtn.addEventListener('click', async () => {
                const itemCount = bookmarks[listName]?.length || 0;
                const message = itemCount > 0
                    ? `Delete list "${listName}" and remove ${itemCount} bookmark${itemCount !== 1 ? 's' : ''}?`
                    : `Delete list "${listName}"?`;

                if (confirm(message)) {
                    if (await Storage.deleteList(listName)) {
                        await renderListManagementContent(content);
                        Storage.dispatchUpdate();
                    }
                }
            });

            actions.appendChild(renameBtn);
            actions.appendChild(deleteBtn);

            item.appendChild(dragHandle);
            item.appendChild(name);
            item.appendChild(count);
            item.appendChild(actions);

            content.appendChild(item);
        });
    }

    function closeListManagementModal() {
        const overlays = document.querySelectorAll('.bookmarks-modal-overlay');
        overlays.forEach(overlay => {
            if (overlay.querySelector('.list-management-modal')) {
                if (overlay.escapeHandler) {
                    document.removeEventListener('keydown', overlay.escapeHandler);
                }
                overlay.remove();
            }
        });
    }

    function openBookmarksModal() {
        if (modalOpen) return;
        modalOpen = true;
        Storage.setModalOpen(true);

        const overlay = document.createElement('div');
        overlay.className = 'bookmarks-modal-overlay';

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeBookmarksModal();
            }
        });

        const modal = document.createElement('div');
        modal.className = 'bookmarks-modal';

        const header = document.createElement('div');
        header.className = 'bookmarks-modal-header';

        const title = document.createElement('h2');
        title.className = 'bookmarks-modal-title';
        title.innerHTML = `<span>Your Bookmarks</span>`;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'bookmarks-modal-close';
        closeBtn.innerHTML = ICONS.close;
        closeBtn.addEventListener('click', closeBookmarksModal);

        header.appendChild(title);
        header.appendChild(closeBtn);

        const filterContainer = document.createElement('div');
        filterContainer.className = 'bookmarks-filter';

        const content = document.createElement('div');
        content.className = 'bookmarks-modal-content';

        const stats = document.createElement('div');
        stats.className = 'bookmarks-stats';

        const statsText = document.createElement('span');
        statsText.className = 'bookmarks-stats-text';
        stats.appendChild(statsText);

        const syncSection = document.createElement('div');
        syncSection.className = 'bookmarks-sync-section';

        const syncStatus = document.createElement('span');
        syncStatus.className = 'bookmarks-sync-status';
        const token = Storage.getSyncToken();
        const gistId = Storage.getGistId();
        syncStatus.textContent = (token && gistId) ? '✓ Synced' : 'Configure sync';

        const configBtn = document.createElement('button');
        configBtn.className = 'bookmarks-sync-btn';
        configBtn.textContent = 'Configure';
        configBtn.addEventListener('click', configureSyncToken);

        const helpIcon = document.createElement('div');
        helpIcon.className = 'bookmarks-sync-help';
        helpIcon.innerHTML = `
            ${ICONS.questionMark}
            <div class="bookmarks-sync-help-tooltip">
                <p><strong>Instructions:</strong></p>
                <ol>
                    <li>Click "Configure"</li>
                    <li>Create token at <code>github.com/settings/tokens/new</code></li>
                    <li>Grant only the <strong>gist</strong> scope</li>
                    <li>Paste the token when prompted</li>
                </ol>
            </div>
        `;

        syncSection.appendChild(syncStatus);
        syncSection.appendChild(helpIcon);
        syncSection.appendChild(configBtn);
        stats.appendChild(syncSection);

        modal.appendChild(header);
        modal.appendChild(filterContainer);
        modal.appendChild(content);
        modal.appendChild(stats);
        overlay.appendChild(modal);

        renderBookmarksModal(content, filterContainer, stats, 'All');

        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        const escapeHandler = (e) => {
            if (e.key === 'Escape') closeBookmarksModal();
        };
        document.addEventListener('keydown', escapeHandler);
        overlay.escapeHandler = escapeHandler;
    }

    function configureSyncToken() {
        const currentToken = Storage.getSyncToken();
        const message = currentToken
            ? 'Enter new GitHub Personal Access Token (leave empty to keep current):\n\nRequired scope: gist'
            : 'Enter GitHub Personal Access Token:\n\nRequired scope: gist\n\nCreate one at: ' + SYNC_HELP_URL;

        const token = prompt(message, '');

        if (token !== null && token.trim() !== '') {
            Storage.setSyncToken(token.trim());
            alert('Sync token saved! Your bookmarks will now sync automatically with GitHub Gist.');
            const syncStatus = document.querySelector('.bookmarks-sync-status');
            if (syncStatus) {
                const gistId = Storage.getGistId();
                syncStatus.textContent = gistId ? '✓ Synced' : '✓ Token configured';
            }
        }
    }

    function closeBookmarksModal() {
        const modal = document.querySelector('.bookmarks-modal-overlay');
        if (modal) {
            document.removeEventListener('keydown', modal.escapeHandler);
            modal.remove();
            modalOpen = false;
            Storage.setModalOpen(false);
            document.body.style.overflow = '';
        }
    }

    async function addBookmarksToProfileMenu() {
        const reposLink = document.querySelector('a[href*="?tab=repositories"]');
        if (!reposLink) return;

        const parentList = reposLink.closest('ul');
        if (!parentList || !parentList.className.includes('prc-ActionList')) return;

        if (parentList.querySelector('.gh-bookmarks-profile-item')) return;

        const reposLi = reposLink.parentElement;
        if (!reposLi) return;

        const bookmarksLi = reposLi.cloneNode(true);
        const bookmarksLink = bookmarksLi.querySelector('a');

        if (!bookmarksLink) return;

        bookmarksLi.classList.add('gh-bookmarks-profile-item');

        bookmarksLink.removeAttribute('href');
        bookmarksLink.removeAttribute('id');
        bookmarksLink.style.cursor = 'pointer';

        const iconContainer = bookmarksLink.querySelector('svg')?.parentElement;
        if (iconContainer) {
            const svg = iconContainer.querySelector('svg');
            if (svg) {
                svg.outerHTML = ICONS.bookmarkHollow;
            }
        }

        const labelSpan = bookmarksLink.querySelector('[id$="--label"]');
        if (labelSpan) {
            labelSpan.textContent = 'Bookmarks';
        }

        bookmarksLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openBookmarksModal();

            document.querySelectorAll('details[open]').forEach(details => {
                details.removeAttribute('open');
            });
        });

        reposLi.parentElement.insertBefore(bookmarksLi, reposLi.nextSibling);
    }

    async function addBookmarksTabToProfilePage() {
        const profileNav = document.querySelector('nav.UnderlineNav, nav[aria-label="User"]');
        if (!profileNav || profileNav.querySelector('.gh-bookmarks-tab')) return;

        const starsLink = profileNav.querySelector('a[href*="?tab=stars"], a#stars-tab');
        if (!starsLink) return;

        const starsContainer = starsLink.closest('li');
        if (!starsContainer) return;

        const bookmarksContainer = starsContainer.cloneNode(true);
        bookmarksContainer.classList.add('gh-bookmarks-tab');

        const bookmarksLink = bookmarksContainer.querySelector('a');
        if (!bookmarksLink) return;

        bookmarksLink.removeAttribute('href');
        bookmarksLink.removeAttribute('id');
        bookmarksLink.removeAttribute('data-turbo-frame');
        bookmarksLink.removeAttribute('data-hovercard-type');
        bookmarksLink.removeAttribute('data-hovercard-url');
        bookmarksLink.removeAttribute('data-tab-item');
        bookmarksLink.removeAttribute('data-selected-links');
        bookmarksLink.removeAttribute('data-hydro-click');
        bookmarksLink.removeAttribute('data-hydro-click-hmac');
        bookmarksLink.removeAttribute('aria-current');
        bookmarksLink.style.cursor = 'pointer';

        const svg = bookmarksLink.querySelector('svg');
        if (svg) {
            svg.outerHTML = ICONS.bookmarkHollow;
            const newSvg = bookmarksLink.querySelector('svg');
            if (newSvg) {
                newSvg.style.width = '16px';
                newSvg.style.height = '16px';
                newSvg.style.marginRight = '6px';
                newSvg.style.position = 'relative';
                newSvg.style.top = '1px';
                newSvg.style.fill = 'var(--fgColor-muted)';
            }
        }

        const spans = bookmarksLink.querySelectorAll('span');
        for (const span of spans) {
            const text = span.textContent.trim();
            if (text === 'Stars') {
                span.textContent = 'Bookmarks';
            } else if (text.match(/^\d+$/)) {
                const totalCount = await Storage.getTotalCount();
                span.textContent = totalCount.toString();
                span.setAttribute('title', `${totalCount} bookmark${totalCount !== 1 ? 's' : ''}`);
            }
        }

        bookmarksLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openBookmarksModal();
        });

        starsContainer.parentElement.insertBefore(bookmarksContainer, starsContainer);
    }

    // ============================================================================
    // EVENT LISTENERS & INITIALIZATION
    // ============================================================================

    window.addEventListener('ghBookmarksUpdated', async () => {
        await updateBookmarkButton();

        const profileTab = document.querySelector('.gh-bookmarks-tab');
        if (profileTab) {
            const counterSpan = profileTab.querySelector('span[title*="bookmark"]');
            if (counterSpan) {
                const totalCount = await Storage.getTotalCount();
                counterSpan.textContent = totalCount.toString();
                counterSpan.setAttribute('title', `${totalCount} bookmark${totalCount !== 1 ? 's' : ''}`);
            }
        }

        if (modalOpen) {
            const modal = document.querySelector('.bookmarks-modal');
            if (modal) {
                const content = modal.querySelector('.bookmarks-modal-content');
                const filter = modal.querySelector('.bookmarks-filter');
                const stats = modal.querySelector('.bookmarks-stats');
                if (content && filter && stats) {
                    const activeFilter = filter.querySelector('.bookmarks-filter-btn.active');
                    await renderBookmarksModal(content, filter, stats, activeFilter?.textContent || 'All');
                }
            }
        }
    });

    async function init() {
        injectStyles();

        // Check if modal was open before page refresh
        if (Storage.getModalOpen()) {
            setTimeout(() => {
                openBookmarksModal();
            }, 1000);
        }

        if (Repo.isRepoPage()) {
            setTimeout(addBookmarkButton, 500);
        }

        setTimeout(addBookmarksToProfileMenu, 500);
        setTimeout(addBookmarksTabToProfilePage, 500);
    }

    function watchForProfileMenu() {
        const observer = new MutationObserver(() => {
            addBookmarksToProfileMenu();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['open']
        });
    }

    async function start() {
        const token = Storage.getSyncToken();
        if (!token) {
            console.log('GitHub Bookmarks: No sync token configured. Please configure in the bookmarks modal.');
        } else {
            await Storage.initialize();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                init();
                watchForProfileMenu();
            });
        } else {
            init();
            watchForProfileMenu();
        }

        let lastUrl = location.href;
        new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                setTimeout(init, 500);
            }
        }).observe(document, { subtree: true, childList: true });
    }

    start();

})();
