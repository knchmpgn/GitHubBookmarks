// ==UserScript==
// @name         GitHub Bookmarks
// @namespace    http://tampermonkey.net/
// @version      6.2.0
// @description  Complete system to bookmark GitHub repositories with lists, Gist sync, drag-and-drop sorting, and dedicated page view.
// @icon         https://github.githubassets.com/pinned-octocat.svg
// @author       knchmpgn
// @match        https://github.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @require      https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js
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
        SORT_PREFERENCE: 'ghBookmarkSortPreference'
    };

    const DEFAULT_LIST = 'Unassigned';
    const SYNC_HELP_URL = 'https://github.com/settings/tokens/new';
    const CACHE_DURATION = 30000; // 30 seconds
    const GIST_FILENAME = 'github-bookmarks.json';
    const BOOKMARKS_PAGE_PATH = '/bookmarked-repositories';

    // Sort options
    const SORT_OPTIONS = {
        'manual': 'Manual (drag to reorder)',
        'alpha-asc': 'Name (A-Z)',
        'alpha-desc': 'Name (Z-A)',
        'date-desc': 'Newest first',
        'date-asc': 'Oldest first'
    };

    // SVG Icons
    const ICONS = {
        bookmarkHollow: `<svg class="octicon octicon-bookmark" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M3 2.75C3 1.784 3.784 1 4.75 1h6.5c.966 0 1.75.784 1.75 1.75v11.5a.75.75 0 0 1-1.227.579L8 11.722l-3.773 3.107A.75.75 0 0 1 3 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.91l3.023-2.489a.75.75 0 0 1 .954 0l3.023 2.49V2.75a.25.25 0 0 0-.25-.25Z"></path></svg>`,
        bookmarkFilled: `<svg class="octicon octicon-bookmark-fill" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M3 2.75C3 1.784 3.784 1 4.75 1h6.5c.966 0 1.75.784 1.75 1.75v11.5a.75.75 0 0 1-1.227.579L8 11.722l-3.773 3.107A.75.75 0 0 1 3 14.25Z"></path></svg>`,
        triangleDown: `<svg class="octicon octicon-triangle-down" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="m4.427 7.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"></path></svg>`,
        close: `<svg class="octicon octicon-x" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path></svg>`,
        plus: `<svg class="octicon octicon-plus" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"></path></svg>`,
        trash: `<svg class="octicon" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z"></path></svg>`,
        questionMark: `<svg class="octicon" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.92 6.085h.001a.749.749 0 1 1-1.342-.67c.169-.339.436-.701.849-.977C6.845 4.16 7.369 4 8 4a2.756 2.756 0 0 1 1.638.525c.503.377.862.965.862 1.725 0 .448-.115.83-.329 1.15-.205.307-.47.513-.692.662-.109.072-.22.138-.313.195l-.006.004a6.24 6.24 0 0 0-.26.16.952.952 0 0 0-.276.245.75.75 0 0 1-1.248-.832c.184-.264.42-.489.692-.661.103-.067.207-.132.313-.195l.007-.004c.1-.061.182-.11.258-.161a.969.969 0 0 0 .277-.245C8.96 6.514 9 6.427 9 6.25c0-.412-.155-.826-.57-1.12A1.256 1.256 0 0 0 8 4.75c-.361 0-.67.1-.894.27-.228.173-.4.412-.534.714v.001ZM8 11a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>`,
        pencil: `<svg class="octicon" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064Zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354Z"></path></svg>`,
        tag: `<svg class="octicon octicon-tag" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M1 7.775V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 0 1 0 2.474l-5.026 5.026a1.75 1.75 0 0 1-2.474 0l-6.25-6.25A1.752 1.752 0 0 1 1 7.775Z"></path></svg>`,
        search: `<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" fill="currentColor" class="octicon octicon-search"><path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"></path></svg>`,
        sync: `<svg class="octicon octicon-sync" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z"></path></svg>`,
        download: `<svg class="octicon octicon-download" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z"></path><path d="M7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.06l1.97 1.969Z"></path></svg>`,
        upload: `<svg class="octicon octicon-upload" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M3 9a.75.75 0 0 1 .75.75v2.5c0 .138.112.25.25.25h8a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 12 14H4a1.75 1.75 0 0 1-1.75-1.75v-2.5A.75.75 0 0 1 3 9Z"></path><path d="M8.75 3.561V10a.75.75 0 0 1-1.5 0V3.56L5.28 5.53a.749.749 0 1 1-1.06-1.06l3.25-3.25a.749.749 0 0 1 1.06 0l3.25 3.25a.749.749 0 1 1-1.06 1.06L8.75 3.56Z"></path></svg>`,
        sort: `<svg class="octicon" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M0 4.75A.75.75 0 0 1 .75 4h14.5a.75.75 0 0 1 0 1.5H.75A.75.75 0 0 1 0 4.75Zm0 3.5A.75.75 0 0 1 .75 7.5h10.5a.75.75 0 0 1 0 1.5H.75A.75.75 0 0 1 0 8.25Zm0 3.5a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5H.75a.75.75 0 0 1-.75-.75Z"></path></svg>`,
        chevronDown: `<svg class="octicon" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M12.78 6.22a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L3.22 7.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L8 9.94l3.72-3.72a.75.75 0 0 1 1.06 0Z"></path></svg>`,
        grabber: `<svg class="octicon" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M10 13a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm0-4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm0-4a1 1 0 1 1 0-2 1 1 0 0 1 0 2ZM6 13a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm0-4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm0-4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>`
    };

    let syncInProgress = false;

    // ============================================================================
    // GIST-BASED STORAGE UTILITIES
    // ============================================================================

    const Storage = {
        cache: null,
        cacheTimestamp: 0,

        getSyncToken() {
            return GM_getValue(STORAGE_KEYS.SYNC_TOKEN, '');
        },

        setSyncToken(token) {
            GM_setValue(STORAGE_KEYS.SYNC_TOKEN, token);
        },

        getGistId() {
            return GM_getValue(STORAGE_KEYS.SYNC_GIST_ID, '');
        },

        setGistId(id) {
            GM_setValue(STORAGE_KEYS.SYNC_GIST_ID, id);
        },

        getSortPreference() {
            return GM_getValue(STORAGE_KEYS.SORT_PREFERENCE, 'alpha-asc');
        },

        setSortPreference(pref) {
            GM_setValue(STORAGE_KEYS.SORT_PREFERENCE, pref);
        },

        isCacheValid() {
            return this.cache && (Date.now() - this.cacheTimestamp < CACHE_DURATION);
        },

        invalidateCache() {
            this.cache = null;
            this.cacheTimestamp = 0;
        },

        async findExistingGist(token) {
            try {
                let page = 1;
                let foundGistId = null;

                while (!foundGistId) {
                    const response = await fetch(`https://api.github.com/gists?per_page=100&page=${page}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/vnd.github+json',
                            'X-GitHub-Api-Version': '2022-11-28'
                        }
                    });

                    if (!response.ok) break;

                    const gists = await response.json();
                    if (gists.length === 0) break;

                    const found = gists.find(gist => gist.files && gist.files[GIST_FILENAME]);
                    if (found) {
                        foundGistId = found.id;
                    } else {
                        page++;
                    }
                }

                return foundGistId;
            } catch (error) {
                console.error('Error searching for existing gist:', error);
                return null;
            }
        },

        async fetchFromGist(silent = false) {
            const token = this.getSyncToken();
            const gistId = this.getGistId();

            if (!token || !gistId) {
                if (!silent) console.log('No token or gist ID configured');
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

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const gist = await response.json();
                const content = gist.files[GIST_FILENAME]?.content;

                if (!content) throw new Error('Bookmark data not found in gist');

                const data = JSON.parse(content);
                this.cache = data;
                this.cacheTimestamp = Date.now();
                return data;
            } catch (error) {
                console.error('Failed to fetch from Gist:', error);
                if (!silent) alert(`Failed to load bookmarks: ${error.message}`);
                return null;
            }
        },

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

            let gistId = this.getGistId();
            if (!gistId) {
                console.log('No Gist ID linked. Searching for existing backup before creating new...');
                const existingId = await this.findExistingGist(token);
                if (existingId) {
                    console.log('Found orphaned backup. Relinking...');
                    gistId = existingId;
                    this.setGistId(existingId);
                }
            }

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

                if (!gistId) {
                    this.setGistId(result.id);
                }

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

        async getData() {
            if (this.isCacheValid()) return this.cache;

            const data = await this.fetchFromGist(true);
            if (data) return data;

            return {
                bookmarks: {},
                lists: [DEFAULT_LIST],
                listOrder: []
            };
        },

        async getBookmarks() {
            const data = await this.getData();
            return data.bookmarks || {};
        },

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
                data.bookmarks[listName].push({ repo, repoUrl, addedAt: new Date().toISOString() });
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
                this.invalidateCache();
                await this.saveToGist(data);
                return true;
            }
            return false;
        },

        async addList(listName) {
            const data = await this.getData();
            if (!data.lists.includes(listName)) {
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

        async mergeData(localData, remoteData) {
            if (!remoteData) return localData;

            const merged = {
                bookmarks: { ...remoteData.bookmarks },
                lists: [...new Set([...(remoteData.lists || []), ...(localData.lists || [])])],
                listOrder: remoteData.listOrder || localData.listOrder || []
            };

            for (const [listName, repos] of Object.entries(localData.bookmarks || {})) {
                if (!merged.bookmarks[listName]) {
                    merged.bookmarks[listName] = [];
                }
                repos.forEach(localRepo => {
                    if (!merged.bookmarks[listName].some(r => r.repo === localRepo.repo)) {
                        merged.bookmarks[listName].push(localRepo);
                    }
                });
            }
            return merged;
        },

        async initialize() {
            const localData = await this.getData();
            const remoteData = await this.fetchFromGist(true);

            if (remoteData) {
                console.log('GitHub Bookmarks: Syncing and merging data...');
                const mergedData = await this.mergeData(localData, remoteData);
                this.cache = mergedData;
                this.cacheTimestamp = Date.now();
                await this.saveToGist(mergedData, true);
            }
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
        },

        isBookmarksPage() {
            return window.location.pathname === BOOKMARKS_PAGE_PATH;
        }
    };

    // ============================================================================
    // SORTING UTILITIES
    // ============================================================================

    const Sorter = {
        sortBookmarks(items, sortPref) {
            const sorted = [...items];

            switch (sortPref) {
                case 'manual':
                    // Manual order: keep the array order as stored
                    break;
                case 'alpha-asc':
                    sorted.sort((a, b) => a.repo.localeCompare(b.repo));
                    break;
                case 'alpha-desc':
                    sorted.sort((a, b) => b.repo.localeCompare(a.repo));
                    break;
                case 'date-desc':
                    sorted.sort((a, b) => {
                        const dateA = a.addedAt ? new Date(a.addedAt) : new Date(0);
                        const dateB = b.addedAt ? new Date(b.addedAt) : new Date(0);
                        return dateB - dateA;
                    });
                    break;
                case 'date-asc':
                    sorted.sort((a, b) => {
                        const dateA = a.addedAt ? new Date(a.addedAt) : new Date(0);
                        const dateB = b.addedAt ? new Date(b.addedAt) : new Date(0);
                        return dateA - dateB;
                    });
                    break;
                default:
                    sorted.sort((a, b) => a.repo.localeCompare(b.repo));
            }

            return sorted;
        }
    };

    // ============================================================================
    // STYLES
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

            /* Bookmarks Page Styles */
            #bookmarks-page-container {
                max-width: 900px;
                margin: 32px auto;
                padding: 24px;
                background: var(--bgColor-default, var(--color-canvas-default));
                border: 1px solid var(--borderColor-default, var(--color-border-default));
                border-radius: 12px;
                color: var(--fgColor-default, var(--color-fg-default));
                font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
            }

            #bookmarks-page-container .page-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid var(--borderColor-muted, var(--color-border-muted));
                padding-bottom: 16px;
                margin-bottom: 24px;
                flex-wrap: wrap;
                gap: 12px;
            }

            #bookmarks-page-container .page-header h2 {
                margin: 0;
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 24px;
                font-weight: 600;
            }

            #bookmarks-page-container .page-header-actions {
                display: flex;
                gap: 8px;
                align-items: center;
                flex-wrap: wrap;
            }

            #bookmarks-page-container .page-header-actions .btn {
                padding: 5px 16px;
                border: 1px solid var(--button-default-borderColor-rest, var(--color-btn-border));
                border-radius: 6px;
                background-color: var(--button-default-bgColor-rest, var(--color-btn-bg));
                color: var(--button-default-fgColor-rest, var(--color-btn-text));
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                transition: 80ms cubic-bezier(0.33, 1, 0.68, 1);
            }

            #bookmarks-page-container .page-header-actions .btn:hover {
                background-color: var(--button-default-bgColor-hover, var(--color-btn-hover-bg));
                border-color: var(--button-default-borderColor-hover, var(--color-btn-hover-border));
            }

            /* Sort dropdown */
            .sort-dropdown-container {
                position: relative;
                display: inline-block;
            }

            .sort-dropdown-btn {
                display: inline-flex;
                align-items: center;
                gap: 4px;
            }

            .sort-dropdown-btn .sort-chevron {
                transition: transform 0.2s ease;
            }

            .sort-dropdown-container.open .sort-dropdown-btn .sort-chevron {
                transform: rotate(180deg);
            }

            .sort-dropdown-menu {
                position: absolute;
                top: calc(100% + 4px);
                right: 0;
                z-index: 100;
                min-width: 200px;
                background: var(--overlay-bgColor, var(--color-canvas-overlay));
                border: 1px solid var(--borderColor-default, var(--color-border-default));
                border-radius: 8px;
                box-shadow: var(--shadow-floating-large, var(--color-shadow-large));
                padding: 4px;
                display: none;
            }

            .sort-dropdown-container.open .sort-dropdown-menu {
                display: block;
            }

            .sort-dropdown-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                width: 100%;
                padding: 6px 12px;
                font-size: 13px;
                color: var(--fgColor-default, var(--color-fg-default));
                background: transparent;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                text-align: left;
                font-family: inherit;
                gap: 8px;
            }

            .sort-dropdown-item:hover {
                background: var(--bgColor-neutral-muted, var(--color-neutral-muted));
            }

            .sort-dropdown-item.active {
                font-weight: 600;
            }

            .sort-dropdown-item .check-icon {
                color: var(--fgColor-accent, var(--color-accent-fg));
                width: 16px;
                height: 16px;
                opacity: 0;
                flex-shrink: 0;
            }

            .sort-dropdown-item.active .check-icon {
                opacity: 1;
            }

            #bookmarks-page-container .search-container {
                margin-bottom: 24px;
                display: flex;
                align-items: center;
                background: var(--bgColor-muted, var(--color-canvas-subtle));
                border: 1px solid var(--borderColor-default, var(--color-border-default));
                border-radius: 6px;
                padding: 6px 12px;
                gap: 8px;
            }

            #bookmarks-page-container .search-container svg {
                color: var(--fgColor-muted, var(--color-fg-muted));
                flex-shrink: 0;
            }

            #bookmarks-page-container .search-container input {
                width: 100%;
                background: transparent;
                border: none;
                outline: none;
                color: var(--fgColor-default, var(--color-fg-default));
                font-size: 14px;
                padding: 6px 0;
                font-family: inherit;
            }

            #bookmarks-page-container .search-container input::placeholder {
                color: var(--fgColor-muted, var(--color-fg-muted));
            }

            #bookmarks-page-container .bookmark-category {
                margin-bottom: 24px;
            }

            #bookmarks-page-container .bookmark-category-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: var(--bgColor-muted, var(--color-canvas-subtle));
                border: 1px solid var(--borderColor-default, var(--color-border-default));
                border-radius: 6px;
                cursor: pointer;
                user-select: none;
                transition: background 0.1s ease;
            }

            #bookmarks-page-container .bookmark-category-header:hover {
                background: var(--bgColor-neutral-muted, var(--color-neutral-muted));
            }

            #bookmarks-page-container .bookmark-category-header h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            #bookmarks-page-container .bookmark-category-header .category-count {
                font-size: 12px;
                font-weight: 400;
                color: var(--fgColor-muted, var(--color-fg-muted));
                padding: 2px 8px;
                background: var(--bgColor-neutral-muted, var(--color-neutral-muted));
                border-radius: 12px;
            }

            #bookmarks-page-container .bookmark-category-header .collapse-icon {
                transition: transform 0.2s ease;
                color: var(--fgColor-muted, var(--color-fg-muted));
            }

            #bookmarks-page-container .bookmark-category-header .collapse-icon.collapsed {
                transform: rotate(-90deg);
            }

            #bookmarks-page-container .bookmark-category-body {
                border: 1px solid var(--borderColor-default, var(--color-border-default));
                border-top: none;
                border-radius: 0 0 6px 6px;
                overflow: hidden;
                min-height: 20px;
            }

            #bookmarks-page-container .bookmark-category-body.collapsed {
                display: none;
            }

            /* Drag and drop styles */
            #bookmarks-page-container .bookmark-item {
                padding: 12px 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: var(--bgColor-default, var(--color-canvas-default));
                border-top: 1px solid var(--borderColor-muted, var(--color-border-muted));
                transition: background 0.1s ease;
            }

            #bookmarks-page-container .bookmark-item:first-child {
                border-top: none;
            }

            #bookmarks-page-container .bookmark-item:hover {
                background: var(--bgColor-neutral-muted, var(--color-neutral-muted));
            }

            #bookmarks-page-container .bookmark-item.dragging {
                opacity: 0.5;
                background: var(--bgColor-accent-muted, var(--color-accent-subtle));
            }

            #bookmarks-page-container .bookmark-item.drag-over {
                border-top: 2px solid var(--fgColor-accent, var(--color-accent-fg));
            }

            #bookmarks-page-container .bookmark-item .drag-handle {
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--fgColor-muted, var(--color-fg-muted));
                cursor: grab;
                padding: 0 4px;
                margin-right: 4px;
                flex-shrink: 0;
                border-radius: 4px;
                transition: color 0.1s ease;
            }

            #bookmarks-page-container .bookmark-item .drag-handle:hover {
                color: var(--fgColor-default, var(--color-fg-default));
                background: var(--bgColor-neutral-muted, var(--color-neutral-muted));
            }

            #bookmarks-page-container .bookmark-item .drag-handle:active {
                cursor: grabbing;
            }

            #bookmarks-page-container .bookmark-item .bookmark-info {
                display: flex;
                align-items: center;
                gap: 12px;
                min-width: 0;
                flex: 1;
                flex-wrap: wrap;
            }

            #bookmarks-page-container .bookmark-item .bookmark-info a {
                color: var(--fgColor-accent, var(--color-accent-fg));
                text-decoration: none;
                font-weight: 600;
                font-size: 14px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            #bookmarks-page-container .bookmark-item .bookmark-info a:hover {
                text-decoration: underline;
            }

            #bookmarks-page-container .bookmark-item .bookmark-actions {
                display: flex;
                gap: 4px;
                flex-shrink: 0;
            }

            #bookmarks-page-container .bookmark-item .bookmark-actions button {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 4px;
                width: 28px;
                height: 28px;
                background: transparent;
                border: 1px solid transparent;
                border-radius: 6px;
                color: var(--fgColor-muted, var(--color-fg-muted));
                cursor: pointer;
                transition: 80ms cubic-bezier(0.33, 1, 0.68, 1);
            }

            #bookmarks-page-container .bookmark-item .bookmark-actions button:hover {
                background: var(--bgColor-neutral-muted, var(--color-neutral-muted));
                color: var(--fgColor-default, var(--color-fg-default));
            }

            #bookmarks-page-container .bookmark-item .bookmark-actions .remove-btn:hover {
                color: var(--danger-fgColor, var(--color-danger-fg));
                border-color: var(--danger-borderColor, var(--color-danger-emphasis));
            }

            #bookmarks-page-container .bookmark-item .bookmark-actions .move-btn:hover {
                color: var(--fgColor-accent, var(--color-accent-fg));
                border-color: var(--borderColor-accent-emphasis, var(--color-accent-emphasis));
            }

            #bookmarks-page-container .bookmark-item .bookmark-tags {
                display: flex;
                gap: 4px;
                flex-wrap: wrap;
            }

            #bookmarks-page-container .bookmark-item .bookmark-tag {
                font-size: 11px;
                padding: 1px 8px;
                border-radius: 12px;
                background: var(--bgColor-neutral-muted, var(--color-neutral-muted));
                color: var(--fgColor-muted, var(--color-fg-muted));
                border: 1px solid var(--borderColor-muted, var(--color-border-muted));
            }

            /* Move-to-list dropdown */
            .move-list-menu {
                position: fixed;
                z-index: 200;
                min-width: 180px;
                background: var(--overlay-bgColor, var(--color-canvas-overlay));
                border: 1px solid var(--borderColor-default, var(--color-border-default));
                border-radius: 8px;
                box-shadow: var(--shadow-floating-large, var(--color-shadow-large));
                padding: 4px;
                display: none;
            }

            .move-list-menu.open {
                display: block;
            }

            .move-list-item {
                display: flex;
                align-items: center;
                width: 100%;
                padding: 6px 12px;
                font-size: 13px;
                color: var(--fgColor-default, var(--color-fg-default));
                background: transparent;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                text-align: left;
                font-family: inherit;
                gap: 8px;
            }

            .move-list-item:hover {
                background: var(--bgColor-neutral-muted, var(--color-neutral-muted));
            }

            .move-list-item.disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            #bookmarks-page-container .empty-state {
                text-align: center;
                padding: 60px 20px;
                color: var(--fgColor-muted, var(--color-fg-muted));
            }

            #bookmarks-page-container .empty-state .empty-icon {
                display: inline-block;
                font-size: 48px;
                opacity: 0.4;
                margin-bottom: 16px;
            }

            #bookmarks-page-container .empty-state h3 {
                color: var(--fgColor-default, var(--color-fg-default));
                margin-bottom: 8px;
            }

            /* Sync status */
            .bookmarks-sync-status {
                font-size: 12px;
                color: var(--fgColor-muted, var(--color-fg-muted));
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .bookmarks-sync-status .sync-dot {
                display: inline-block;
                width: 8px;
                height: 8px;
                border-radius: 50%;
            }

            .bookmarks-sync-status .sync-dot.synced {
                background: var(--success-fgColor, var(--color-success-fg));
            }

            .bookmarks-sync-status .sync-dot.unsynced {
                background: var(--attention-fgColor, var(--color-attention-fg));
            }

            /* Profile tab bookmark item */
            #profile-bookmarks-tab {
                display: inline-flex !important;
                align-items: center !important;
                gap: 6px !important;
                padding: 8px 16px !important;
                font-size: 14px !important;
                font-weight: 500 !important;
                color: var(--fgColor-muted, var(--color-fg-muted)) !important;
                border-radius: 6px !important;
                text-decoration: none !important;
                cursor: pointer !important;
                border: none !important;
                background: transparent !important;
            }

            #profile-bookmarks-tab:hover {
                color: var(--fgColor-default, var(--color-fg-default)) !important;
                background: var(--bgColor-neutral-muted, var(--color-neutral-muted)) !important;
                text-decoration: none !important;
            }

            #profile-bookmarks-tab .Counter {
                margin-left: 4px;
                font-size: 12px;
                font-weight: 400;
                padding: 0 6px;
                background: var(--bgColor-neutral-muted, var(--color-neutral-muted));
                border-radius: 12px;
                color: var(--fgColor-muted, var(--color-fg-muted));
            }

            /* Responsive */
            @media (max-width: 768px) {
                #bookmarks-page-container {
                    margin: 16px;
                    padding: 16px;
                }

                #bookmarks-page-container .page-header {
                    flex-direction: column;
                    align-items: stretch;
                }

                #bookmarks-page-container .page-header-actions {
                    justify-content: stretch;
                }

                #bookmarks-page-container .page-header-actions .btn {
                    flex: 1;
                    justify-content: center;
                }

                #bookmarks-page-container .bookmark-item {
                    flex-wrap: wrap;
                    gap: 8px;
                }

                #bookmarks-page-container .bookmark-item .bookmark-info {
                    width: 100%;
                }

                #bookmarks-page-container .bookmark-item .bookmark-actions {
                    margin-left: auto;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // ============================================================================
    // BOOKMARK BUTTON (REPO PAGES)
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

            const visibleLists = await Storage.getVisibleLists();

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
                    await updateBookmarkButton();
                    Storage.dispatchUpdate();
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
                    Storage.dispatchUpdate();
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

        const svg = mainButton.querySelector('svg');
        if (svg) {
            svg.outerHTML = bookmarked ? ICONS.bookmarkFilled : ICONS.bookmarkHollow;
            const newSvg = mainButton.querySelector('svg');
            if (newSvg && bookmarked) {
                newSvg.style.fill = '#da3633';
            }
        }

        const textSpan = mainButton.querySelector('span[data-bookmark-text="true"]');
        if (textSpan) {
            textSpan.textContent = bookmarked ? 'Bookmarked' : 'Bookmark';
        }

        mainButton.querySelector('[data-component="CounterLabel"]')?.remove();
        mainButton.querySelector('[class*="VisuallyHidden"]')?.remove();
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
                (mainButton.querySelector('[data-component="text"]') || mainButton).appendChild(counter);
            }
        } else if (counter) {
            counter.remove();
        }
    }

    async function addBookmarkButton() {
        const repoInfo = Repo.getInfo();
        if (!repoInfo || !Repo.isRepoPage()) return;

        if (document.querySelector('.gh-bookmark-container')) return;

        const starButton = document.querySelector('[data-testid="star-button"]')
            || document.querySelector('.pagehead-actions')?.querySelector('form[action*="/star"], form[action*="/unstar"]')?.closest('li')?.querySelector('button[type="submit"]');
        if (!starButton) return;

        const starLi = starButton.closest('li');
        if (!starLi || !starLi.parentElement) return;

        const { repo, repoUrl } = repoInfo;
        const bookmarked = await Storage.isBookmarked(repo);
        const totalCount = await Storage.getTotalCount();

        const bookmarkContainer = document.createElement('li');
        bookmarkContainer.classList.add('gh-bookmark-container');

        const mainButton = starButton.cloneNode(true);
        mainButton.classList.add('gh-bookmark-main-button', 'btn', 'btn-sm', 'gh-bookmark-btn');
        mainButton.type = 'button';
        mainButton.removeAttribute('name');
        mainButton.removeAttribute('value');
        mainButton.removeAttribute('data-hydro-click');
        mainButton.removeAttribute('data-hydro-click-hmac');
        mainButton.removeAttribute('data-ga-click');
        mainButton.removeAttribute('data-testid');
        mainButton.removeAttribute('aria-describedby');
        mainButton.setAttribute('aria-label', bookmarked ? 'Remove bookmark' : 'Bookmark this repository');
        mainButton.style.borderTopRightRadius = '0';
        mainButton.style.borderBottomRightRadius = '0';
        mainButton.style.borderRight = '1px solid var(--borderColor-default, var(--color-border-default))';

        const svg = mainButton.querySelector('svg');
        if (svg) {
            svg.outerHTML = bookmarked ? ICONS.bookmarkFilled : ICONS.bookmarkHollow;
            if (bookmarked) {
                const newSvg = mainButton.querySelector('svg');
                if (newSvg) newSvg.style.fill = '#da3633';
            }
        }

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

        mainButton.querySelector('[data-component="CounterLabel"]')?.remove();
        mainButton.querySelector('[class*="VisuallyHidden"]')?.remove();

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
                (mainButton.querySelector('[data-component="text"]') || mainButton).appendChild(counter);
            }
        } else if (counter) {
            counter.remove();
        }

        mainButton.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const bookmarked = await Storage.isBookmarked(repo);
            if (bookmarked) {
                const lists = await Storage.getLists();
                for (const listName of lists) {
                    if (await Storage.isBookmarkedInList(repo, listName)) {
                        await Storage.removeBookmark(repo, listName);
                    }
                }
                if (await Storage.isBookmarkedInList(repo, DEFAULT_LIST)) {
                    await Storage.removeBookmark(repo, DEFAULT_LIST);
                }
            } else {
                await Storage.addBookmark(repo, repoUrl, DEFAULT_LIST);
            }

            await updateBookmarkButton();
            Storage.dispatchUpdate();
        };

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

        const closeHandler = (e) => {
            if (e && e.target && typeof e.target.closest === 'function') {
                if (!details.contains(e.target) && details.hasAttribute('open')) {
                    details.removeAttribute('open');
                }
            }
        };
        document.addEventListener('click', closeHandler);

        starLi.parentElement.insertBefore(bookmarkContainer, starLi);
    }

    // ============================================================================
    // BOOKMARKS PAGE
    // ============================================================================

    function createSortDropdown() {
        const container = document.createElement('div');
        container.className = 'sort-dropdown-container';

        const currentSort = Storage.getSortPreference();

        const btn = document.createElement('button');
        btn.className = 'btn sort-dropdown-btn';
        btn.innerHTML = `${ICONS.sort} Sort <span class="sort-chevron">${ICONS.chevronDown}</span>`;
        btn.title = `Sort: ${SORT_OPTIONS[currentSort] || 'Name (A-Z)'}`;

        const menu = document.createElement('div');
        menu.className = 'sort-dropdown-menu';

        Object.entries(SORT_OPTIONS).forEach(([key, label]) => {
            const item = document.createElement('button');
            item.className = `sort-dropdown-item${key === currentSort ? ' active' : ''}`;
            item.dataset.sort = key;
            item.innerHTML = `
                <span>${label}</span>
                <svg class="check-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
                </svg>
            `;
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const sortPref = item.dataset.sort;
                Storage.setSortPreference(sortPref);
                container.classList.remove('open');

                menu.querySelectorAll('.sort-dropdown-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                btn.title = `Sort: ${SORT_OPTIONS[sortPref]}`;

                renderBookmarksList();
            });
            menu.appendChild(item);
        });

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            container.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                container.classList.remove('open');
            }
        });

        container.appendChild(btn);
        container.appendChild(menu);
        return container;
    }

    function createMoveListMenu(repo, currentList, buttonElement) {
        const menu = document.createElement('div');
        menu.className = 'move-list-menu';

        const renderMenu = async () => {
            const allLists = await Storage.getLists();
            menu.innerHTML = '';

            for (const listName of allLists) {
                const item = document.createElement('button');
                item.className = `move-list-item${listName === currentList ? ' disabled' : ''}`;
                item.textContent = listName === DEFAULT_LIST ? 'Unassigned' : listName;
                item.disabled = listName === currentList;

                item.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (listName === currentList) return;

                    const data = await Storage.getData();
                    // Find the bookmark in the current list
                    const bookmark = data.bookmarks[currentList]?.find(b => b.repo === repo);
                    if (!bookmark) return;

                    // Remove from current list
                    data.bookmarks[currentList] = data.bookmarks[currentList].filter(b => b.repo !== repo);
                    if (data.bookmarks[currentList].length === 0) {
                        delete data.bookmarks[currentList];
                    }

                    // Add to new list
                    if (!data.bookmarks[listName]) data.bookmarks[listName] = [];
                    if (!data.bookmarks[listName].some(b => b.repo === repo)) {
                        data.bookmarks[listName].push(bookmark);
                    }

                    Storage.invalidateCache();
                    await Storage.saveToGist(data);
                    Storage.dispatchUpdate();

                    menu.classList.remove('open');
                    renderBookmarksPage();
                    updateBookmarkButton();
                });

                menu.appendChild(item);
            }
        };

        renderMenu();

        // Position menu near the button
        const rect = buttonElement.getBoundingClientRect();
        menu.style.top = `${rect.bottom + 4}px`;
        menu.style.left = `${Math.min(rect.left, window.innerWidth - 200)}px`;

        // Close on outside click
        const closeHandler = (e) => {
            if (!menu.contains(e.target) && e.target !== buttonElement) {
                menu.classList.remove('open');
                document.removeEventListener('click', closeHandler);
                if (menu.parentElement) menu.remove();
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);

        return menu;
    }

    async function renderBookmarksList() {
        const container = document.getElementById('bookmarks-list-container');
        if (!container) return;

        const bookmarks = await Storage.getBookmarks();
        const allLists = await Storage.getLists();
        const sortPref = Storage.getSortPreference();
        const isManualSort = sortPref === 'manual';

        // Get all lists that have bookmarks
        const listsWithBookmarks = allLists.filter(list => bookmarks[list] && bookmarks[list].length > 0);

        if (listsWithBookmarks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">${ICONS.bookmarkHollow}</div>
                    <h3>No bookmarks yet</h3>
                    <p>Start bookmarking repositories to see them here!</p>
                    <p style="font-size:12px;margin-top:12px;color:var(--fgColor-muted, var(--color-fg-muted));">
                        Click the bookmark button on any repository page to add it.
                    </p>
                </div>
            `;
            return;
        }

        let html = '';

        for (const listName of listsWithBookmarks) {
            const items = bookmarks[listName] || [];
            if (items.length === 0) continue;

            // Sort items (manual keeps stored order)
            const sortedItems = Sorter.sortBookmarks(items, sortPref);

            const isDefault = listName === DEFAULT_LIST;
            const listLabel = isDefault ? 'Unassigned' : listName;

            html += `
                <div class="bookmark-category" data-list="${listName}">
                    <div class="bookmark-category-header" data-category="${listName}">
                        <h3>
                            ${ICONS.tag}
                            ${listLabel}
                            <span class="category-count">${items.length}</span>
                        </h3>
                        <span class="collapse-icon">${ICONS.chevronDown}</span>
                    </div>
                    <div class="bookmark-category-body" data-list="${listName}">
            `;

            for (const item of sortedItems) {
                // Get tags for this bookmark
                const tags = [];
                for (const list of allLists) {
                    if (list !== listName && bookmarks[list]?.some(b => b.repo === item.repo)) {
                        tags.push(list === DEFAULT_LIST ? 'Unassigned' : list);
                    }
                }

                html += `
                    <div class="bookmark-item" data-repo="${item.repo}" data-list="${listName}">
                        <span class="drag-handle" title="Drag to reorder${isManualSort ? '' : ' (switch to Manual sort to reorder)'}">${ICONS.grabber}</span>
                        <div class="bookmark-info">
                            <a href="${item.repoUrl}" target="_blank" rel="noopener noreferrer">${item.repo}</a>
                            ${tags.length > 0 ? `<div class="bookmark-tags">${tags.map(t => `<span class="bookmark-tag">${t}</span>`).join('')}</div>` : ''}
                        </div>
                        <div class="bookmark-actions">
                            <button class="move-btn" data-repo="${item.repo}" data-list="${listName}" title="Move to another list">
                                <svg class="octicon" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M8.22 2.97a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1-1.06 1.06L9.5 5.31v5.44l1.97-1.97a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0l-3.25-3.25a.75.75 0 1 1 1.06-1.06L7.5 10.75V5.31L5.53 7.28a.75.75 0 0 1-1.06-1.06l3.25-3.25Z"></path></svg>
                            </button>
                            <button class="remove-btn" data-repo="${item.repo}" data-list="${listName}" title="Remove from this list">${ICONS.trash}</button>
                        </div>
                    </div>
                `;
            }

            html += `
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;

        // Attach event listeners
        attachListEventListeners();

        // Initialize drag-and-drop
        initDragAndDrop();
    }

    function initDragAndDrop() {
        const bodies = document.querySelectorAll('.bookmark-category-body');
        const sortPref = Storage.getSortPreference();
        const isManualSort = sortPref === 'manual';

        bodies.forEach(body => {
            if (typeof Sortable === 'undefined') return;

            Sortable.create(body, {
                group: 'bookmarks',
                animation: 150,
                handle: '.drag-handle',
                ghostClass: 'dragging',
                dragClass: 'dragging',
                disabled: !isManualSort,
                onEnd: async (evt) => {
                    const fromList = evt.from.dataset.list;
                    const toList = evt.to.dataset.list;
                    const repo = evt.item.dataset.repo;

                    if (!repo) return;

                    const data = await Storage.getData();

                    // Remove from source list
                    if (data.bookmarks[fromList]) {
                        data.bookmarks[fromList] = data.bookmarks[fromList].filter(b => b.repo !== repo);
                    }

                    // Get the bookmark object
                    let bookmark = null;
                    // Try to find it in the original source (before removal)
                    const originalFromList = evt.from.dataset.list;
                    const allBookmarks = await Storage.getBookmarks();
                    // Search all lists for the bookmark
                    for (const list of Object.keys(allBookmarks)) {
                        const found = allBookmarks[list]?.find(b => b.repo === repo);
                        if (found) {
                            bookmark = found;
                            break;
                        }
                    }

                    if (!bookmark) return;

                    // Rebuild the target list order based on DOM order
                    const targetBody = evt.to;
                    const newOrder = [];
                    targetBody.querySelectorAll('.bookmark-item').forEach(el => {
                        newOrder.push(el.dataset.repo);
                    });

                    // Ensure the target list exists
                    if (!data.bookmarks[toList]) data.bookmarks[toList] = [];

                    // Build the reordered array from existing data + moved item
                    const targetExisting = data.bookmarks[toList].filter(b => b.repo !== repo);
                    const reordered = [];
                    newOrder.forEach(r => {
                        if (r === repo) {
                            reordered.push(bookmark);
                        } else {
                            const found = targetExisting.find(b => b.repo === r);
                            if (found) reordered.push(found);
                        }
                    });
                    data.bookmarks[toList] = reordered;

                    // Clean up empty source list (unless it's the same as target)
                    if (fromList !== toList && data.bookmarks[fromList] && data.bookmarks[fromList].length === 0) {
                        delete data.bookmarks[fromList];
                    }

                    Storage.invalidateCache();
                    await Storage.saveToGist(data);
                    Storage.dispatchUpdate();

                    // Re-render to reflect changes (especially if a list became empty)
                    renderBookmarksPage();
                }
            });
        });
    }

    function attachListEventListeners() {
        // Collapse/expand categories
        document.querySelectorAll('.bookmark-category-header').forEach(header => {
            header.addEventListener('click', () => {
                const body = header.parentElement.querySelector('.bookmark-category-body');
                const icon = header.querySelector('.collapse-icon');
                if (body) {
                    body.classList.toggle('collapsed');
                    if (icon) {
                        icon.classList.toggle('collapsed');
                    }
                }
            });
        });

        // Remove bookmark
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const repo = btn.getAttribute('data-repo');
                const list = btn.getAttribute('data-list');

                if (confirm(`Remove "${repo}" from "${list === DEFAULT_LIST ? 'Unassigned' : list}"?`)) {
                    await Storage.removeBookmark(repo, list);
                    Storage.dispatchUpdate();
                    renderBookmarksPage();
                    updateBookmarkButton();
                }
            });
        });

        // Move to another list
        document.querySelectorAll('.move-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const repo = btn.getAttribute('data-repo');
                const currentList = btn.getAttribute('data-list');

                // Remove any existing move menu
                document.querySelectorAll('.move-list-menu').forEach(m => m.remove());

                const menu = createMoveListMenu(repo, currentList, btn);
                document.body.appendChild(menu);
                menu.classList.add('open');
            });
        });

        // Search filter
        const searchInput = document.getElementById('bookmark-search');
        if (searchInput) {
            const newSearchInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearchInput, searchInput);
            newSearchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                document.querySelectorAll('.bookmark-category').forEach(category => {
                    let hasVisibleItems = false;
                    category.querySelectorAll('.bookmark-item').forEach(item => {
                        const repo = item.getAttribute('data-repo')?.toLowerCase() || '';
                        const match = repo.includes(term);
                        item.style.display = match ? 'flex' : 'none';
                        if (match) hasVisibleItems = true;
                    });
                    category.style.display = hasVisibleItems ? 'block' : 'none';
                });
            });
        }
    }

    async function renderBookmarksPage() {
        const mainContent = document.querySelector('main') || document.querySelector('.application-main') || document.querySelector('#js-pjax-container');
        if (!mainContent) return;

        // Check if already rendered
        if (document.getElementById('bookmarks-page-container')) {
            // If it exists, just re-render the list portion
            await renderBookmarksList();
            return;
        }

        const totalCount = await Storage.getTotalCount();
        const token = Storage.getSyncToken();
        const gistId = Storage.getGistId();

        let html = `
            <div id="bookmarks-page-container">
                <div class="page-header">
                    <h2>
                        ${ICONS.bookmarkHollow}
                        Bookmarks
                        <span style="font-size:14px;font-weight:400;color:var(--fgColor-muted, var(--color-fg-muted));margin-left:4px;">(${totalCount})</span>
                    </h2>
                    <div class="page-header-actions">
                        <div class="bookmarks-sync-status">
                            <span class="sync-dot ${(token && gistId) ? 'synced' : 'unsynced'}"></span>
                            ${(token && gistId) ? 'Synced' : 'Configure sync'}
                        </div>
                        <div id="sort-dropdown-placeholder"></div>
                        <button id="bookmarks-configure-sync" class="btn">${ICONS.sync} Sync</button>
                        <button id="bookmarks-export" class="btn">${ICONS.download} Export</button>
                        <button id="bookmarks-import" class="btn">${ICONS.upload} Import</button>
                    </div>
                </div>

                <div class="search-container">
                    ${ICONS.search}
                    <input type="text" id="bookmark-search" placeholder="Filter bookmarks by repository name..." autofocus>
                </div>

                <div id="bookmarks-list-container"></div>
            </div>
        `;

        mainContent.innerHTML = html;
        document.title = 'Bookmarks - GitHub';

        // Insert the sort dropdown
        const sortPlaceholder = document.getElementById('sort-dropdown-placeholder');
        if (sortPlaceholder) {
            sortPlaceholder.replaceWith(createSortDropdown());
        }

        // Render the list
        await renderBookmarksList();

        // --- Event Listeners for header buttons ---

        // Configure sync
        document.getElementById('bookmarks-configure-sync')?.addEventListener('click', async () => {
            const currentToken = Storage.getSyncToken();
            const message = currentToken
                ? 'Enter new GitHub Personal Access Token (leave empty to keep current):\n\nRequired scope: gist'
                : 'Enter GitHub Personal Access Token:\n\nRequired scope: gist\n\nCreate one at: ' + SYNC_HELP_URL;

            const token = prompt(message, '');

            if (token !== null && token.trim() !== '') {
                const cleanToken = token.trim();
                Storage.setSyncToken(cleanToken);

                const syncBtn = document.getElementById('bookmarks-configure-sync');
                const originalText = syncBtn.innerHTML;
                syncBtn.innerHTML = '⌛ Searching...';

                const existingGistId = await Storage.findExistingGist(cleanToken);

                if (existingGistId) {
                    Storage.setGistId(existingGistId);
                    const data = await Storage.fetchFromGist();
                    if (data) {
                        alert('Found existing bookmark backup! Restored successfully.');
                        renderBookmarksPage();
                        updateBookmarkButton();
                    } else {
                        alert('Found a backup Gist, but could not read the data.');
                    }
                } else {
                    alert('Token saved! No existing bookmark backup was found.\n\nA new backup Gist will be created automatically when you add bookmarks.');
                }

                syncBtn.innerHTML = originalText;
                renderBookmarksPage();
            }
        });

        // Export
        document.getElementById('bookmarks-export')?.addEventListener('click', async () => {
            const data = await Storage.getData();
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
            const a = document.createElement('a');
            a.href = dataStr;
            a.download = "github_bookmarks.json";
            a.click();
        });

        // Import
        document.getElementById('bookmarks-import')?.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.readAsText(file, 'UTF-8');
                reader.onload = async (rev) => {
                    try {
                        const content = JSON.parse(rev.target.result);
                        if (content.bookmarks && content.lists) {
                            const currentData = await Storage.getData();
                            const merged = await Storage.mergeData(currentData, content);
                            await Storage.saveToGist(merged);
                            Storage.invalidateCache();
                            renderBookmarksPage();
                            updateBookmarkButton();
                            alert('Bookmarks imported successfully!');
                        } else {
                            alert('Invalid file format. Expected bookmarks and lists.');
                        }
                    } catch (err) {
                        alert('Invalid JSON file.');
                    }
                };
            };
            input.click();
        });
    }

    // ============================================================================
    // PROFILE DROPDOWN & TAB INTEGRATION
    // ============================================================================

    function addBookmarksToProfileMenu() {
        const candidates = document.querySelectorAll('a[href*="?tab=repositories"]');
        let reposLink = null;
        let parentList = null;
        for (const candidate of candidates) {
            const ul = candidate.closest('ul');
            if (ul && ul.className.includes('prc-ActionList')) {
                reposLink = candidate;
                parentList = ul;
                break;
            }
        }
        if (!reposLink || !parentList) return;

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

            window.history.pushState(null, '', BOOKMARKS_PAGE_PATH);
            renderBookmarksPage();

            document.querySelectorAll('details[open]').forEach(details => {
                details.removeAttribute('open');
            });
        });

        reposLi.parentElement.insertBefore(bookmarksLi, reposLi.nextSibling);
    }

    function addBookmarksTabToProfilePage() {
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
                Storage.getTotalCount().then(totalCount => {
                    span.textContent = totalCount.toString();
                    span.setAttribute('title', `${totalCount} bookmark${totalCount !== 1 ? 's' : ''}`);
                });
            }
        }

        bookmarksLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            window.history.pushState(null, '', BOOKMARKS_PAGE_PATH);
            renderBookmarksPage();
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

        if (Repo.isBookmarksPage()) {
            renderBookmarksPage();
        }
    });

    window.addEventListener('popstate', () => {
        if (Repo.isBookmarksPage()) {
            renderBookmarksPage();
        }
    });

    async function init() {
        injectStyles();

        if (Repo.isBookmarksPage()) {
            setTimeout(renderBookmarksPage, 100);
            return;
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
            console.log('GitHub Bookmarks: No sync token configured. Configure via the bookmarks page.');
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
                if (Repo.isBookmarksPage()) {
                    setTimeout(renderBookmarksPage, 100);
                } else {
                    setTimeout(init, 500);
                }
            }
        }).observe(document, { subtree: true, childList: true });
    }

    start();

})();
