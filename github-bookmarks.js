// ==UserScript==
// @name         GitHub Bookmarks
// @namespace    http://tampermonkey.net/
// @version      4.3.0
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
        BOOKMARKS: 'ghBookmarks',
        LISTS: 'ghBookmarkLists',
        LIST_ORDER: 'ghBookmarkListOrder',
        SYNC_TOKEN: 'ghBookmarkSyncToken',
        SYNC_GIST_ID: 'ghBookmarkSyncGistId',
        OPEN_MODAL: 'ghBookmarksModalOpen',
    };

    const DEFAULT_LIST = 'General';
    const SYNC_HELP_URL = 'https://github.com/settings/tokens/new';

    // SVG Icons
    const ICONS = {
        // ... use unchanged icons as in main branch ...
        questionMark: `<svg height="20" width="20" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.25-5h.5v2h-.5v-2zm2.61-5.81a3 3 0 00-5.06 2.4h2.02a1 1 0 011.73-.71c.47.47.47 1.23 0 1.7a1.01 1.01 0 01-.52.28 1 1 0 00-.71 1.18v.15h2v-.15c0-.24.09-.47.26-.64a3 3 0 00.78-4.21z"></path></svg>`,
        close: `<svg height="16" width="16" ...></svg>`,
        triangleDown: `<svg height="16" width="16" ...></svg>`,
        // ... other icons ...
    };

    let modalOpen = false;

    // ============================================================================
    // STORAGE UTILITIES
    // ============================================================================

    const Storage = {
        getBookmarks() {
            try {
                return JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKMARKS) || '{}');
            } catch (error) {
                console.error('Failed to parse bookmarks:', error);
                return {};
            }
        },

        getLists() {
            try {
                return JSON.parse(localStorage.getItem(STORAGE_KEYS.LISTS) || JSON.stringify([DEFAULT_LIST]));
            } catch (error) {
                console.error('Failed to parse lists:', error);
                return [DEFAULT_LIST];
            }
        },

        getListOrder() {
            try {
                return JSON.parse(localStorage.getItem(STORAGE_KEYS.LIST_ORDER) || '[]');
            } catch (error) {
                console.error('Failed to parse list order:', error);
                return [];
            }
        },

        saveListOrder(order) {
            try {
                localStorage.setItem(STORAGE_KEYS.LIST_ORDER, JSON.stringify(order));
            } catch (error) {
                console.error('Failed to save list order:', error);
            }
        },

        saveBookmarks(bookmarks, autoSync = true) {
            try {
                localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
                this.dispatchUpdate();

                if (autoSync && this.getSyncToken() && this.getGistId()) {
                    this.syncToGist(true);
                }
            } catch (error) {
                console.error('Failed to save bookmarks:', error);
            }
        },

        saveLists(lists) {
            try {
                localStorage.setItem(STORAGE_KEYS.LISTS, JSON.stringify(lists));
            } catch (error) {
                console.error('Failed to save lists:', error);
            }
        },

        getTotalCount() {
            const bookmarks = this.getBookmarks();
            let total = 0;
            Object.values(bookmarks).forEach(arr => { total += arr.length; });
            return total;
        },

        isBookmarked(repo) {
            const bookmarks = this.getBookmarks();
            return Object.values(bookmarks).some(arr => arr.includes(repo));
        },

        isBookmarkedInList(repo, listName) {
            const bookmarks = this.getBookmarks();
            return Array.isArray(bookmarks[listName]) && bookmarks[listName].includes(repo);
        },

        addBookmark(repo, repoUrl, listName = DEFAULT_LIST) {
            const bookmarks = this.getBookmarks();
            if (!bookmarks[listName]) bookmarks[listName] = [];
            if (!bookmarks[listName].includes(repo)) bookmarks[listName].push(repo);
            this.saveBookmarks(bookmarks);
            this.dispatchUpdate();
        },

        removeBookmark(repo, listName = DEFAULT_LIST) {
            const bookmarks = this.getBookmarks();
            if (bookmarks[listName]) {
                bookmarks[listName] = bookmarks[listName].filter(x => x !== repo);
                this.saveBookmarks(bookmarks);
                this.dispatchUpdate();
            }
        },

        addList(listName) {
            const lists = this.getLists();
            if (!lists.includes(listName)) {
                lists.push(listName);
                this.saveLists(lists);
                let order = this.getListOrder();
                order.push(listName);
                this.saveListOrder(order);
            }
        },

        renameList(oldName, newName) {
            const lists = this.getLists();
            const idx = lists.indexOf(oldName);
            if (idx > -1 && !lists.includes(newName)) {
                lists[idx] = newName;
                this.saveLists(lists);
                let bookmarks = this.getBookmarks();
                if (bookmarks[oldName]) {
                    bookmarks[newName] = bookmarks[oldName];
                    delete bookmarks[oldName];
                    this.saveBookmarks(bookmarks);
                }
                let order = this.getListOrder();
                const orderIdx = order.indexOf(oldName);
                if (orderIdx > -1) {
                    order[orderIdx] = newName;
                    this.saveListOrder(order);
                }
            }
        },

        deleteList(listName) {
            if (listName === DEFAULT_LIST) {
                alert('Cannot delete the default list.');
                return false;
            }

            const lists = this.getLists();
            if (!lists.includes(listName)) return false;

            this.saveLists(lists.filter(l => l !== listName));

            const bookmarks = this.getBookmarks();
            if (bookmarks[listName]) {
                delete bookmarks[listName];
                this.saveBookmarks(bookmarks);
            }

            const order = this.getListOrder();
            this.saveListOrder(order.filter(l => l !== listName));

            return true;
        },

        dispatchUpdate() {
            window.dispatchEvent(new CustomEvent('ghBookmarksUpdated'));
        },

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

        // New sync: always only 1 gist. Merge local/cloud intelligently.
        async findOrCreateGist(token) {
            const headers = {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            };
            // Find gist containing 'github-bookmarks.json' with description 'GitHub Bookmarks Sync'
            const response = await fetch(`https://api.github.com/gists`, { headers });
            if (!response.ok) throw new Error('Unable to fetch gists');
            const gists = await response.json();
            for (const gist of gists) {
                if (
                    gist.description === 'GitHub Bookmarks Sync' &&
                    gist.files['github-bookmarks.json']
                ) {
                    return gist.id;
                }
            }
            // Create if not found
            const create = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description: 'GitHub Bookmarks Sync',
                    public: false,
                    files: {
                        'github-bookmarks.json': {
                            content: JSON.stringify({
                                bookmarks: {},
                                lists: [DEFAULT_LIST],
                                listOrder: [],
                                lastSync: new Date().toISOString()
                            }, null, 2)
                        }
                    }
                })
            });
            if (!create.ok) throw new Error('Unable to create gist');
            const createResult = await create.json();
            return createResult.id;
        },

        async syncToGist(silent = false) {
            const token = this.getSyncToken();
            if (!token) {
                if (!silent) alert('Please configure your GitHub token first (click "Configure")');
                return { success: false, error: 'No token configured' };
            }

            let gistId = this.getGistId();
            if (!gistId) {
                gistId = await this.findOrCreateGist(token);
                this.setGistId(gistId);
            }

            // Fetch the cloud copy of bookmarks to intelligently merge
            let cloudData = {};
            try {
                const cloud = await fetch(`https://api.github.com/gists/${gistId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28'
                    }
                });
                if (cloud.ok) {
                    const res = await cloud.json();
                    if (res.files['github-bookmarks.json']?.content) {
                        cloudData = JSON.parse(res.files['github-bookmarks.json'].content);
                    }
                }
            } catch (e) {
                // ignore parse errors, treat as blank
            }
            // Current local data
            const localData = {
                bookmarks: this.getBookmarks(),
                lists: this.getLists(),
                listOrder: this.getListOrder(),
                lastSync: new Date().toISOString()
            };

            // Simple merge: include all lists, all bookmarks in all lists, lastSync to now
            // If there is overlap, local wins.
            const merged = {
                bookmarks: Object.assign({}, cloudData.bookmarks, localData.bookmarks),
                lists: Array.from(new Set([...(cloudData.lists||[]), ...(localData.lists||[])])),
                listOrder: localData.listOrder.length ? localData.listOrder : (cloudData.listOrder||[]),
                lastSync: localData.lastSync
            };

            // Push to gist
            const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    files: {
                        'github-bookmarks.json': {
                            content: JSON.stringify(merged, null, 2)
                        }
                    }
                })
            });

            if (!resp.ok) {
                const error = await resp.json();
                if (!silent) alert(`Sync failed: ${error.message}`);
                return { success: false, error: error.message };
            }
            this.setGistId(gistId);
            return { success: true, time: merged.lastSync };
        },

        async syncFromGist() {
            const token = this.getSyncToken();
            const gistId = this.getGistId();
            if (!token || !gistId) {
                alert('No sync configuration found. Please configure first.');
                return { success: false, error: 'No configuration' };
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
                const content = gist.files['github-bookmarks.json']?.content;
                if (!content) {
                    throw new Error('Bookmark data not found in gist');
                }

                const data = JSON.parse(content);
                // Merge, but cloud wins on restore (prompt user)
                if (confirm('This will replace your current bookmarks with the cloud copy. Continue?')) {
                    this.saveBookmarks(data.bookmarks, false);
                    this.saveLists(data.lists);
                    if (data.listOrder) this.saveListOrder(data.listOrder);
                    return { success: true, time: data.lastSync };
                }
                return { success: false };
            } catch (error) {
                console.error('Restore failed:', error);
                alert(`Restore failed: ${error.message}`);
                return { success: false, error: error.message };
            }
        }
    };

    // ============================================================================

    function injectStyles() {
        // ...existing CSS...
        // Add styles for single config button, sync status, and help icon
    }

    // ...other unchanged code...

    // ============================================================================

    function openBookmarksModal() {
        // Persist open state
        localStorage.setItem(STORAGE_KEYS.OPEN_MODAL, "1");
        if (modalOpen) return;
        modalOpen = true;

        const overlay = document.createElement('div');
        overlay.className = 'bookmarks-modal-overlay';
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

        // --- SYNC SECTION ---
        const syncSection = document.createElement('div');
        syncSection.className = 'bookmarks-sync-section';

        const syncStatus = document.createElement('span');
        syncStatus.className = 'bookmarks-sync-status';
        const token = Storage.getSyncToken();
        const gistId = Storage.getGistId();
        syncStatus.textContent = (token && gistId)
            ? '✓ Auto-sync enabled'
            : (token ? '✓ Sync configured (will create gist on sync)' : 'Auto-sync not configured');

        // Help hover icon
        const helpIcon = document.createElement('div');
        helpIcon.className = 'bookmarks-sync-help';
        helpIcon.innerHTML = `
            ${ICONS.questionMark}
            <div class="bookmarks-sync-help-tooltip">
                <h4>How Sync Works</h4>
                <p><strong>Setup:</strong></p>
                <ol>
                    <li>Click "Configure"</li>
                    <li>Create a token at <code>github.com/settings/tokens/new</code></li>
                    <li>Grant only the <strong>gist</strong> scope</li>
                    <li>Paste the token when prompted</li>
                </ol>
                <p><strong>Auto-sync:</strong> Bookmarks automatically sync to a private Gist. Only ONE bookmarks gist file is created and shared across browsers.</p>
                <p><strong>Merge:</strong> If bookmarking from another browser, updates will appear on refresh if sync is configured.</p>
                <p><strong>Configure:</strong> Token input and cloud restore from here.</p>
            </div>
        `;

        // Single configure button replaces backup/restore/configure
        const configBtn = document.createElement('button');
        configBtn.className = 'bookmarks-sync-btn';
        configBtn.textContent = 'Configure';
        configBtn.addEventListener('click', async () => {
            const currentToken = Storage.getSyncToken();
            const message = currentToken
                ? 'Enter new GitHub Personal Access Token (leave empty to keep current):\n\nRequired scope: gist'
                : 'Enter GitHub Personal Access Token:\n\nRequired scope: gist\n\nCreate one at: ' + SYNC_HELP_URL;

            const token = prompt(message, '');
            if (token !== null && token.trim() !== '') {
                Storage.setSyncToken(token.trim());
                syncStatus.textContent = '✓ Sync configured';
                // On config, force a sync
                let gistId = Storage.getGistId();
                if (!gistId) {
                    gistId = await Storage.findOrCreateGist(token.trim());
                    Storage.setGistId(gistId);
                }
                await Storage.syncToGist(false);
                syncStatus.textContent = '✓ Auto-sync enabled';
            }
            // Optionally allow restore from cloud
            if (confirm('Restore cloud copy (will overwrite local bookmarks)?')) {
                const result = await Storage.syncFromGist();
                if (result.success) {
                    alert('Cloud restore successful!');
                    renderBookmarksModal(content, filterContainer, stats);
                }
            }
        });

        syncSection.appendChild(syncStatus);
        syncSection.appendChild(helpIcon);
        syncSection.appendChild(configBtn);
        stats.appendChild(syncSection);

        modal.appendChild(header);
        modal.appendChild(filterContainer);
        modal.appendChild(content);
        modal.appendChild(stats);
        overlay.appendChild(modal);

        renderBookmarksModal(content, filterContainer, stats);
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        const escapeHandler = (e) => {
            if (e.key === 'Escape') closeBookmarksModal();
        };
        document.addEventListener('keydown', escapeHandler);
        overlay.escapeHandler = escapeHandler;
    }

    function closeBookmarksModal() {
        modalOpen = false;
        localStorage.removeItem(STORAGE_KEYS.OPEN_MODAL);
        document.body.style.overflow = '';
        const overlay = document.querySelector('.bookmarks-modal-overlay');
        if (overlay) {
            if (overlay.escapeHandler) {
                document.removeEventListener('keydown', overlay.escapeHandler);
            }
            overlay.remove();
        }
    }

    // RE-OPEN on page refresh if was open before
    window.addEventListener('DOMContentLoaded', () => {
        if (localStorage.getItem(STORAGE_KEYS.OPEN_MODAL) === "1") {
            setTimeout(openBookmarksModal, 100);
        }
    });

    // ...rest of unchanged logic...

    // ============================================================================

    function init() {
        injectStyles();

        if (Repo.isRepoPage()) {
            setTimeout(addBookmarkButton, 500);
        }
        setTimeout(addBookmarksToProfileMenu, 500);
        setTimeout(addBookmarksTabToProfilePage, 500);
    }

    init();

})();