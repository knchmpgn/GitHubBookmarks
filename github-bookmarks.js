// ==UserScript==
// @name         Github Bookmarks
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Bookmark GitHub repositories with lists, sync via Gist, drag-to-reorder, and compact modal view
// @icon        https://github.githubassets.com/pinned-octocat.svg
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
        SYNC_GIST_ID: 'ghBookmarkSyncGistId'
    };

    const DEFAULT_LIST = 'General';

    // SVG Icons
    const ICONS = {
        bookmarkHollow: `<svg class="octicon octicon-bookmark" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M3 2.75C3 1.784 3.784 1 4.75 1h6.5c.966 0 1.75.784 1.75 1.75v11.5a.75.75 0 0 1-1.227.579L8 11.722l-3.773 3.107A.75.75 0 0 1 3 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.91l3.023-2.489a.75.75 0 0 1 .954 0l3.023 2.49V2.75a.25.25 0 0 0-.25-.25Z"></path></svg>`,
        bookmarkFilled: `<svg class="octicon octicon-bookmark-fill" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M3 2.75C3 1.784 3.784 1 4.75 1h6.5c.966 0 1.75.784 1.75 1.75v11.5a.75.75 0 0 1-1.227.579L8 11.722l-3.773 3.107A.75.75 0 0 1 3 14.25Z"></path></svg>`,
        triangleDown: `<svg class="octicon octicon-triangle-down" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="m4.427 7.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"></path></svg>`,
        close: `<svg class="octicon octicon-x" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path></svg>`,
        plus: `<svg class="octicon octicon-plus" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"></path></svg>`,
        trash: `<svg class="octicon" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z"></path></svg>`,
        questionMark: `<svg class="octicon" height="16" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.92 6.085h.001a.749.749 0 1 1-1.342-.67c.169-.339.436-.701.849-.977C6.845 4.16 7.369 4 8 4a2.756 2.756 0 0 1 1.638.525c.503.377.862.965.862 1.725 0 .448-.115.83-.329 1.15-.205.307-.47.513-.692.662-.109.072-.22.138-.313.195l-.006.004a6.24 6.24 0 0 0-.26.16.952.952 0 0 0-.276.245.75.75 0 0 1-1.248-.832c.184-.264.42-.489.692-.661.103-.067.207-.132.313-.195l.007-.004c.1-.061.182-.11.258-.161a.969.969 0 0 0 .277-.245C8.96 6.514 9 6.427 9 6.25c0-.412-.155-.826-.57-1.12A1.256 1.256 0 0 0 8 4.75c-.361 0-.67.1-.894.27-.228.173-.4.412-.534.714v.001ZM8 11a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>`
    };

    let modalOpen = false;

    // ============================================================================
    // STORAGE UTILITIES
    // ============================================================================

    const Storage = {
        getBookmarks() {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKMARKS) || '{}');
        },

        getLists() {
            const lists = JSON.parse(localStorage.getItem(STORAGE_KEYS.LISTS) || `["${DEFAULT_LIST}"]`);
            const order = this.getListOrder();

            // Sort by custom order
            return lists.sort((a, b) => {
                const indexA = order.indexOf(a);
                const indexB = order.indexOf(b);
                if (indexA === -1 && indexB === -1) return 0;
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            });
        },

        getListOrder() {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.LIST_ORDER) || '[]');
        },

        saveListOrder(order) {
            localStorage.setItem(STORAGE_KEYS.LIST_ORDER, JSON.stringify(order));
        },

        saveBookmarks(bookmarks) {
            localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
            this.dispatchUpdate();
        },

        saveLists(lists) {
            localStorage.setItem(STORAGE_KEYS.LISTS, JSON.stringify(lists));
        },

        getTotalCount() {
            const bookmarks = this.getBookmarks();
            return Object.values(bookmarks).reduce((total, list) => total + list.length, 0);
        },

        isBookmarked(repo) {
            const bookmarks = this.getBookmarks();
            return Object.values(bookmarks).some(list => list.some(b => b.repo === repo));
        },

        isBookmarkedInList(repo, listName) {
            const bookmarks = this.getBookmarks();
            return bookmarks[listName]?.some(b => b.repo === repo) || false;
        },

        addBookmark(repo, repoUrl, listName) {
            const bookmarks = this.getBookmarks();
            if (!bookmarks[listName]) bookmarks[listName] = [];
            if (!bookmarks[listName].some(b => b.repo === repo)) {
                bookmarks[listName].push({ repo, repoUrl });
                this.saveBookmarks(bookmarks);
                return true;
            }
            return false;
        },

        removeBookmark(repo, listName) {
            const bookmarks = this.getBookmarks();
            if (bookmarks[listName]) {
                bookmarks[listName] = bookmarks[listName].filter(b => b.repo !== repo);
                if (bookmarks[listName].length === 0) {
                    delete bookmarks[listName];
                }
                this.saveBookmarks(bookmarks);
                return true;
            }
            return false;
        },

        addList(listName) {
            const lists = JSON.parse(localStorage.getItem(STORAGE_KEYS.LISTS) || `["${DEFAULT_LIST}"]`);
            if (!lists.includes(listName)) {
                lists.push(listName);
                this.saveLists(lists);

                // Add to order
                const order = this.getListOrder();
                if (!order.includes(listName)) {
                    order.push(listName);
                    this.saveListOrder(order);
                }
                return true;
            }
            return false;
        },

        dispatchUpdate() {
            window.dispatchEvent(new Event('ghBookmarksUpdated'));
        },

        // Sync functionality
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

        async syncToGist() {
            const token = this.getSyncToken();
            if (!token) {
                alert('Please configure your GitHub token first (click "Configure Sync")');
                return false;
            }

            const data = {
                bookmarks: this.getBookmarks(),
                lists: JSON.parse(localStorage.getItem(STORAGE_KEYS.LISTS) || `["${DEFAULT_LIST}"]`),
                listOrder: this.getListOrder(),
                lastSync: new Date().toISOString()
            };

            let gistId = this.getGistId();

            // First, search for existing bookmark gists to prevent duplicates
            try {
                const searchResponse = await fetch('https://api.github.com/gists', {
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });

                if (searchResponse.ok) {
                    const gists = await searchResponse.json();
                    const bookmarkGists = gists.filter(g =>
                        g.description === 'GitHub Bookmarks Backup' &&
                        g.files['github-bookmarks.json']
                    );

                    if (bookmarkGists.length > 0) {
                        // Use the first one found, delete any extras
                        const primaryGist = bookmarkGists[0];
                        gistId = primaryGist.id;
                        this.setGistId(gistId);
                        console.log('Using existing gist:', gistId);

                        // Delete duplicate gists
                        if (bookmarkGists.length > 1) {
                            console.log(`Found ${bookmarkGists.length - 1} duplicate gist(s), cleaning up...`);
                            for (let i = 1; i < bookmarkGists.length; i++) {
                                try {
                                    await fetch(`https://api.github.com/gists/${bookmarkGists[i].id}`, {
                                        method: 'DELETE',
                                        headers: {
                                            'Authorization': `token ${token}`,
                                            'Accept': 'application/vnd.github.v3+json'
                                        }
                                    });
                                    console.log('Deleted duplicate gist:', bookmarkGists[i].id);
                                } catch (e) {
                                    console.warn('Failed to delete duplicate:', e);
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn('Could not search for existing gists:', error);
            }

            const url = gistId
                ? `https://api.github.com/gists/${gistId}`
                : 'https://api.github.com/gists';

            const method = gistId ? 'PATCH' : 'POST';

            try {
                const response = await fetch(url, {
                    method,
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        description: 'GitHub Bookmarks Backup',
                        public: false,
                        files: {
                            'github-bookmarks.json': {
                                content: JSON.stringify(data, null, 2)
                            }
                        }
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    console.error('Sync error:', error);
                    throw new Error(error.message || 'Failed to sync');
                }

                const result = await response.json();
                this.setGistId(result.id);
                console.log('Backup successful, Gist ID:', result.id);
                return { success: true, time: new Date().toISOString() };
            } catch (error) {
                console.error('Sync failed:', error);
                return { success: false, error: error.message };
            }
        },

        async syncFromGist() {
                const token = this.getSyncToken();

                if (!token) {
                    alert('Please configure your GitHub token first (click "Configure Sync")');
                    return false;
                }

                let gistId = this.getGistId();

                // If no gist ID stored, try to find it by searching user's gists
                if (!gistId) {
                    try {
                        const searchResponse = await fetch('https://api.github.com/gists', {
                            headers: {
                                'Authorization': `token ${token}`,
                                'Accept': 'application/vnd.github.v3+json'
                            }
                        });

                        if (!searchResponse.ok) {
                            throw new Error('Failed to search for gists');
                        }

                        const gists = await searchResponse.json();
                        const bookmarkGist = gists.find(g =>
                            g.description === 'GitHub Bookmarks Backup' &&
                            g.files['github-bookmarks.json']
                        );

                        if (bookmarkGist) {
                            gistId = bookmarkGist.id;
                            this.setGistId(gistId);
                            console.log('Found existing bookmark gist:', gistId);
                        } else {
                            alert('No backup found. Please create a backup first.');
                            return false;
                        }
                    } catch (error) {
                        console.error('Search failed:', error);
                        alert('Failed to search for backups: ' + error.message);
                        return false;
                    }
                }

                // Now fetch the gist
                try {
                    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                        headers: {
                            'Authorization': `token ${token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    });

                    if (!response.ok) {
                        throw new Error('Failed to fetch gist');
                    }

                    const gist = await response.json();
                    const content = gist.files['github-bookmarks.json']?.content;

                    if (!content) {
                        throw new Error('Bookmark data not found in gist');
                    }

                    const data = JSON.parse(content);

                    if (confirm('This will replace your current bookmarks with the synced version. Continue?')) {
                        this.saveBookmarks(data.bookmarks);
                        this.saveLists(data.lists);
                        if (data.listOrder) this.saveListOrder(data.listOrder);
                        return { success: true, time: data.lastSync };
                    }
                    return { success: false };
                } catch (error) {
                    console.error('Restore failed:', error);
                    return { success: false, error: error.message };
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
                    repoUrl: window.location.origin + '/' + pathParts.slice(0, 2).join('/')
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
    // STYLES
    // ============================================================================

    function injectStyles() {
        if (document.getElementById('gh-bookmarks-styles')) return;

        const style = document.createElement('style');
        style.id = 'gh-bookmarks-styles';
        style.textContent = `
            /* Bookmark Button on Repo Pages - Custom Classes */
            .gh-bookmark-button-group {
                display: inline-flex;
                vertical-align: middle;
            }

            .gh-bookmark-btn {
                /* Only for SVG coloring, not for button shape or background */
            }
            .gh-bookmark-dropdown {
                /* Only for dropdown logic, not for button shape or background */
            }
            /* Custom dropdown button for bookmark only */
            .gh-bookmark-dropdown-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                padding-left: 0;
                padding-right: 0;
                border-top-left-radius: 0;
                border-bottom-left-radius: 0;
                border-left: none;
                height: 100%;
                min-height: unset;
                max-height: unset;
            }

            .gh-bookmark-icon {
                display: inline-block;
                vertical-align: text-bottom;
                margin-right: 4px;
            }

            .gh-bookmark-icon svg {
                display: inline-block;
                overflow: visible;
                vertical-align: text-bottom;
            }

            .gh-bookmark-text {
                display: inline-block;
                font-weight: 500;
            }

            .gh-bookmark-counter {
                display: inline-block;
                padding: 0 6px;
                font-size: 12px;
                font-weight: 500;
                line-height: 18px;
                color: var(--fgColor-default, var(--color-fg-default));
                background-color: var(--bgColor-neutral-muted, var(--color-neutral-muted));
                border: 1px solid transparent;
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

            .gh-bookmark-details[open] .gh-bookmark-dropdown {
                border-color: var(--borderColor-default, var,--color-border-default);
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
                background-color: var(--overlay-bgColor, var,--color-canvas-overlay);
                border: 1px solid var(--borderColor-default, var,--color-border-default);
                border-radius: 12px;
                box-shadow: var(--shadow-floating-large, var,--color-shadow-large);
            }

            .SelectMenu-header {
                display: flex;
                flex: none;
                align-items: center;
                justify-content: space-between;
                padding: 16px;
                border-bottom: 1px solid var(--borderColor-muted, var,--color-border-muted);
            }

            .SelectMenu-title {
                flex: 1;
                font-size: 14px;
                font-weight: 600;
                color: var(--fgColor-default, var,--color-fg-default);
            }

            .SelectMenu-closeButton {
                padding: 4px;
                background: transparent;
                border: 0;
                color: var(--fgColor-muted, var,--color-fg-muted);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 6px;
            }

            .SelectMenu-closeButton:hover {
                background-color: var(--bgColor-neutral-muted, var,--color-neutral-muted);
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
                padding: 8px 16px;
                overflow: hidden;
                color: var(--fgColor-default, var,--color-fg-default);
                text-align: left;
                cursor: pointer;
                background-color: transparent;
                border: 0;
                font-size: 14px;
                font-family: inherit;
                gap: 12px;
            }

            .SelectMenu-item:hover {
                background-color: var(--bgColor-neutral-muted, var,--color-neutral-muted);
            }

            .SelectMenu-checkbox {
                flex-shrink: 0;
                width: 16px;
                height: 16px;
                margin: 0;
                cursor: pointer;
                border-radius: 3px;
            }

            .SelectMenu-item-text {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .SelectMenu-footer {
                display: flex;
                flex: none;
                padding: 8px 0;
                border-top: 1px solid var(--borderColor-muted, var,--color-border-muted);
            }

            .SelectMenu-item--add {
                font-weight: 400;
            }

            .SelectMenu-plus-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                color: var(--fgColor-muted, var,--color-fg-muted);
            }

            .SelectMenu-plus-icon svg {
                fill: currentColor;
            }

            /* Fix for details marker */
            .gh-bookmark-details summary {
                list-style: none;
            }

            .gh-bookmark-details summary::-webkit-details-marker {
                display: none;
            }

            /* Profile Menu Item */
            .gh-bookmarks-item {
                display: block !important;
                width: 100%;
                text-decoration: none !important;
            }

            .gh-bookmarks-item .Counter {
                margin-left: 0 !important;
            }

            .gh-bookmarks-item > span {
                display: inline !important;
            }

            /* Modal Overlay */
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
                background-color: var(--overlay-bgColor, var,--color-canvas-overlay);
                border: 1px solid var(--borderColor-default, var,--color-border-default);
                border-radius: 12px;
                box-shadow: var(--shadow-floating-xlarge, 0 12px 28px rgba(149, 157, 165, 0.3));
                width: 90%;
                max-width: 1000px;
                max-height: 85vh;
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
                border-bottom: 1px solid var(--borderColor-muted, var,--color-border-muted);
            }

            .bookmarks-modal-title {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 20px;
                font-weight: 600;
                color: var(--fgColor-default, var,--color-fg-default);
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
                color: var(--fgColor-muted, var,--color-fg-muted);
                cursor: pointer;
            }

            .bookmarks-modal-close:hover {
                background-color: var(--bgColor-neutral-muted, var,--color-neutral-muted);
            }

            .bookmarks-filter {
                display: flex;
                gap: 8px;
                padding: 16px 24px;
                border-bottom: 1px solid var(--borderColor-muted, var,--color-border-muted);
                overflow-x: auto;
            }

            /* Small hint shown under the list-name buttons explaining drag reorder */
            .bookmarks-filter-hint {
                font-size: 12px;
                color: var(--fgColor-muted, var,--color-fg-muted);
                margin: 6px 24px 0 24px;
            }

            .bookmarks-filter-btn {
                padding: 5px 16px;
                border: 1px solid var(--button-default-borderColor-rest, var,--color-btn-border);
                border-radius: 6px;
                background-color: var(--button-default-bgColor-rest, var,--color-btn-bg);
                color: var(--button-default-fgColor-rest, var,--color-btn-text);
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                white-space: nowrap;
            }

            .bookmarks-filter-btn:hover {
                background-color: var(--button-default-bgColor-hover, var,--color-btn-hover-bg);
                border-color: var(--button-default-borderColor-hover, var,--color-btn-hover-border);
            }

            .bookmarks-filter-btn.active {
                background-color: var(--button-primary-bgColor-rest, var,--color-btn-primary-bg);
                border-color: var(--button-primary-bgColor-rest, var,--color-btn-primary-bg);
                color: var(--button-primary-fgColor-rest, var,--color-btn-primary-text);
            }

            .bookmarks-filter-btn.dragging {
                opacity: 0.5;
            }

            .bookmarks-filter-btn.drag-over {
                border-left: 2px solid var(--button-primary-bgColor-rest, var,--color-btn-primary-bg);
            }

            .bookmarks-modal-content {
                flex: 1;
                overflow-y: auto;
                padding: 24px;
            }

            .bookmarks-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .bookmarks-empty {
                text-align: center;
                padding: 48px 24px;
                color: var(--fgColor-muted, var,--color-fg-muted);
            }

            .bookmarks-empty-icon {
                margin-bottom: 16px;
                opacity: 0.4;
            }

            .bookmarks-empty-title {
                font-size: 24px;
                font-weight: 600;
                margin-bottom: 8px;
                color: var(--fgColor-default, var,--color-fg-default);
            }

            .bookmarks-empty-text {
                font-size: 14px;
            }

            .bookmark-item {
                display: flex;
                align-items: flex-start; /* Change from center to flex-start */
                gap: 12px;
                padding: 12px 16px;
                background-color: var(--bgColor-default, var,--color-canvas-default);
                border: 1px solid var(--borderColor-default, var,--color-border-default);
                border-radius: 6px;
                cursor: pointer;
            }

            .bookmark-item:hover {
                background-color: var(--bgColor-neutral-muted, var,--color-neutral-muted);
            }

            .bookmark-icon-container {
                flex-shrink: 0;
                width: 16px;
                height: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--fgColor-muted, var(--color-fg-muted));
                margin-top: 5px; /* Changed from 2px to 5px */
            }

            .bookmark-info {
                flex: 1;
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .bookmark-title {
                font-size: 14px;
                font-weight: 500;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .bookmark-title a {
                color: var(--fgColor-accent, var,--color-accent-fg);
                text-decoration: none;
                font-weight: 600;
            }

            .bookmark-title a:hover {
                text-decoration: underline;
            }

            .bookmark-description {
                font-size: 12px;
                color: var(--fgColor-muted, var,--color-fg-muted);
                line-height: 1.5;
            }

            .bookmark-lists {
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 4px;
                flex-shrink: 0;
                margin-top: 0;
            }

            .bookmark-list-tag {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 7px;
                height: 24px;
                font-size: 11px;
                font-weight: 500;
                line-height: 18px;
                white-space: nowrap;
                border-radius: 2em;
                border: 1px solid var(--borderColor-default, var,--color-border-default);
                color: var(--fgColor-default, var,--color-fg-default);
                cursor: pointer;
                margin-bottom: 0;
            }

            .bookmark-list-tag:hover {
                background-color: var(--bgColor-neutral-muted, var,--color-neutral-muted);
            }

            .bookmark-actions {
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 4px;
                flex-shrink: 0;
                margin-top: 0;
            }
            .bookmark-right-group {
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: flex-end;
                gap: 12px; /* Increased spacing between list name and trash button */
                min-width: 90px;
                margin-top: 2px; /* lowered by 2px */
            }

            .bookmark-action-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 28px;
                height: 28px;
                padding: 0;
                background: transparent;
                border: 1px solid var(--borderColor-default, var,--color-border-default);
                border-radius: 6px;
                color: var(--fgColor-muted, var,--color-fg-muted);
                cursor: pointer;
                vertical-align: middle;
            }

            .bookmark-action-btn:hover {
                background-color: var(--bgColor-neutral-muted, var,--color-neutral-muted);
            }

            .bookmark-action-btn.danger:hover {
                background-color: var(--button-danger-bgColor-hover, var(--color-btn-danger-hover-bg));
                border-color: var(--button-danger-bgColor-hover, var(--color-btn-danger-hover-bg));
                color: var(--button-danger-fgColor-rest, var(--color-btn-danger-text));
            }

            .bookmark-action-btn.danger:hover svg {
                fill: white;
            }

            /* List Management Dropdown */
            .bookmark-list-dropdown {
                position: fixed;
                z-index: 10000;
                margin-top: 4px;
                width: 200px;
                background-color: var(--overlay-bgColor, var,--color-canvas-overlay);
                border: 1px solid var(--borderColor-default, var,--color-border-default);
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
                color: var(--fgColor-default, var,--color-fg-default);
                font-size: 14px;
                text-align: left;
                cursor: pointer;
                gap: 8px;
            }

            .bookmark-list-dropdown-item:hover {
                background-color: var(--bgColor-neutral-muted, var,--color-neutral-muted);
            }

            .bookmark-list-dropdown-item input[type="checkbox"] {
                margin: 0;
            }

            .bookmarks-stats {
                padding: 12px 24px;
                border-top: 1px solid var(--borderColor-muted, var,--color-border-muted);
                font-size: 12px;
                color: var(--fgColor-muted, var,--color-fg-muted);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .bookmarks-sync-section {
                display: flex;
                gap: 8px;
                align-items: center;
            }

            .bookmarks-sync-btn {
                padding: 4px 12px;
                font-size: 12px;
                border: 1px solid var(--borderColor-default, var,--color-border-default);
                border-radius: 6px;
                background-color: var(--button-default-bgColor-rest, var,--color-btn-bg);
                color: var(--button-default-fgColor-rest, var,--color-btn-text);
                cursor: pointer;
                font-weight: 500;
            }

            .bookmarks-sync-btn:hover {
                background-color: var(--button-default-bgColor-hover, var,--color-btn-hover-bg);
            }

            .bookmarks-sync-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            .bookmarks-sync-btn.primary {
                background-color: var(--button-primary-bgColor-rest, var,--color-btn-primary-bg);
                border-color: var(--button-primary-bgColor-rest, var,--color-btn-primary-bg);
                color: var(--button-primary-fgColor-rest, var,--color-btn-primary-text);
            }

            .bookmarks-sync-btn.primary:hover {
                background-color: var(--button-primary-bgColor-hover, var,--color-btn-primary-hover-bg);
            }

            .bookmarks-sync-status {
                font-size: 11px;
                color: var(--fgColor-muted, var,--color-fg-muted);
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
            }

            .bookmarks-sync-help:hover {
                color: var(--fgColor-default, var (--color-fg-default));
            }

            .bookmarks-sync-help-tooltip {
                position: absolute;
                bottom: calc(100% + 8px);
                right: 0;
                width: 320px;
                padding: 12px;
                background-color: var(--overlay-bgColor, var (--color-canvas-overlay));
                border: 1px solid var(--borderColor-default, var (--color-border-default));
                border-radius: 6px;
                box-shadow: var(--shadow-floating-medium);
                font-size: 12px;
                line-height: 1.5;
                color: var(--fgColor-default, var (--color-fg-default));
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

            .bookmarks-sync-help-tooltip p {
                margin: 0 0 8px 0;
            }

            .bookmarks-sync-help-tooltip ol {
                margin: 0;
                padding-left: 20px;
            }

            .bookmarks-sync-help-tooltip li {
                margin-bottom: 4px;
            }

            .bookmarks-sync-help-tooltip strong {
                font-weight: 600;
            }

            .bookmarks-sync-help-tooltip code {
                padding: 2px 4px;
                background-color: var(--bgColor-neutral-muted, var (--color-neutral-muted));
                border-radius: 3px;
                font-family: monospace;
                font-size: 11px;
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

        const renderDropdown = () => {
            modal.innerHTML = '';

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
                if (details) details.removeAttribute('open');
            });

            modal.appendChild(header);

            const listContainer = document.createElement('div');
            listContainer.className = 'SelectMenu-list';

            const lists = Storage.getLists();
            lists.forEach(listName => {
                const label = document.createElement('label');
                label.className = 'SelectMenu-item';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'SelectMenu-checkbox';
                checkbox.checked = Storage.isBookmarkedInList(repo, listName);

                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    if (e.target.checked) {
                        Storage.addBookmark(repo, repoUrl, listName);
                    } else {
                        Storage.removeBookmark(repo, listName);
                    }
                    renderDropdown();
                });

                const text = document.createElement('span');
                text.className = 'SelectMenu-item-text';
                text.textContent = listName;

                label.appendChild(checkbox);
                label.appendChild(text);
                listContainer.appendChild(label);
            });

            modal.appendChild(listContainer);

            const footer = document.createElement('div');
            footer.className = 'SelectMenu-footer';
            const addButton = document.createElement('button');
            addButton.className = 'SelectMenu-item SelectMenu-item--add';
            addButton.innerHTML = `
                <span class="SelectMenu-plus-icon">${ICONS.plus}</span>
                <span class="SelectMenu-item-text">Create list</span>
            `;
            addButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const newList = prompt('Enter new list name:');
                if (newList?.trim()) {
                    Storage.addList(newList.trim());
                    renderDropdown();
                }
            });
            footer.appendChild(addButton);
            modal.appendChild(footer);
        };

        renderDropdown();
        return modal;
    }

    function updateBookmarkButton() {
        const repoInfo = Repo.getInfo();
        if (!repoInfo) return;

        const mainButton = document.querySelector('.gh-bookmark-main-button');
        if (!mainButton) return;

        const { repo } = repoInfo;
        const bookmarked = Storage.isBookmarked(repo);
        const totalCount = Storage.getTotalCount();

        // Update icon -- set the SVG fill only so text and surrounding spans keep their original color
        const svg = mainButton.querySelector('svg');
        if (svg) {
            const iconHtml = bookmarked ? ICONS.bookmarkFilled : ICONS.bookmarkHollow;
            svg.outerHTML = iconHtml;
            const newSvg = mainButton.querySelector('svg');
            if (newSvg) {
                if (bookmarked) {
                    newSvg.style.fill = '#da3633';
                } else {
                    newSvg.style.fill = '';
                }
            }
            // Ensure text remains default colored
            const textSpan = mainButton.querySelector('span[data-bookmark-text="true"]');
            if (textSpan) textSpan.style.color = '';
        }

        // Update text - find the span we marked
        const textSpan = mainButton.querySelector('span[data-bookmark-text="true"]');
        if (textSpan) {
            textSpan.textContent = bookmarked ? 'Bookmarked' : 'Bookmark';
        }

        // Update counter - make sure it stays default colored
        const counter = mainButton.querySelector('.Counter');
        if (totalCount > 0) {
            if (counter) {
                counter.textContent = totalCount.toLocaleString();
                counter.setAttribute('title', `${totalCount} bookmark${totalCount !== 1 ? 's' : ''}`);
                counter.style.color = ''; // Reset any color
            } else {
                const counterSpan = document.createElement('span');
                counterSpan.className = 'Counter';
                counterSpan.textContent = totalCount.toLocaleString();
                counterSpan.setAttribute('title', `${totalCount} bookmark${totalCount !== 1 ? 's' : ''}`);
                mainButton.appendChild(counterSpan);
            }
        } else if (counter) {
            counter.remove();
        }
    }

    function addBookmarkButton() {
        const repoInfo = Repo.getInfo();
        if (!repoInfo || !Repo.isRepoPage()) return;

        const actionBar = document.querySelector('.pagehead-actions');
        if (!actionBar || document.querySelector('.gh-bookmark-container')) return;

        // Find the star button container
        const starContainer = Array.from(actionBar.children).find(child =>
            child.querySelector('form[action*="/star"], form[action*="/unstar"]')
        );

        if (!starContainer) return;

        const { repo, repoUrl } = repoInfo;
        const bookmarked = Storage.isBookmarked(repo);
        const totalCount = Storage.getTotalCount();

        // Find the actual star button to clone
        const starButton = starContainer.querySelector('button[type="submit"]');
        if (!starButton) return;

        // Create new container
        const bookmarkContainer = document.createElement('li');
        bookmarkContainer.classList.add('gh-bookmark-container');

    // Clone just the button
    const mainButton = starButton.cloneNode(true);
    mainButton.classList.add('gh-bookmark-main-button', 'btn', 'btn-sm', 'gh-bookmark-btn');
    mainButton.type = 'button';
    mainButton.removeAttribute('name');
    mainButton.removeAttribute('value');
    mainButton.removeAttribute('data-hydro-click');
    mainButton.removeAttribute('data-hydro-click-hmac');
    mainButton.removeAttribute('data-ga-click');
    // Remove border radius on right, add right border
    mainButton.style.borderTopRightRadius = '0';
    mainButton.style.borderBottomRightRadius = '0';
    mainButton.style.borderRight = '1px solid var(--borderColor-default, var,--color-border-default)';

        // Find and replace icon
        const svg = mainButton.querySelector('svg');
        if (svg) {
            const iconHtml = bookmarked ? ICONS.bookmarkFilled : ICONS.bookmarkHollow;
            const svgParent = svg.parentElement;
            svg.outerHTML = iconHtml;
            // Color only the SVG itself, not the parent span
            if (bookmarked) {
                const newSvg = mainButton.querySelector('svg');
                if (newSvg) {
                    newSvg.style.fill = '#da3633';
                }
            }
        }

        // Remove any red color from the button and its children
        mainButton.style.color = '';
        const allSpans = mainButton.querySelectorAll('span');
        allSpans.forEach(span => {
            span.style.color = '';
        });

        // Find and replace text - look for visible text spans
        const spans = mainButton.querySelectorAll('span');
        let textFound = false;
        for (const span of spans) {
            const text = span.textContent.trim();
            // Only replace if this span contains just the text (not nested elements)
            if ((text === 'Star' || text === 'Starred' || text === 'Unstar') && span.children.length === 0) {
                span.textContent = bookmarked ? 'Bookmarked' : 'Bookmark';
                span.setAttribute('data-bookmark-text', 'true');
                textFound = true;
                break;
            }
        }

        // If no text span found, find the span next to the icon
        if (!textFound) {
            const iconSpan = mainButton.querySelector('svg')?.parentElement;
            if (iconSpan && iconSpan.nextElementSibling) {
                const textSpan = iconSpan.nextElementSibling;
                if (textSpan.tagName === 'SPAN') {
                    textSpan.textContent = bookmarked ? 'Bookmarked' : 'Bookmark';
                    textSpan.setAttribute('data-bookmark-text', 'true');
                }
            }
        }

        // Update or add counter
        let counter = mainButton.querySelector('.Counter');
        if (counter) {
            if (totalCount > 0) {
                counter.textContent = totalCount.toLocaleString();
                counter.setAttribute('title', `${totalCount} bookmark${totalCount !== 1 ? 's' : ''}`);
            } else {
                counter.remove();
                counter = null;
            }
        } else if (totalCount > 0) {
            counter = document.createElement('span');
            counter.className = 'Counter';
            counter.textContent = totalCount.toLocaleString();
            counter.setAttribute('title', `${totalCount} bookmark${totalCount !== 1 ? 's' : ''}`);
            mainButton.appendChild(counter);
        }

        // Set click handler
        mainButton.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            openBookmarksModal();
        };

        // Create button group wrapper
        const btnGroup = document.createElement('div');
        btnGroup.className = 'BtnGroup d-flex';
        btnGroup.appendChild(mainButton);

    // Create dropdown button (summary)
    const summary = document.createElement('summary');
    summary.className = 'btn btn-sm gh-bookmark-dropdown gh-bookmark-dropdown-btn';
    summary.setAttribute('aria-haspopup', 'menu');
    summary.setAttribute('aria-label', 'Manage bookmark lists');
    summary.innerHTML = ICONS.triangleDown;

        // Create dropdown container
        const details = document.createElement('details');
        details.className = 'details-reset details-overlay d-inline-block position-relative gh-bookmark-details';

        const menuContainer = document.createElement('details-menu');
        menuContainer.className = 'SelectMenu';
        menuContainer.setAttribute('role', 'menu');

        const modal = createSelectMenuDropdown(repo, repoUrl);
        menuContainer.appendChild(modal);

        details.appendChild(summary);
        details.appendChild(menuContainer);

        btnGroup.appendChild(details);
        bookmarkContainer.appendChild(btnGroup);

        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            if (!details.contains(e.target) && details.hasAttribute('open')) {
                details.removeAttribute('open');
            }
        });

        // Insert before star button
        actionBar.insertBefore(bookmarkContainer, starContainer);
    }

    // ============================================================================
    // BOOKMARKS VIEWER MODAL
    // ============================================================================

    function renderBookmarksModal(contentEl, filterEl, statsEl, activeFilter = 'All') {
        const bookmarks = Storage.getBookmarks();
        const lists = ['All', ...Storage.getLists()];

        filterEl.innerHTML = '';

        let draggedElement = null;
        let draggedIndex = -1;

        lists.forEach((listName, index) => {
            const btn = document.createElement('button');
            btn.className = 'bookmarks-filter-btn' + (listName === activeFilter ? ' active' : '');
            btn.textContent = listName;
            btn.draggable = listName !== 'All';
            btn.dataset.listName = listName;

            btn.addEventListener('click', () => {
                renderBookmarksModal(contentEl, filterEl, statsEl, listName);
            });

            // Drag and drop for reordering
            if (listName !== 'All') {
                btn.addEventListener('dragstart', (e) => {
                    draggedElement = btn;
                    draggedIndex = index - 1; // -1 because 'All' is not in the order
                    btn.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                });

                btn.addEventListener('dragend', () => {
                    btn.classList.remove('dragging');
                    filterEl.querySelectorAll('.bookmarks-filter-btn').forEach(b => {
                        b.classList.remove('drag-over');
                    });
                });

                btn.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    if (draggedElement && draggedElement !== btn) {
                        btn.classList.add('drag-over');
                    }
                });

                btn.addEventListener('dragleave', () => {
                    btn.classList.remove('drag-over');
                });

                btn.addEventListener('drop', (e) => {
                    e.preventDefault();
                    btn.classList.remove('drag-over');

                    if (draggedElement && draggedElement !== btn) {
                        const allLists = Storage.getLists();
                        const dropIndex = Array.from(filterEl.children).indexOf(btn) - 1;

                        const newOrder = [...allLists];
                        const [removed] = newOrder.splice(draggedIndex, 1);
                        newOrder.splice(dropIndex, 0, removed);

                        Storage.saveListOrder(newOrder);
                        renderBookmarksModal(contentEl, filterEl, statsEl, activeFilter);
                    }
                });
            }

            filterEl.appendChild(btn);
        });

        // Small explanatory hint beneath the list-name buttons
        const hint = document.createElement('div');
        hint.className = 'bookmarks-filter-hint';
        hint.textContent = 'Tip: Drag and drop lists to reorder them.';
        filterEl.appendChild(hint);

        let displayBookmarks = [];
        if (activeFilter === 'All') {
            Object.entries(bookmarks).forEach(([listName, items]) => {
                items.forEach(item => {
                    const existing = displayBookmarks.find(b => b.repo === item.repo);
                    if (existing) {
                        existing.lists.push(listName);
                    } else {
                        displayBookmarks.push({ ...item, lists: [listName] });
                    }
                });
            });
        } else {
            if (bookmarks[activeFilter]) {
                displayBookmarks = bookmarks[activeFilter].map(item => ({
                    ...item,
                    lists: [activeFilter]
                }));
            }
        }

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

            displayBookmarks.forEach(bookmark => {
                const item = document.createElement('div');
                item.className = 'bookmark-item';

                // Get all lists to show current membership
                const allLists = Storage.getLists();
                const currentLists = [];
                allLists.forEach(listName => {
                    if (Storage.isBookmarkedInList(bookmark.repo, listName)) {
                        currentLists.push(listName);
                    }
                });

                item.innerHTML = `
                    <div class="bookmark-icon-container">${ICONS.bookmarkHollow}</div>
                    <div class="bookmark-info">
                        <div class="bookmark-title">
                            <a href="${bookmark.repoUrl}" target="_blank" rel="noopener noreferrer">${bookmark.repo}</a>
                        </div>
                        <div class="bookmark-description">${bookmark.repoUrl}</div>
                    </div>
                    <div class="bookmark-right-group">
                        <div class="bookmark-lists" data-repo="${bookmark.repo}">
                            ${currentLists.map(l => `<span class="bookmark-list-tag" data-list="${l}">${l}</span>`).join('')}
                        </div>
                        <button class="bookmark-action-btn danger" title="Remove bookmark" data-repo="${bookmark.repo}">
                            ${ICONS.trash}
                        </button>
                    </div>
                `;

                // Click entire item to open
                item.addEventListener('click', (e) => {
                    // Only open the repo URL if not clicking a list tag or action button
                    if (!e.target.closest('.bookmark-right-group')) {
                        window.open(bookmark.repoUrl, '_blank');
                    }
                });

                // List tag management
                const listTags = item.querySelectorAll('.bookmark-list-tag');
                listTags.forEach(tag => {
                    tag.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showListManagementDropdown(e.target, bookmark.repo, currentLists);
                    });
                });

                const removeBtn = item.querySelector('.bookmark-action-btn.danger');
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const repo = removeBtn.dataset.repo;

                    if (confirm(`Remove "${repo}" from all lists?`)) {
                        currentLists.forEach(list => Storage.removeBookmark(repo, list));
                        renderBookmarksModal(contentEl, filterEl, statsEl, activeFilter);
                    }
                });

                listEl.appendChild(item);
            });

            contentEl.innerHTML = '';
            contentEl.appendChild(listEl);

            const total = displayBookmarks.length;
            const listCount = Object.keys(bookmarks).length;
            statsEl.querySelector('.bookmarks-stats-text').textContent =
                `Showing ${total} bookmark${total !== 1 ? 's' : ''} from ${listCount} list${listCount !== 1 ? 's' : ''}`;
        }
    }

    function showListManagementDropdown(targetElement, repo, currentLists) {
        // If a dropdown already exists...
        const existing = document.querySelector('.bookmark-list-dropdown');
        if (existing) {
            // If it's for the same repo + list target, treat this as a "second click" and close the modal
            if (existing.dataset.targetRepo === repo && existing.dataset.targetList === targetElement.dataset.list) {
                existing.remove();
                return;
            }
            // Otherwise remove any other open dropdown before opening a new one
            existing.remove();
        }

        const dropdown = document.createElement('div');
        dropdown.className = 'bookmark-list-dropdown';
        // Track which element opened this dropdown
        dropdown.dataset.targetRepo = repo;
        dropdown.dataset.targetList = targetElement.dataset.list || '';

        const allLists = Storage.getLists();
        const bookmarks = Storage.getBookmarks();

        // Get the repo URL from bookmarks
        let repoUrl = '';
        for (const [listName, items] of Object.entries(bookmarks)) {
            const found = items.find(b => b.repo === repo);
            if (found) {
                repoUrl = found.repoUrl;
                break;
            }
        }

        allLists.forEach(listName => {
            const item = document.createElement('label');
            item.className = 'bookmark-list-dropdown-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = currentLists.includes(listName);

            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                if (e.target.checked) {
                    Storage.addBookmark(repo, repoUrl, listName);
                } else {
                    Storage.removeBookmark(repo, listName);
                }

                // Update the tag display
                const listContainer = document.querySelector(`[data-repo="${repo}"]`);
                if (listContainer) {
                    const newLists = [];
                    allLists.forEach(list => {
                        if (Storage.isBookmarkedInList(repo, list)) {
                            newLists.push(list);
                        }
                    });
                    listContainer.innerHTML = newLists.map(l =>
                        `<span class="bookmark-list-tag" data-list="${l}">${l}</span>`
                    ).join('');

                    // Re-attach click handlers
                    listContainer.querySelectorAll('.bookmark-list-tag').forEach(tag => {
                        tag.addEventListener('click', (e) => {
                            e.stopPropagation();
                            showListManagementDropdown(e.target, repo, newLists);
                        });
                    });
                }
            });

            const text = document.createElement('span');
            text.textContent = listName;

            item.appendChild(checkbox);
            item.appendChild(text);
            dropdown.appendChild(item);
        });

        // Position dropdown
        const rect = targetElement.getBoundingClientRect();
        dropdown.style.left = rect.left + 'px';
        dropdown.style.top = (rect.bottom + 4) + 'px';

        document.body.appendChild(dropdown);

        // Close on outside click
        const closeDropdown = (e) => {
            if (!dropdown.contains(e.target) && e.target !== targetElement) {
                dropdown.remove();
                document.removeEventListener('click', closeDropdown);
            }
        };
        setTimeout(() => document.addEventListener('click', closeDropdown), 0);
    }

    function openBookmarksModal() {
        if (modalOpen) return;

        const overlay = document.createElement('div');
        overlay.className = 'bookmarks-modal-overlay';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeBookmarksModal();
        });

        const modal = document.createElement('div');
        modal.className = 'bookmarks-modal';

        const header = document.createElement('div');
        header.className = 'bookmarks-modal-header';

        const title = document.createElement('h2');
        title.className = 'bookmarks-modal-title';
        title.innerHTML = `${ICONS.bookmarkHollow}<span>Your Bookmarks</span>`;

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
        syncStatus.textContent = token ? '✓ Sync configured' : 'Sync not configured';

        const configBtn = document.createElement('button');
        configBtn.className = 'bookmarks-sync-btn';
        configBtn.textContent = 'Configure Sync';
        configBtn.addEventListener('click', configureSyncToken);

        const backupBtn = document.createElement('button');
        backupBtn.className = 'bookmarks-sync-btn primary';
        backupBtn.textContent = 'Backup';
        backupBtn.addEventListener('click', async () => {
            backupBtn.disabled = true;
            backupBtn.textContent = 'Backing up...';
            const result = await Storage.syncToGist();
            if (result.success) {
                alert('Backup successful!');
                syncStatus.textContent = `✓ Last backup: ${new Date(result.time).toLocaleString()}`;
            } else {
                alert('Backup failed: ' + (result.error || 'Unknown error'));
            }
            backupBtn.disabled = false;
            backupBtn.textContent = 'Backup';
        });

        const restoreBtn = document.createElement('button');
        restoreBtn.className = 'bookmarks-sync-btn';
        restoreBtn.textContent = 'Restore';
        restoreBtn.addEventListener('click', async () => {
            restoreBtn.disabled = true;
            restoreBtn.textContent = 'Restoring...';
            const result = await Storage.syncFromGist();
            if (result.success) {
                alert('Restore successful!');
                renderBookmarksModal(content, filterContainer, stats);
            } else if (result.error) {
                alert('Restore failed: ' + result.error);
            }
            restoreBtn.disabled = false;
            restoreBtn.textContent = 'Restore';
        });

        syncSection.appendChild(syncStatus);
        syncSection.appendChild(helpIcon);
        syncSection.appendChild(configBtn);
        syncSection.appendChild(backupBtn);
        syncSection.appendChild(restoreBtn);
        stats.appendChild(syncSection);

        modal.appendChild(header);
        modal.appendChild(filterContainer);
        modal.appendChild(content);
        modal.appendChild(stats);
        overlay.appendChild(modal);

        renderBookmarksModal(content, filterContainer, stats);

        document.body.appendChild(overlay);
        modalOpen = true;
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
            : 'Enter GitHub Personal Access Token:\n\nRequired scope: gist\n\nCreate one at: https://github.com/settings/tokens/new';

        const token = prompt(message, '');

        if (token !== null && token.trim() !== '') {
            Storage.setSyncToken(token.trim());
            alert('Sync token saved! You can now backup and restore your bookmarks.');
            const syncStatus = document.querySelector('.bookmarks-sync-status');
            if (syncStatus) {
                syncStatus.textContent = '✓ Sync configured';
            }
        }
    }

    const helpIcon = document.createElement('div');
        helpIcon.className = 'bookmarks-sync-help';
        helpIcon.innerHTML = `
            ${ICONS.questionMark}
            <div class="bookmarks-sync-help-tooltip">
                <h4>How to use Sync</h4>
                <p><strong>Setup:</strong></p>
                <ol>
                    <li>Click "Configure Sync"</li>
                    <li>Create a token at <code>github.com/settings/tokens/new</code></li>
                    <li>Grant only the <strong>gist</strong> scope</li>
                    <li>Paste the token when prompted</li>
                </ol>
                <p><strong>Backup:</strong> Saves your bookmarks to a private Gist</p>
                <p><strong>Restore:</strong> Loads bookmarks from your Gist (useful for syncing across browsers)</p>
            </div>
        `;

    function closeBookmarksModal() {
        const modal = document.querySelector('.bookmarks-modal-overlay');
        if (modal) {
            document.removeEventListener('keydown', modal.escapeHandler);
            modal.remove();
            modalOpen = false;
            document.body.style.overflow = '';
        }
    }

    // ============================================================================
    // PROFILE MENU & OVERVIEW PAGE
    // ============================================================================

    function addBookmarksMenuItem() {
        const starsLink = document.querySelector('a[href*="?tab=stars"]');
        if (!starsLink) return;

        const parentList = starsLink.closest('ul, [role="menu"]');
        if (!parentList || parentList.querySelector('.gh-bookmarks-item')) return;

        const starsParent = starsLink.parentElement;
        const bookmarksParent = starsParent.cloneNode(true);
        const bookmarksLink = bookmarksParent.querySelector('a');

        bookmarksLink.classList.add('gh-bookmarks-item');
        bookmarksLink.removeAttribute('href');
        bookmarksLink.removeAttribute('data-turbo-frame');
        bookmarksLink.style.cursor = 'pointer';

        const iconContainer = bookmarksLink.querySelector('svg')?.parentElement;
        if (iconContainer?.querySelector('svg')) {
            iconContainer.querySelector('svg').outerHTML = ICONS.bookmarkHollow;
        }

        const textElements = bookmarksLink.querySelectorAll('span');
        for (const span of textElements) {
            if (span.textContent.toLowerCase().includes('star')) {
                span.textContent = 'Bookmarks';
                break;
            }
        }

        const counterBadge = bookmarksLink.querySelector('.Counter');
        if (counterBadge) {
            const totalCount = Storage.getTotalCount();
            if (totalCount > 0) {
                counterBadge.textContent = totalCount;
                counterBadge.setAttribute('title', totalCount.toString());
            } else {
                counterBadge.remove();
            }
        }

        bookmarksLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openBookmarksModal();

            const dropdown = document.querySelector('details[open]');
            if (dropdown) dropdown.removeAttribute('open');
        });

        starsParent.parentNode.insertBefore(bookmarksParent, starsParent);
    }

    // ============================================================================
    // EVENT LISTENERS
    // ============================================================================

    window.addEventListener('ghBookmarksUpdated', () => {
        updateBookmarkButton();

        if (modalOpen) {
            const modal = document.querySelector('.bookmarks-modal');
            if (modal) {
                const content = modal.querySelector('.bookmarks-modal-content');
                const filter = modal.querySelector('.bookmarks-filter');
                const stats = modal.querySelector('.bookmarks-stats');
                if (content && filter && stats) {
                    const activeFilter = filter.querySelector('.bookmarks-filter-btn.active');
                    renderBookmarksModal(content, filter, stats, activeFilter?.textContent || 'All');
                }
            }
        }
    });

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    function init() {
        injectStyles();

        if (Repo.isRepoPage()) {
            setTimeout(addBookmarkButton, 500);
        }

        setTimeout(addBookmarksMenuItem, 500);
    }

    function watchForChanges() {
        const observer = new MutationObserver(() => {
            addBookmarksMenuItem();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['open']
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            init();
            watchForChanges();
        });
    } else {
        init();
        watchForChanges();
    }

    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            setTimeout(init, 500);
        }
    }).observe(document, { subtree: true, childList: true });

})();
