// Film Festival Planner App
// Following Gail's Law: Start simple, build complexity incrementally

class FilmFestivalPlanner {
    constructor() {
        this.films = [];
        // Load saved date view or use default festival start
        const savedDate = localStorage.getItem('iffrCurrentStartDate');
        if (savedDate) {
            const parsedDate = new Date(savedDate);
            // Validate the date is within festival range
            const festivalStart = new Date('2026-01-29');
            const festivalEnd = new Date('2026-02-08');
            if (parsedDate >= festivalStart && parsedDate <= festivalEnd) {
                this.currentStartDate = parsedDate;
            } else {
                this.currentStartDate = new Date('2026-01-29'); // Festival start
            }
        } else {
            this.currentStartDate = new Date('2026-01-29'); // Festival start
        }
        // Detect mobile and show 3 days instead of 5
        const isMobile = window.innerWidth <= 768;
        this.daysToShow = isMobile ? 3 : 5;
        this.notionApiKey = '';
        this.notionDatabaseId = '';
        this.currentDetailFilm = null;
        // Load user name from localStorage
        this.userName = localStorage.getItem('userName') || '';
        // Track if we're viewing a shared schedule (read-only mode)
        this.isSharedView = false;
        this.sharedUserName = '';
        this.updateHeaderTitle();
        // Backend server URL - automatically detects the current host
        // For local development: uses current hostname (works for both localhost and mobile access)
        // For tunnel/remote access: uses the same origin (works for Cloudflare tunnel, etc.)
        // For production: your deployed server URL (e.g., 'https://your-server.vercel.app')
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;
        const isLocal = window.location.protocol === 'file:' || 
                       hostname === 'localhost' || 
                       hostname === '127.0.0.1' ||
                       hostname === '' ||
                       hostname.startsWith('192.168.') ||
                       hostname.startsWith('10.') ||
                       hostname.startsWith('172.');
        const isTunnel = hostname.includes('trycloudflare.com') || hostname.includes('ngrok.io') || hostname.includes('localtunnel.me');
        // Use current hostname for backend (works for mobile access on same network)
        const port = '3001';
        // Check if backend URL is saved in localStorage (for remote access)
        const savedBackendUrl = localStorage.getItem('backendUrl');
        if (savedBackendUrl && savedBackendUrl.trim()) {
            this.backendUrl = savedBackendUrl.trim();
        } else if (isTunnel || (protocol === 'https:' && !isLocal)) {
            // If accessed via tunnel or HTTPS, use the same origin for API calls
            this.backendUrl = `${protocol}//${hostname}`;
        } else {
            // Auto-detect: use local network if on same network, otherwise empty
            this.backendUrl = isLocal ? `http://${hostname || 'localhost'}:${port}` : '';
        }
        
        // Listen for window resize to update daysToShow and recalculate film positions
        this.resizeTimeout = null;
        window.addEventListener('resize', () => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => {
                const wasMobile = this.daysToShow === 3;
                const isMobile = window.innerWidth <= 768;
                const newDaysToShow = isMobile ? 3 : 5;
                
                if (this.daysToShow !== newDaysToShow) {
                    this.daysToShow = newDaysToShow;
                    this.renderCalendar();
                }
                // Don't recalculate films on window resize - ResizeObserver handles calendar width changes
            }, 100); // Debounce resize events
        });
        
        // Setup ResizeObserver to detect calendar width changes (e.g., when sidebar toggles)
        this.setupCalendarResizeObserver();
        
        this.init();
    }
    
    setupCalendarResizeObserver() {
        // Disconnect existing observer if it exists
        if (this.calendarResizeObserver) {
            this.calendarResizeObserver.disconnect();
        }
        
        // Use ResizeObserver to detect calendar width changes (e.g., when sidebar toggles)
        // Observe the calendar-grid instead of calendar to avoid scroll-triggered changes
        if (typeof ResizeObserver !== 'undefined') {
            const calendar = document.getElementById('calendar');
            if (calendar) {
                const grid = calendar.querySelector('.calendar-grid');
                if (!grid) return; // Grid doesn't exist yet, skip setup
                
                // Initialize lastWidth with current width
                if (this.lastCalendarWidth === undefined) {
                    this.lastCalendarWidth = grid.offsetWidth;
                }
                
                this.calendarResizeObserver = new ResizeObserver((entries) => {
                    // Only recalculate if width actually changed significantly (not scroll artifacts)
                    const currentWidth = entries[0].contentRect.width;
                    const widthDiff = Math.abs(currentWidth - (this.lastCalendarWidth || 0));
                    
                    // Only trigger if width changed by more than 10px (ignores scrollbar appearance)
                    if (widthDiff > 10) {
                        this.lastCalendarWidth = currentWidth;
                        
                        // Debounce to avoid excessive recalculations
                        clearTimeout(this.resizeTimeout);
                        this.resizeTimeout = setTimeout(() => {
                            this.repositionFilms(); // Use reposition instead of full render
                        }, 300);
                    }
                });
                
                // Observe the calendar-grid (avoids scroll triggers)
                this.calendarResizeObserver.observe(grid);
            }
        }
    }
    
    repositionFilms() {
        // Reposition existing film blocks without recreating them (avoids flicker)
        const filmBlocks = document.querySelectorAll('.film-block');
        filmBlocks.forEach(block => {
            const filmId = block.dataset.filmId;
            const film = this.films.find(f => String(f.id) === String(filmId));
            if (film && film.startTime && film.endTime) {
                const filmDate = new Date(film.startTime);
                const dayColumn = document.querySelector(`[data-date="${this.formatDateKey(filmDate)}"]`);
                if (dayColumn) {
                    const timeSlots = dayColumn.querySelector('.time-slots');
                    if (timeSlots) {
                        this.positionFilmBlock(block, film, timeSlots);
                    }
                }
            }
        });
    }

    init() {
        // Check for shared schedule in URL parameters
        this.checkForSharedSchedule();
        this.setupEventListeners();
        this.loadNotionConfig();
        this.loadFavoritesSidebarState();
        this.renderCalendar();
        this.renderFavoritesSidebar();
        this.setupMobileLayout();
    }

    setupEventListeners() {
        // Remove focus from buttons after click to prevent annoying focus outlines
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                const button = e.target.tagName === 'BUTTON' ? e.target : e.target.closest('button');
                // Small delay to allow click to register, then blur
                setTimeout(() => {
                    if (button && document.activeElement === button) {
                        button.blur();
                    }
                }, 100);
            }
        }, true); // Use capture phase to catch all button clicks
        
        document.getElementById('prev-days').addEventListener('click', () => this.navigateDays(-1));
        document.getElementById('next-days').addEventListener('click', () => this.navigateDays(1));
        document.getElementById('add-film-btn').addEventListener('click', () => this.openModal('iffr'));
        document.getElementById('manual-add-btn').addEventListener('click', () => this.openModal('manual'));
        document.getElementById('settings-btn').addEventListener('click', () => this.openSettingsModal());
        
        // Close button for add film modal - use event delegation since modal might be recreated
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close') && e.target.closest('#film-modal')) {
                this.closeModal();
            }
        });
        
        document.getElementById('close-detail').addEventListener('click', () => this.closeDetailModal());
        document.getElementById('film-form').addEventListener('submit', (e) => this.handleAddFilm(e));
        document.getElementById('manual-film-form').addEventListener('submit', (e) => this.handleManualAddFilm(e));
        document.getElementById('delete-film-btn').addEventListener('click', () => this.deleteFilmFromDetail());
        
        // Handle unavailable checkbox toggle
        document.getElementById('manual-unavailable').addEventListener('change', (e) => this.handleUnavailableToggle(e));
        
        // Settings modal
        const closeSettings = document.getElementById('close-settings');
        if (closeSettings) {
            closeSettings.addEventListener('click', () => this.closeSettingsModal());
        }
        const settingsForm = document.getElementById('settings-form');
        if (settingsForm) {
            settingsForm.addEventListener('submit', (e) => this.handleSettingsSave(e));
        }
        const testNotionBtn = document.getElementById('test-notion-btn');
        if (testNotionBtn) {
            testNotionBtn.addEventListener('click', () => this.testNotionConnection());
        }
        const shareScheduleBtn = document.getElementById('share-schedule-btn');
        if (shareScheduleBtn) {
            shareScheduleBtn.addEventListener('click', () => this.shareSchedule());
        }
        
        // Add to Favorites button
        const addToFavoritesBtn = document.getElementById('add-to-favorites-btn');
        if (addToFavoritesBtn) {
            addToFavoritesBtn.addEventListener('click', () => this.handleAddToFavorites());
        }
        
        // Toggle favorites sidebar - make entire header clickable
        const toggleFavoritesBtn = document.getElementById('toggle-favorites-btn');
        const sidebarHeader = document.querySelector('.sidebar-header');
        
        if (toggleFavoritesBtn) {
            toggleFavoritesBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent double-trigger if header also has listener
                this.toggleFavoritesSidebar();
            });
        }
        
        // Make entire sidebar header clickable to toggle
        if (sidebarHeader) {
            sidebarHeader.addEventListener('click', (e) => {
                // Only trigger if not clicking the button itself
                if (!e.target.closest('.sidebar-toggle-btn')) {
                    this.toggleFavoritesSidebar();
                }
            });
        }
        
        // Handle clicks on favorite film items (event delegation)
        const favoritesList = document.getElementById('favorites-list');
        if (favoritesList) {
            favoritesList.addEventListener('click', (e) => {
                const favoriteItem = e.target.closest('.favorite-film-item');
                if (favoriteItem && !favoriteItem.classList.contains('empty')) {
                    const filmId = favoriteItem.dataset.filmId;
                    if (filmId) {
                        // Remove active state from all items
                        document.querySelectorAll('.favorite-film-item').forEach(item => {
                            item.classList.remove('active');
                        });
                        // Add active state to clicked item
                        favoriteItem.classList.add('active');
                        // Allow viewing details even in shared view, but scheduling is disabled
                        this.showFilmDetailFromFavorites(filmId);
                    }
                }
            });
        }
        
        // Close settings modal when clicking outside
        window.addEventListener('click', (e) => {
            const settingsModal = document.getElementById('settings-modal');
            if (e.target === settingsModal) this.closeSettingsModal();
        });
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('film-modal');
            if (e.target === modal) this.closeModal();
        });
        
        // Close detail panel when clicking outside (but not inside the modal)
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('film-detail-modal');
            if (!modal) return;
            
            const modalContent = modal.querySelector('.modal-content');
            if (!modalContent) return;
            
            // Only close if:
            // 1. Modal is open
            // 2. Click is outside the modal content
            // 3. Click is not on a film block
            // 4. Click is not inside any button or interactive element
            // 5. Click is not on a favorite film item (to allow opening modal from favorites)
            if (modal.classList.contains('open') && 
                !modalContent.contains(e.target) && 
                !e.target.closest('.film-block') &&
                !e.target.closest('.favorite-film-item') &&
                !e.target.closest('button') &&
                !e.target.closest('a') &&
                !e.target.closest('input') &&
                !e.target.closest('select')) {
                this.closeDetailModal();
            }
        });
    }

    loadNotionConfig() {
        // Don't load from Notion/localStorage if viewing a shared schedule
        if (this.isSharedView) {
            return;
        }
        
        // Check for Notion config in localStorage or prompt user
        const savedKey = localStorage.getItem('notionApiKey');
        const savedDbId = localStorage.getItem('notionDatabaseId');
        const savedBackendUrl = localStorage.getItem('backendUrl');
        
        // Load backend URL if saved
        if (savedBackendUrl && savedBackendUrl.trim()) {
            this.backendUrl = savedBackendUrl.trim();
        }
        
        if (savedKey && savedDbId) {
            this.notionApiKey = savedKey;
            this.notionDatabaseId = savedDbId;
            this.loadFilmsFromNotion();
        } else {
            this.promptNotionSetup();
        }
    }

    promptNotionSetup() {
        // Check if we should prompt for Notion setup or just use localStorage
        // For now, start simple - use localStorage by default
        // User can configure Notion later via a settings option
        this.loadFilmsFromLocalStorage();
    }

    async loadFilmsFromNotion() {
        if (!this.notionApiKey || !this.notionDatabaseId) {
            console.log('Notion not configured, using localStorage');
            this.loadFilmsFromLocalStorage();
            return;
        }

        if (!this.backendUrl) {
            console.warn('Backend server not configured. Please set backendUrl in app.js or use localStorage.');
            this.loadFilmsFromLocalStorage();
            return;
        }

        try {
            // Call our backend server which proxies to Notion API
            const response = await fetch(`${this.backendUrl}/api/notion/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    databaseId: this.notionDatabaseId,
                    apiKey: this.notionApiKey
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Notion API error: ${response.status} - ${errorData.error || 'Unknown error'}`);
            }

            const data = await response.json();
            this.films = this.mapNotionPagesToFilms(data.results);
            
            // Save to localStorage after loading from Notion (so it's in sync)
            this.saveFilms();
            
            this.renderCalendar();
            this.renderFavoritesSidebar();
        } catch (error) {
            console.error('Error loading from Notion:', error);
            // Fallback to localStorage on error
            this.loadFilmsFromLocalStorage();
        }
    }

    mapNotionPagesToFilms(notionPages) {
        // Map Notion database pages to our film structure
        // Following Gail's Law: simple mapping, assume standard property names
        return notionPages.map(page => {
            const props = page.properties;
            
            // Extract properties (handle different property types)
            const getText = (prop) => {
                if (!prop) return '';
                if (prop.type === 'title' && prop.title && prop.title.length > 0) {
                    return prop.title[0].plain_text;
                }
                if (prop.type === 'rich_text' && prop.rich_text && prop.rich_text.length > 0) {
                    return prop.rich_text[0].plain_text;
                }
                return '';
            };

            const getDate = (prop) => {
                if (!prop || prop.type !== 'date' || !prop.date) return null;
                return prop.date.start;
            };

            const getCheckbox = (prop) => {
                if (!prop || prop.type !== 'checkbox') {
                    return false;
                }
                const value = prop.checkbox;
                // Debug log for unavailable specifically
                if (prop && (prop.type === 'checkbox')) {
                    // This will be logged when we check unavailable below
                }
                return value;
            };

            const getUrl = (prop) => {
                if (!prop || prop.type !== 'url' || !prop.url) return '';
                return prop.url;
            };

            // Map to our film structure
            // Assume property names: Title, Director, Country, Programme, Start Time, End Time, Location, IFFR Link, Moderating, Favorited, Ticket
            const startTime = getDate(props['Start Time'] || props['StartTime'] || props['startTime']);
            const endTime = getDate(props['End Time'] || props['EndTime'] || props['endTime']);

            // Get screenings if stored (as JSON string in a text property)
            let screenings = [];
            const screeningsText = getText(props['Screenings'] || props['screenings']);
            if (screeningsText) {
                try {
                    screenings = JSON.parse(screeningsText);
                    // Ensure each screening has availability info (for backward compatibility)
                    screenings = screenings.map(screening => ({
                        ...screening,
                        available: screening.available !== undefined ? screening.available : true,
                        unavailableReason: screening.unavailableReason || null
                    }));
                    console.log('Loaded screenings from Notion:', screenings.length, screenings);
                } catch (e) {
                    console.warn('Failed to parse screenings:', e, 'Text was:', screeningsText);
                }
            } else {
                console.log('No screenings found in Notion for film:', getText(props['Title'] || props['title'] || props['Name'] || props['name']));
            }

            // Get combined programme data if stored
            let isCombinedProgramme = false;
            let combinedFilms = [];
            const combinedProgrammeText = getText(props['Combined Programme'] || props['combinedProgramme'] || props['CombinedProgramme']);
            if (combinedProgrammeText) {
                try {
                    const combinedData = JSON.parse(combinedProgrammeText);
                    isCombinedProgramme = combinedData.isCombinedProgramme || false;
                    combinedFilms = combinedData.combinedFilms || [];
                } catch (e) {
                    // If it's not JSON, try to parse as boolean
                    isCombinedProgramme = combinedProgrammeText.toLowerCase() === 'true';
                }
            }

            return {
                id: page.id.replace(/-/g, ''), // Use Notion page ID as our ID
                notionPageId: page.id, // Store original Notion page ID for updates
                title: getText(props['Title'] || props['title'] || props['Name'] || props['name']),
                director: getText(props['Director'] || props['director']),
                country: getText(props['Country'] || props['country']),
                programme: getText(props['Programme'] || props['programme']),
                startTime: startTime ? new Date(startTime).toISOString() : null,
                endTime: endTime ? new Date(endTime).toISOString() : null,
                location: getText(props['Location'] || props['location']),
                iffrLink: getUrl(props['IFFR Link'] || props['IFFRLink'] || props['iffrLink'] || props['Link'] || props['link']),
                moderating: getCheckbox(props['Moderating'] || props['moderating']),
                favorited: getCheckbox(props['Favorited'] || props['favorited']),
                ticket: getCheckbox(props['Ticket'] || props['ticket']),
                unavailable: getCheckbox(props['Unavailable'] || props['unavailable']),
                screenings: screenings.length > 0 ? screenings : [], // Store all screenings for this film
                isCombinedProgramme: isCombinedProgramme,
                combinedFilms: combinedFilms
            };
        }).filter(film => film.title); // Only include films with titles
    }

    loadFilmsFromLocalStorage() {
        // Don't load from localStorage if viewing a shared schedule
        if (this.isSharedView) {
            return;
        }
        
        const saved = localStorage.getItem('iffrFilms');
        if (saved) {
            this.films = JSON.parse(saved);
            // Ensure all films have screenings array (for backward compatibility)
            this.films.forEach(film => {
                if (!film.screenings) {
                    film.screenings = [];
                }
            });
            this.renderCalendar();
            this.renderFavoritesSidebar();
        }
    }

    async saveFilms() {
        // Always save to localStorage as backup
        localStorage.setItem('iffrFilms', JSON.stringify(this.films));
        
        // Update sidebar when films are saved
        this.renderFavoritesSidebar();
        
        // If we have a shared schedule, update it automatically
        const shareId = localStorage.getItem('myShareId');
        if (shareId && this.backendUrl && !this.isSharedView) {
            try {
                await fetch(`${this.backendUrl}/api/share`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userName: this.userName || 'Anonymous',
                        films: this.films,
                        shareId: shareId
                    })
                });
                console.log('Shared schedule updated automatically');
            } catch (error) {
                console.error('Failed to update shared schedule:', error);
                // Don't show error to user - this is a background update
            }
        }
        
        // If Notion is configured, also save there (simple approach: sync on save)
        if (this.notionApiKey && this.notionDatabaseId) {
            // For now, just log - we'll implement full sync later
            // Following Gail's Law: start with read, add write incrementally
            console.log('Notion sync: would save films here');
            // TODO: Implement Notion create/update logic
        }
    }

    navigateDays(days) {
        const newDate = new Date(this.currentStartDate);
        newDate.setDate(newDate.getDate() + days);
        
        // Calculate the end date of the range we want to show
        const newEndDate = new Date(newDate);
        newEndDate.setDate(newEndDate.getDate() + this.daysToShow - 1);
        
        // Don't go before festival start or after festival end
        const festivalStart = new Date('2026-01-29');
        const festivalEnd = new Date('2026-02-08');
        
        // Check that both start and end dates are within festival range
        if (newDate >= festivalStart && newDate <= festivalEnd && 
            newEndDate >= festivalStart && newEndDate <= festivalEnd) {
            this.currentStartDate = newDate;
            // Save current view to localStorage
            localStorage.setItem('iffrCurrentStartDate', newDate.toISOString());
            this.renderCalendar();
            this.updateNavigationButtons();
        }
    }

    canNavigate(days) {
        const newDate = new Date(this.currentStartDate);
        newDate.setDate(newDate.getDate() + days);
        
        // Calculate the end date of the range we want to show
        const newEndDate = new Date(newDate);
        newEndDate.setDate(newEndDate.getDate() + this.daysToShow - 1);
        
        // Don't go before festival start or after festival end
        const festivalStart = new Date('2026-01-29');
        const festivalEnd = new Date('2026-02-08');
        
        // Check that both start and end dates are within festival range
        return newDate >= festivalStart && newDate <= festivalEnd && 
               newEndDate >= festivalStart && newEndDate <= festivalEnd;
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('prev-days');
        const nextBtn = document.getElementById('next-days');
        
        const canGoPrev = this.canNavigate(-1);
        const canGoNext = this.canNavigate(1);
        
        if (prevBtn) {
            if (canGoPrev) {
                prevBtn.classList.remove('disabled');
                prevBtn.disabled = false;
            } else {
                prevBtn.classList.add('disabled');
                prevBtn.disabled = true;
            }
        }
        
        if (nextBtn) {
            if (canGoNext) {
                nextBtn.classList.remove('disabled');
                nextBtn.disabled = false;
            } else {
                nextBtn.classList.add('disabled');
                nextBtn.disabled = true;
            }
        }
    }

    renderCalendar() {
        const calendar = document.getElementById('calendar');
        const dateRange = document.getElementById('date-range');
        
        // Update date range display
        const endDate = new Date(this.currentStartDate);
        endDate.setDate(endDate.getDate() + this.daysToShow - 1);
        const dateRangeText = `${this.formatDate(this.currentStartDate)} - ${this.formatDate(endDate)}`;
        
        if (dateRange) {
            dateRange.textContent = dateRangeText;
        }
        
        // Update navigation buttons
        this.updateNavigationButtons();
        
        // Preserve the detail modal if it exists
        const existingModal = calendar.querySelector('#film-detail-modal');
        const wasOpen = existingModal && existingModal.classList.contains('open');
        
        // Create calendar grid with time column
        calendar.innerHTML = `
            <div class="calendar-wrapper">
                <div class="time-column">
                    <!-- Time labels will be added here -->
                </div>
                <div class="calendar-grid" style="display: grid; grid-template-columns: repeat(${this.daysToShow}, 1fr); gap: 0; width: 100%;"></div>
            </div>
            <!-- Film Detail Panel (integrated into calendar) -->
            <div id="film-detail-modal">
                <div class="modal-content">
                    <span class="close" id="close-detail">&times;</span>
                    <h2 id="detail-title"></h2>
                    <div id="film-details"></div>
                    <div class="detail-actions">
                        <button id="unschedule-film-btn" class="btn-secondary" style="display: none; background: var(--teal);">Unschedule</button>
                        <button id="delete-film-btn" class="btn-secondary" style="background: var(--red);">Delete</button>
                    </div>
                </div>
            </div>
        `;
        
        // Navigation buttons are in the HTML and already have event listeners from setupEventListeners()
        // No need to re-attach them here since they're not recreated
        
        // Re-attach event listeners for detail modal
        const closeBtn = document.getElementById('close-detail');
        const unscheduleBtn = document.getElementById('unschedule-film-btn');
        const deleteBtn = document.getElementById('delete-film-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeDetailModal());
        if (unscheduleBtn) unscheduleBtn.addEventListener('click', () => this.unscheduleFilm());
        if (deleteBtn) deleteBtn.addEventListener('click', () => this.deleteFilmFromDetail());
        
        const wrapper = calendar.querySelector('.calendar-wrapper');
        const timeColumn = calendar.querySelector('.time-column');
        const grid = calendar.querySelector('.calendar-grid');
        
        // Add time labels (8am to 11pm)
        // Time labels align with time-slots, not day headers
        for (let hour = 8; hour <= 23; hour++) {
            const timeLabel = document.createElement('div');
            timeLabel.className = 'time-label';
            timeLabel.textContent = `${hour.toString().padStart(2, '0')}:00`;
            timeLabel.style.height = '60px'; // Match time slot height (60px per hour)
            timeColumn.appendChild(timeLabel);
        }
        
        // Create day columns
        for (let i = 0; i < this.daysToShow; i++) {
            const date = new Date(this.currentStartDate);
            date.setDate(date.getDate() + i);
            
            const dayColumn = document.createElement('div');
            dayColumn.className = 'day-column';
            dayColumn.dataset.date = this.formatDateKey(date);
            
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            // Don't set inline padding, let CSS handle it for responsive behavior
            dayHeader.innerHTML = `
                <div>${this.getDayName(date)}</div>
                <div class="day-date">${this.formatDate(date)}</div>
            `;
            
            dayColumn.appendChild(dayHeader);
            
            // Add time slots container
            const timeSlots = document.createElement('div');
            timeSlots.className = 'time-slots';
            timeSlots.style.position = 'relative';
            timeSlots.style.minHeight = '960px'; // 16 hours * 60px = 960px
            timeSlots.style.marginTop = '0'; // No margin, starts right after header
            dayColumn.appendChild(timeSlots);
            
            grid.appendChild(dayColumn);
        }
        
        // Render films
        this.renderFilms();
        
        // Update navigation button states
        this.updateNavigationButtons();
        
        // Re-setup ResizeObserver after calendar is rendered (grid is recreated)
        this.setupCalendarResizeObserver();
    }

    renderFavoritesSidebar() {
        const favoritesList = document.getElementById('favorites-list');
        const favoritesCount = document.getElementById('favorites-count');
        if (!favoritesList || !favoritesCount) return;

        // Filter films that are favorited but don't have scheduled times
        const unscheduledFavorites = this.films.filter(film => {
            return film.favorited && (!film.startTime || !film.endTime);
        });

        favoritesCount.textContent = unscheduledFavorites.length;

        if (unscheduledFavorites.length === 0) {
            favoritesList.innerHTML = `
                <div class="favorite-film-item empty">
                    No unscheduled favorites yet.<br>
                    <span style="font-size: 11px; margin-top: 8px; display: block;">Add films to favorites without scheduling them.</span>
                </div>
            `;
            return;
        }

        favoritesList.innerHTML = unscheduledFavorites.map(film => {
            const meta = [];
            if (film.director) meta.push(film.director);
            if (film.country) meta.push(film.country);
            if (film.programme) meta.push(film.programme);
            
            // Check if screenings exist and are valid
            const hasScreenings = film.screenings && Array.isArray(film.screenings) && film.screenings.length > 0;
            
            // Debug logging
            if (!hasScreenings && film.iffrLink) {
                console.log('Film has IFFR link but no screenings:', film.title, film);
            }
            
            return `
                <div class="favorite-film-item" data-film-id="${film.id}">
                    <div class="favorite-film-title">${film.title}</div>
                    <div class="favorite-film-meta">
                        ${meta.length > 0 ? meta.join(' • ') : 'No details'}
                        ${hasScreenings ? `<br><span style="color: var(--teal);">${film.screenings.length} screening${film.screenings.length > 1 ? 's' : ''} available</span>` : ''}
                        ${!hasScreenings && film.iffrLink ? `<br><span style="color: rgba(255,255,255,0.4); font-size: 10px;">Re-parse IFFR link to get screenings</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    setupMobileLayout() {
        // Move favorites sidebar to controls-center on mobile
        const favoritesSidebar = document.getElementById('favorites-sidebar');
        const controlsCenter = document.querySelector('.controls-center');
        const mainContentWrapper = document.querySelector('.main-content-wrapper');
        
        if (!favoritesSidebar || !controlsCenter || !mainContentWrapper) return;
        
        const moveToControls = () => {
            if (window.matchMedia('(max-width: 1200px)').matches) {
                // Mobile: move to controls-center
                if (favoritesSidebar.parentElement !== controlsCenter) {
                    controlsCenter.appendChild(favoritesSidebar);
                }
            } else {
                // Desktop: move back to main-content-wrapper
                if (favoritesSidebar.parentElement !== mainContentWrapper) {
                    mainContentWrapper.insertBefore(favoritesSidebar, mainContentWrapper.firstChild);
                }
            }
        };
        
        // Initial move
        moveToControls();
        
        // Listen for resize
        window.addEventListener('resize', moveToControls);
    }

    loadFavoritesSidebarState() {
        const sidebar = document.getElementById('favorites-sidebar');
        const toggleBtn = document.getElementById('toggle-favorites-btn');
        const toggleIconMobile = toggleBtn?.querySelector('.toggle-icon-mobile');
        const toggleIconDesktop = toggleBtn?.querySelector('.toggle-icon-desktop');
        
        if (!sidebar || !toggleBtn) return;
        
        // Check if we're in responsive mode
        const isResponsive = window.matchMedia('(max-width: 1200px)').matches;
        
        if (isResponsive) {
            // Horizontal strip mode - remove collapsed class, manage expanded
            sidebar.classList.remove('collapsed');
            const expandedState = localStorage.getItem('favoritesSidebarExpanded');
            if (expandedState === 'true') {
                sidebar.classList.add('expanded');
                if (toggleIconMobile) toggleIconMobile.textContent = '▼';
            } else {
                sidebar.classList.remove('expanded');
                if (toggleIconMobile) toggleIconMobile.textContent = '▶';
            }
        } else {
            // Vertical sidebar mode - remove expanded class, manage collapsed
            // Desktop SVG icon doesn't need text updates, it's always visible
            sidebar.classList.remove('expanded');
            const collapsedState = localStorage.getItem('favoritesSidebarCollapsed');
            if (collapsedState === 'true') {
                sidebar.classList.add('collapsed');
            } else {
                sidebar.classList.remove('collapsed');
            }
        }
        
        // Listen for window resize to update state (only add once)
        if (!this.resizeListenerAdded) {
            window.addEventListener('resize', () => {
                this.loadFavoritesSidebarState();
            });
            this.resizeListenerAdded = true;
        }
    }

    toggleFavoritesSidebar(shouldToggle = true) {
        const sidebar = document.getElementById('favorites-sidebar');
        const toggleBtn = document.getElementById('toggle-favorites-btn');
        const toggleIconMobile = toggleBtn?.querySelector('.toggle-icon-mobile');
        const toggleIconDesktop = toggleBtn?.querySelector('.toggle-icon-desktop');
        
        if (!sidebar || !toggleBtn) return;
        
        // Check if we're in responsive mode (horizontal strip)
        const isResponsive = window.matchMedia('(max-width: 1200px)').matches;
        
        if (isResponsive) {
            // Horizontal strip mode - toggle expanded class
            // Remove collapsed class if present (from vertical mode)
            sidebar.classList.remove('collapsed');
            if (shouldToggle) {
                sidebar.classList.toggle('expanded');
            }
            const isExpanded = sidebar.classList.contains('expanded');
            // SVG rotation is handled by CSS (.favorites-sidebar.expanded .sidebar-icon-svg-mobile)
            localStorage.setItem('favoritesSidebarExpanded', isExpanded ? 'true' : 'false');
        } else {
            // Vertical sidebar mode - toggle collapsed class
            // Remove expanded class if present (from horizontal mode)
            // Desktop SVG icon doesn't need text updates
            sidebar.classList.remove('expanded');
            if (shouldToggle) {
                sidebar.classList.toggle('collapsed');
            }
            const isCollapsed = sidebar.classList.contains('collapsed');
            localStorage.setItem('favoritesSidebarCollapsed', isCollapsed ? 'true' : 'false');
            
            // Recalculate film positions after sidebar transition completes
            // Use reposition instead of full render to avoid flicker
            setTimeout(() => {
                this.repositionFilms();
            }, 350);
        }
    }

    renderFilms() {
        // Clear existing film blocks
        document.querySelectorAll('.film-block').forEach(block => block.remove());
        
        this.films.forEach(film => {
            // Only render films with scheduled times
            if (!film.startTime || !film.endTime) return;
            
            const filmDate = new Date(film.startTime);
            const dayColumn = document.querySelector(`[data-date="${this.formatDateKey(filmDate)}"]`);
            
            if (!dayColumn) return;
            
            const timeSlots = dayColumn.querySelector('.time-slots');
            if (!timeSlots) return;
            
            // Check for overlaps before creating the block
            const overlappingFilms = this.getOverlappingFilms(film, filmDate);
            const hasOverlaps = overlappingFilms.length > 1;
            
            const filmBlock = this.createFilmBlock(film, hasOverlaps);
            this.positionFilmBlock(filmBlock, film, timeSlots);
            timeSlots.appendChild(filmBlock);
        });
    }

    getLocationShortcode(location) {
        if (!location) return '';
        
        // Location shortcode mapping
        const shortcodes = {
            'de Doelen & de Doelen Studios': 'DD',
            'Pathé Schouwburgplein': 'PS',
            'Theater Rotterdam': 'TR',
            'Cinerama Filmtheater': 'CF',
            'Oude Luxor': 'OL',
            'KINO': 'KINO',
            'LantarenVenster': 'LV',
            'Fenix / Plein': 'FP',
            'Nieuwe Luxor': 'NL',
            'WORM CS & WORM UBIK': 'WORM',
            'V2_Lab for Unstable Media': 'V2',
            'Nieuwe Instituut': 'NI',
            'Stationshal Rotterdam Centraal': 'SRC',
            'Brutus': 'BR',
            'Katoenhuis': 'KH',
            'Podium Islemunda': 'PI',
            'Roodkapje': 'RK',
            'Muziekwerf': 'MZ'
        };
        
        // Extract room number if present (e.g., "LantarenVenster 1" or "KINO 2")
        const roomMatch = location.match(/(\d+)$/);
        const roomNumber = roomMatch ? roomMatch[1] : null;
        
        // Find matching location (check if location starts with any key)
        let shortcode = '';
        for (const [key, code] of Object.entries(shortcodes)) {
            if (location.startsWith(key)) {
                shortcode = code;
                break;
            }
        }
        
        // If no match found, try to extract first letters
        if (!shortcode) {
            const words = location.split(' ');
            if (words.length > 0) {
                shortcode = words[0].substring(0, 2).toUpperCase();
            }
        }
        
        // Append room number if present
        return roomNumber ? `${shortcode}${roomNumber}` : shortcode;
    }

    createFilmBlock(film, hasOverlaps = false) {
        const block = document.createElement('div');
        block.className = 'film-block';
        
        // Unavailable time gets special styling (highest priority)
        if (film.unavailable) {
            block.classList.add('unavailable');
        } else if (film.moderating) {
            // Determine status class - priority: moderating > ticket > favorited
            // Ticket color shows when ticket is checked, except if moderating is also checked
            block.classList.add('moderating');
        } else if (film.ticket) {
            block.classList.add('ticket');
        } else if (film.favorited) {
            block.classList.add('favorited');
        } else {
            block.classList.add('default');
        }
        
        // Build status icons
        const statusIcons = [];
        if (film.favorited) {
            statusIcons.push('<span class="status-icon" title="Favorited">❤️</span>');
        }
        if (film.ticket) {
            statusIcons.push('<span class="status-icon" title="Ticket">🎫</span>');
        }
        if (film.moderating) {
            statusIcons.push('<span class="status-icon" title="Moderating">M</span>');
        }
        
        // When there are overlaps, show simplified view (title only)
        if (hasOverlaps) {
            block.classList.add('simplified');
            block.innerHTML = `
                <div class="film-status-icons">${statusIcons.join('')}</div>
                <div class="film-title">${film.title}</div>
            `;
        } else if (film.unavailable) {
            // Unavailable time - simplified view
            const startTime = this.formatTime(new Date(film.startTime));
            const endTime = this.formatTime(new Date(film.endTime));
            block.innerHTML = `
                <div class="film-status-icons">🚫</div>
                <div class="film-time">${startTime} → ${endTime}</div>
                <div class="film-title">${film.title}</div>
            `;
        } else {
            // Full view with all details
            const startTime = this.formatTime(new Date(film.startTime));
            const endTime = this.formatTime(new Date(film.endTime));
            
            // Calculate duration for display
            const duration = this.calculateDuration(film.startTime, film.endTime);
            const durationText = `${duration} min`;
            
            // Get location shortcode
            const locationShortcode = this.getLocationShortcode(film.location);
            
            block.innerHTML = `
                <div class="film-status-icons">${statusIcons.join('')}</div>
                <div class="film-time">${startTime} → ${endTime}</div>
                <div class="film-title">${film.title}</div>
                ${film.director ? `<div class="film-director">${film.director}</div>` : ''}
                ${film.programme ? `<div class="film-programme">${film.programme}</div>` : ''}
                <div class="film-extra-info">
                    ${durationText}
                    ${locationShortcode ? ` • ${locationShortcode}` : ''}
                </div>
            `;
        }
        
        block.dataset.filmId = film.id;
        block.addEventListener('click', (e) => this.showFilmDetail(film, e.currentTarget));
        
        return block;
    }

    showFilmDetail(film, filmBlockElement) {
        // Find the film object to ensure we have the latest data
        const currentFilm = this.films.find(f => f.id === film.id) || film;
        this.currentDetailFilm = currentFilm;
        
        // Debug: log film data to verify IFFR link is present
        console.log('Showing film detail:', {
            title: currentFilm.title,
            iffrLink: currentFilm.iffrLink,
            hasIffrLink: !!currentFilm.iffrLink
        });
        
        const modal = document.getElementById('film-detail-modal');
        const modalContent = modal.querySelector('.modal-content');
        const title = document.getElementById('detail-title');
        const details = document.getElementById('film-details');
        
        title.textContent = currentFilm.title;
        
        // Handle unavailable time blocks
        const isUnavailable = currentFilm.unavailable;
        
        // Handle unscheduled films (no startTime/endTime)
        const isScheduled = currentFilm.startTime && currentFilm.endTime;
        let timeInfo = '';
        let durationInfo = '';
        
        if (isScheduled) {
            const startDate = new Date(currentFilm.startTime);
            const endDate = new Date(currentFilm.endTime);
            const dateStr = this.formatDate(startDate);
            const startTime = this.formatTime(startDate);
            const endTime = this.formatTime(endDate);
            const duration = this.calculateDuration(currentFilm.startTime, currentFilm.endTime);
            timeInfo = `<div class="detail-item">
                    <strong>Time:</strong> ${dateStr} | ${startTime} - ${endTime}
                </div>`;
            if (!isUnavailable) {
                durationInfo = `<div class="detail-item">
                        <strong>Duration:</strong> ${duration} min
                    </div>`;
            }
        } else {
            timeInfo = `<div class="detail-item">
                    <strong>Time:</strong> <span style="color: var(--teal);">Not scheduled</span>
                </div>`;
        }
        
        // Show unavailable notice if applicable
        let unavailableNotice = '';
        if (isUnavailable) {
            unavailableNotice = `<div class="detail-item" style="background: rgba(128, 128, 128, 0.2); border: 1px solid rgba(128, 128, 128, 0.4); border-radius: 8px; padding: 12px; margin-top: 8px;">
                    <strong>🚫 Unavailable Time</strong>
                    <div style="margin-top: 6px; font-size: 12px; opacity: 0.8;">This time slot is blocked for other commitments.</div>
                </div>`;
        }
        
        // Build status buttons - always visible
        const statuses = [
            { key: 'favorited', label: 'Favorited', icon: '❤️' },
            { key: 'ticket', label: 'Ticket', icon: '🎫' },
            { key: 'moderating', label: 'Moderating', icon: 'M' }
        ];
        
        const statusButtons = statuses.map(s => {
            // For ticket button: show as active if ticket is true OR if moderating is true (moderating includes ticket)
            const isActive = s.key === 'ticket' 
                ? (currentFilm[s.key] || currentFilm.moderating)
                : currentFilm[s.key];
            // Disable ticket button if:
            // 1. Moderating is active (moderating automatically includes ticket)
            // 2. Film is not scheduled (can't have ticket without a scheduled time)
            const isDisabled = s.key === 'ticket' && (currentFilm.moderating || !isScheduled);
            const disabledTitle = s.key === 'ticket' && !isScheduled 
                ? 'Schedule the film first to mark it as having a ticket'
                : (s.key === 'ticket' && currentFilm.moderating ? 'Ticket is automatically included when moderating' : '');
            return `<button class="status-toggle-btn ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}" 
                    data-status="${s.key}" 
                    ${isDisabled ? `disabled title="${disabledTitle}"` : ''}>
                <span class="status-btn-icon">${s.icon}</span>
                <span class="status-btn-label">${s.label}${isActive ? ' ✓' : ''}</span>
            </button>`;
        }).join('');
        
        // Build screening switcher if film has screenings (show for unscheduled films too)
        // Hide screening switcher in shared view
        let screeningSwitcher = '';
        if (currentFilm.screenings && currentFilm.screenings.length > 0 && !this.isSharedView) {
            const currentScreeningIndex = currentFilm.screenings.findIndex(s => {
                if (!isScheduled) return false;
                return s.startTime === currentFilm.startTime && s.endTime === currentFilm.endTime;
            });
            
            const screeningLabel = isScheduled 
                ? `Switch Screening (${currentFilm.screenings.length} available):`
                : `Available Screenings (${currentFilm.screenings.length}):`;
            
            // Determine film status for styling the selected screening
            // Priority: ticket > moderating > favorited > default
            let statusClass = 'default';
            if (currentFilm.ticket) {
                statusClass = 'ticket';
            } else if (currentFilm.moderating) {
                statusClass = 'moderating';
            } else if (currentFilm.favorited) {
                statusClass = 'favorited';
            }
            
            screeningSwitcher = `
                <div class="screening-switcher screening-switcher-${statusClass}">
                    <span class="screening-switcher-label">${screeningLabel}</span>
                    ${currentFilm.screenings.map((screening, index) => {
                        const isSelected = isScheduled && index === currentScreeningIndex;
                        const isAvailable = screening.available !== false; // Default to true if not set
                        const qaBadge = screening.hasQA ? ' • Q&A' : '';
                        const unavailableBadge = !isAvailable ? ` • ${screening.unavailableReason || 'Not Available'}` : '';
                        const screeningStartDate = new Date(screening.startTime);
                        const screeningEndDate = new Date(screening.endTime);
                        const screeningDateStr = this.formatDate(screeningStartDate);
                        const screeningStartTimeStr = this.formatTime(screeningStartDate);
                        const screeningEndTimeStr = this.formatTime(screeningEndDate);
                        
                        // Disable screening switcher in shared view
                        const canSwitch = isAvailable && !this.isSharedView;
                        const onClickHandler = canSwitch ? `app.switchFilmScreening('${currentFilm.id}', ${index})` : (this.isSharedView ? `alert('Cannot change screenings in shared view. This is a read-only schedule.'); return false;` : 'return false;');
                        const disabledStyle = (!isAvailable || this.isSharedView) ? 'opacity: 0.5; cursor: not-allowed;' : '';
                        
                        return `
                            <div class="screening-option-small ${isSelected ? 'selected' : ''} ${!isAvailable ? 'unavailable' : ''} ${this.isSharedView ? 'disabled' : ''}" 
                                 onclick="${onClickHandler}"
                                 style="${disabledStyle}">
                                <div class="screening-time">${screeningDateStr} | ${screeningStartTimeStr} - ${screeningEndTimeStr}</div>
                                <div class="screening-location">${screening.location}${qaBadge}${unavailableBadge}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
        
        // Build combined programme info if applicable
        let combinedProgrammeInfo = '';
        if (currentFilm.isCombinedProgramme && currentFilm.combinedFilms && currentFilm.combinedFilms.length > 0) {
            combinedProgrammeInfo = `
                <div class="detail-item" style="background: rgba(139, 92, 246, 0.1); border: 1px solid var(--purple); border-radius: 8px; padding: 12px; margin-top: 8px;">
                    <div style="font-weight: 600; margin-bottom: 8px; color: var(--purple);">
                        📽️ Combined Programme
                    </div>
                    <div style="margin-bottom: 8px; opacity: 0.9; font-size: 11px;">
                        This film is part of a combined programme with ${currentFilm.combinedFilms.length} other film${currentFilm.combinedFilms.length > 1 ? 's' : ''}:
                    </div>
                    <ul style="margin: 0; padding-left: 20px; opacity: 0.8; font-size: 11px;">
                        ${currentFilm.combinedFilms.map(f => `<li>${f.title}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        details.innerHTML = `
            <div class="detail-section">
                ${timeInfo}
                ${durationInfo}
                ${unavailableNotice}
                ${!isUnavailable ? (currentFilm.director ? `<div class="detail-item"><strong>Director:</strong> ${currentFilm.director}</div>` : '') : ''}
                ${!isUnavailable ? (currentFilm.country ? `<div class="detail-item"><strong>Country:</strong> ${currentFilm.country}</div>` : '') : ''}
                ${!isUnavailable ? (currentFilm.programme ? `<div class="detail-item"><strong>Programme:</strong> ${currentFilm.programme}</div>` : '') : ''}
                ${currentFilm.location ? `<div class="detail-item"><strong>Location:</strong> ${currentFilm.location}</div>` : ''}
                ${!isUnavailable && currentFilm.hasQA ? `<div class="detail-item"><strong>Q&A:</strong> Yes</div>` : ''}
                ${!isUnavailable ? combinedProgrammeInfo : ''}
                ${!isUnavailable && currentFilm.iffrLink ? `<div class="detail-item"><strong>IFFR Link:</strong> <a href="${currentFilm.iffrLink}" target="_blank" rel="noopener noreferrer" style="color: var(--teal); text-decoration: underline;">${currentFilm.iffrLink}</a></div>` : ''}
                ${!isUnavailable ? screeningSwitcher : ''}
                ${!isUnavailable ? `<div class="detail-item" id="status-section">
                    <div style="margin-bottom: 12px;">
                        <strong>Status:</strong>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        ${statusButtons}
                    </div>
                </div>` : ''}
            </div>
        `;
        
        // Attach status button listeners and disable in shared view
        document.querySelectorAll('#status-section .status-toggle-btn').forEach(btn => {
            // Disable buttons in shared view
            if (this.isSharedView) {
                btn.disabled = true;
                btn.classList.add('disabled');
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            }
            
            btn.addEventListener('click', (e) => {
                // Don't handle clicks on disabled buttons or in shared view
                if (btn.disabled || btn.classList.contains('disabled') || this.isSharedView) {
                    if (this.isSharedView) {
                        alert('Cannot modify films in shared view. This is a read-only schedule.');
                    }
                    return;
                }
                const statusType = e.target.closest('.status-toggle-btn').dataset.status;
                this.toggleFilmStatusTypeInPlace(this.currentDetailFilm, statusType, btn);
            });
        });
        
        // Re-attach unschedule button listener (only for scheduled films, not unavailable time)
        const unscheduleBtn = document.getElementById('unschedule-film-btn');
        if (unscheduleBtn) {
            if (this.isSharedView || isUnavailable) {
                unscheduleBtn.style.display = 'none';
            } else if (isScheduled) {
                unscheduleBtn.style.display = 'block';
                // Remove any existing listeners by cloning and replacing
                const newUnscheduleBtn = unscheduleBtn.cloneNode(true);
                unscheduleBtn.parentNode.replaceChild(newUnscheduleBtn, unscheduleBtn);
                newUnscheduleBtn.addEventListener('click', () => this.unscheduleFilm());
            } else {
                unscheduleBtn.style.display = 'none';
            }
        }
        
        // Re-attach delete button listener (in case modal was recreated)
        const deleteBtn = document.getElementById('delete-film-btn');
        if (deleteBtn) {
            // Hide delete button in shared view
            if (this.isSharedView) {
                deleteBtn.style.display = 'none';
            } else {
                deleteBtn.style.display = 'block';
                // Remove any existing listeners by cloning and replacing
                const newDeleteBtn = deleteBtn.cloneNode(true);
                deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
                newDeleteBtn.addEventListener('click', () => this.deleteFilmFromDetail());
            }
        }
        
        // Position modal - handle unscheduled films differently
        if (!isScheduled) {
            // Center the modal for unscheduled films
            modalContent.style.left = '50%';
            modalContent.style.top = '50%';
            modalContent.style.transform = 'translate(-50%, -50%)';
            modalContent.style.maxHeight = '85vh';
            modalContent.classList.remove('open-left', 'open-right');
        }
        
        // Position modal - Gail's Law: simplest solution - always left side, 2px from calendar edge
        if (isScheduled && filmBlockElement && filmBlockElement !== document.body) {
            const calendar = document.getElementById('calendar');
            const calendarRect = calendar.getBoundingClientRect();
            const panelWidth = 340;
            const gap = 2;
            const padding = 8;
            
            // Always position on left side, 2px from calendar left edge
            const leftPosition = calendarRect.left + gap;
            
            // Position horizontally
            modalContent.style.left = `${leftPosition}px`;
            modalContent.classList.remove('open-left', 'open-right');
            modalContent.classList.add('open-left');
            
            // Position vertically - use visible calendar area
            const visibleTop = Math.max(calendarRect.top, 0) + padding;
            const visibleBottom = Math.min(calendarRect.bottom, window.innerHeight) - padding;
            const maxHeight = visibleBottom - visibleTop;
            
            modalContent.style.top = `${visibleTop}px`;
            modalContent.style.maxHeight = `${maxHeight}px`;
            modalContent.style.transform = '';
        }
        
        // Show it
        modal.style.display = 'block';
        modal.classList.add('open');
        
        // Prevent calendar scrolling
        document.getElementById('calendar').style.overflow = 'hidden';
        
        // On mobile, scroll to ensure the entire modal is visible from top to bottom
        this.scrollModalIntoView();
    }

    scrollModalIntoView() {
        // Wait a bit for the modal to render and position itself
        setTimeout(() => {
            const modal = document.getElementById('film-detail-modal');
            const modalContent = modal?.querySelector('.modal-content');
            
            if (modalContent) {
                const modalRect = modalContent.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                const scrollPadding = 16; // Add some padding from edges
                
                // Check if modal is fully visible
                const modalTop = modalRect.top;
                const modalBottom = modalRect.bottom;
                const isFullyVisible = modalTop >= scrollPadding && modalBottom <= (viewportHeight - scrollPadding);
                
                if (!isFullyVisible) {
                    // Calculate how much we need to scroll
                    let scrollAmount = 0;
                    
                    // If top is cut off, scroll up
                    if (modalTop < scrollPadding) {
                        scrollAmount = modalTop - scrollPadding;
                    }
                    // If bottom is cut off, scroll down
                    else if (modalBottom > (viewportHeight - scrollPadding)) {
                        scrollAmount = modalBottom - (viewportHeight - scrollPadding);
                    }
                    
                    // Scroll the window to make the modal fully visible
                    if (scrollAmount !== 0) {
                        window.scrollBy({
                            top: scrollAmount,
                            behavior: 'smooth'
                        });
                    }
                }
            }
            
            // Also ensure calendar is in view so user can see the timetable (on desktop)
            const isMobile = window.innerWidth <= 768;
            const calendar = document.getElementById('calendar');
            if (calendar && !isMobile) {
                // Use a small delay to let the modal scroll complete first
                setTimeout(() => {
                    const calendarRect = calendar.getBoundingClientRect();
                    const viewportHeight = window.innerHeight;
                    
                    // Only scroll if calendar is not visible at all
                    if (calendarRect.bottom < 0 || calendarRect.top > viewportHeight) {
                        calendar.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'nearest',
                            inline: 'nearest'
                        });
                    }
                }, 300);
            }
        }, 150);
    }

    unscheduleFilm() {
        if (this.isSharedView) {
            alert('Cannot unschedule films in shared view. This is a read-only schedule.');
            return;
        }
        
        if (!this.currentDetailFilm) {
            console.warn('No film selected for unscheduling');
            return;
        }
        
        const film = this.currentDetailFilm;
        
        // Check if film is actually scheduled
        if (!film.startTime || !film.endTime) {
            alert('This film is not scheduled.');
            return;
        }
        
        // Remove scheduling but keep film favorited
        film.startTime = null;
        film.endTime = null;
        film.location = null;
        
        // Ensure film stays favorited
        if (!film.favorited) {
            film.favorited = true;
        }
        
        this.saveFilms();
        
        // Update in Notion if configured
        if (this.notionApiKey && this.notionDatabaseId && this.backendUrl && film.notionPageId) {
            this.updateFilmInNotion(film).catch(err => {
                console.error('Failed to update in Notion:', err);
            });
        }
        
        // Close modal
        this.closeDetailModal();
        
        // Re-render calendar and favorites sidebar
        this.renderCalendar();
        this.renderFavoritesSidebar();
        
        // Show feedback
        this.showUnscheduleFeedback(film.title);
    }

    showUnscheduleFeedback(filmTitle) {
        // Create or update feedback message
        let feedbackEl = document.getElementById('schedule-feedback');
        if (!feedbackEl) {
            feedbackEl = document.createElement('div');
            feedbackEl.id = 'schedule-feedback';
            feedbackEl.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                background: rgba(78, 205, 196, 0.95);
                color: #000;
                padding: 16px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                z-index: 10000;
                font-weight: 500;
                font-size: 14px;
                max-width: 300px;
                animation: slideInRight 0.3s ease-out;
            `;
            document.body.appendChild(feedbackEl);
        }
        
        feedbackEl.textContent = `✅ Unscheduled: ${filmTitle}`;
        feedbackEl.style.display = 'block';
        
        // Hide after 3 seconds
        setTimeout(() => {
            feedbackEl.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                feedbackEl.style.display = 'none';
                feedbackEl.style.animation = '';
            }, 300);
        }, 3000);
    }

    closeDetailModal() {
        const modal = document.getElementById('film-detail-modal');
        const calendarContainer = document.getElementById('calendar');
        modal.style.display = 'none';
        modal.classList.remove('open');
        calendarContainer.style.overflow = ''; // Re-enable scrolling
        
        // Remove active state from all favorite items
        document.querySelectorAll('.favorite-film-item').forEach(item => {
            item.classList.remove('active');
        });
        this.currentDetailFilm = null;
    }


    async deleteFilmFromDetail() {
        if (this.isSharedView) {
            alert('Cannot delete films in shared view. This is a read-only schedule.');
            return;
        }
        
        if (!this.currentDetailFilm) {
            console.warn('No film selected for deletion');
            return;
        }
        
        const film = this.currentDetailFilm;
        console.log('Deleting film:', film.title, film.id);
        
        if (!confirm('Are you sure you want to delete this film?')) {
            return;
        }
        
        try {
            // Delete from Notion if configured and page exists
            if (this.notionApiKey && this.backendUrl && film.notionPageId) {
                try {
                    this.showSyncIndicator('Deleting from Notion...', 'info');
                    console.log('Deleting from Notion, pageId:', film.notionPageId);
                    const response = await fetch(`${this.backendUrl}/api/notion/delete`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            apiKey: this.notionApiKey,
                            pageId: film.notionPageId
                        })
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || `Failed to delete Notion page: ${response.status}`);
                    }

                    this.showSyncIndicator('✓ Deleted from Notion', 'success');
                    console.log('Successfully deleted from Notion');
                    setTimeout(() => this.hideSyncIndicator(), 2000);
                } catch (error) {
                    console.error('Error deleting from Notion:', error);
                    this.showSyncIndicator(`✗ Delete failed: ${error.message}`, 'error');
                    setTimeout(() => this.hideSyncIndicator(), 3000);
                    // Continue with local delete even if Notion delete fails
                }
            } else {
                console.log('Skipping Notion delete - not configured or no pageId');
            }
            
            // Remove from local storage
            const beforeCount = this.films.length;
            this.films = this.films.filter(f => f.id !== film.id);
            const afterCount = this.films.length;
            console.log(`Removed film from array: ${beforeCount} -> ${afterCount}`);
            
            this.saveFilms();
            this.renderCalendar();
            this.closeDetailModal();
            
            console.log('Film deletion complete');
        } catch (error) {
            console.error('Error in deleteFilmFromDetail:', error);
            alert('Error deleting film: ' + error.message);
        }
    }

    positionFilmBlock(block, film, container) {
        const start = new Date(film.startTime);
        const end = new Date(film.endTime);
        
        // Calculate position based on time (assuming 8am-11pm range)
        const dayStart = new Date(start);
        dayStart.setHours(8, 0, 0, 0);
        
        const minutesFromStart = (start - dayStart) / (1000 * 60);
        const duration = (end - start) / (1000 * 60);
        
        // 960px container height for 16 hours (8am-11pm) = 60px per hour
        const top = (minutesFromStart / 60) * 60;
        const height = (duration / 60) * 60;
        
        // Check for overlapping films to position side by side
        const overlappingFilms = this.getOverlappingFilms(film, new Date(film.startTime));
        const overlapIndex = overlappingFilms.findIndex(f => f.id === film.id);
        const totalOverlaps = overlappingFilms.length;
        
        // 1px margin on each side = 2px total space between adjacent blocks
        const marginPerSide = 1;
        
        // Get the actual container width for accurate calculations
        const containerWidth = container.offsetWidth;
        
        if (totalOverlaps > 1) {
            // Position films side by side with 1px spacing
            // Each block gets (100% - total margins) / number of blocks
            const totalMarginSpace = totalOverlaps * 2; // 1px margin on each side of each block
            const blockWidthPercent = (100 - totalMarginSpace) / totalOverlaps;
            const leftPosition = overlapIndex * (blockWidthPercent + 2); // 2 = 1px margin on each side
            
            block.style.width = `calc(${blockWidthPercent}% - ${marginPerSide * 2}px)`;
            block.style.left = `calc(${leftPosition}% + ${overlapIndex * 2}px)`;
            block.style.right = 'auto'; // Ensure right is not set
            
            // Add simplified class if not already added (for styling)
            if (!block.classList.contains('simplified')) {
                block.classList.add('simplified');
            }
        } else {
            // Single film takes full width minus 2px (1px margin on each side)
            block.style.width = `calc(100% - ${marginPerSide * 2}px)`;
            block.style.left = `${marginPerSide}px`;
            block.style.right = 'auto'; // Ensure right is not set
            
            // Remove simplified class if present
            block.classList.remove('simplified');
        }
        
        block.style.top = `${top}px`;
        block.style.height = `${Math.max(height, 80)}px`;
        block.style.position = 'absolute';
    }

    getOverlappingFilms(film, date) {
        return this.films.filter(f => {
            if (f.id === film.id) return true;
            const fDate = new Date(f.startTime);
            const filmDate = new Date(film.startTime);
            
            // Check if same day
            if (fDate.toDateString() !== filmDate.toDateString()) return false;
            
            // Check if times overlap
            const fStart = new Date(f.startTime);
            const fEnd = new Date(f.endTime);
            const filmStart = new Date(film.startTime);
            const filmEnd = new Date(film.endTime);
            
            return (fStart < filmEnd && fEnd > filmStart);
        });
    }

    async handleAddFilm(e) {
        e.preventDefault();
        const link = document.getElementById('iffr-link').value;
        
        if (!link) return;
        
        try {
            const filmData = await this.parseIFFRLink(link);
            this.showScreeningOptions(filmData);
        } catch (error) {
            alert('Error parsing IFFR link: ' + error.message);
        }
    }

    async parseIFFRLink(url) {
        if (!this.backendUrl) {
            throw new Error('Backend server not configured. Please set backendUrl in app.js');
        }

        try {
            const response = await fetch(`${this.backendUrl}/api/iffr/parse`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url: url })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to parse IFFR link');
            }

            const data = await response.json();
            // Ensure the original URL is included in the response
            if (!data.iffrLink && url) {
                data.iffrLink = url;
            }
            return data;
        } catch (error) {
            console.error('IFFR parse error:', error);
            throw error;
        }
    }

    showScreeningOptions(filmData) {
        const results = document.getElementById('parse-results');
        
        // Ensure IFFR link is stored from the input field if not already in filmData
        const linkInput = document.getElementById('iffr-link');
        if (linkInput && linkInput.value && !filmData.iffrLink) {
            filmData.iffrLink = linkInput.value;
        }
        
        // Handle event pages differently - these are programme pages, not individual films
        if (filmData.isEventPage) {
            results.innerHTML = '<h3>Combined Programme Detected</h3>';
            
            const eventNotice = document.createElement('div');
            eventNotice.className = 'combined-programme-notice';
            eventNotice.style.cssText = `
                background: rgba(139, 92, 246, 0.15);
                border: 1px solid var(--purple);
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 16px;
                font-size: 12px;
            `;
            eventNotice.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 8px; color: var(--purple); font-size: 14px;">
                    📽️ Programme: ${filmData.title}
                </div>
                <div style="margin-bottom: 12px; opacity: 0.9;">
                    This is a combined programme containing ${filmData.combinedFilms?.length || 0} film${filmData.combinedFilms?.length !== 1 ? 's' : ''}:
                </div>
                <ul style="margin: 0; padding-left: 20px; opacity: 0.9; line-height: 1.8;">
                    ${(filmData.combinedFilms || []).map(f => `<li>${f.title}</li>`).join('')}
                </ul>
                <div style="margin-top: 12px; font-size: 11px; opacity: 0.7; font-style: italic; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);">
                    Note: To add individual films, use the film page URLs (e.g., /films/xtended-release) instead of the programme page.
                    <br>All films in this programme share the same screening times shown below.
                </div>
            `;
            results.appendChild(eventNotice);
            
            // Show screenings for the programme
            if (filmData.screenings && filmData.screenings.length > 0) {
                const screeningsHeader = document.createElement('h3');
                screeningsHeader.textContent = 'Programme Screenings:';
                screeningsHeader.style.marginTop = '20px';
                results.appendChild(screeningsHeader);
            }
        } else {
            results.innerHTML = '<h3>Select Screening:</h3>';
            
            // Show combined programme notice for individual film pages
            if (filmData.isCombinedProgramme && filmData.combinedFilms && filmData.combinedFilms.length > 0) {
                const combinedNotice = document.createElement('div');
                combinedNotice.className = 'combined-programme-notice';
                combinedNotice.style.cssText = `
                    background: rgba(139, 92, 246, 0.15);
                    border: 1px solid var(--purple);
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 16px;
                    font-size: 12px;
                `;
                combinedNotice.innerHTML = `
                    <div style="font-weight: 600; margin-bottom: 8px; color: var(--purple);">
                        📽️ Combined Programme
                    </div>
                    <div style="margin-bottom: 8px; opacity: 0.9;">
                        This film is part of a combined programme with ${filmData.combinedFilms.length} other film${filmData.combinedFilms.length > 1 ? 's' : ''}:
                    </div>
                    <ul style="margin: 0; padding-left: 20px; opacity: 0.8;">
                        ${filmData.combinedFilms.map(f => `<li>${f.title}</li>`).join('')}
                    </ul>
                    <div style="margin-top: 8px; font-size: 11px; opacity: 0.7; font-style: italic;">
                        All films in this programme share the same screening times.
                    </div>
                `;
                results.appendChild(combinedNotice);
            }
        }
        
        // Store all screenings in filmData for later use
        const allScreenings = filmData.screenings || [];
        
        // Show "Add to Favorites" button if we have screenings
        const addToFavoritesSection = document.getElementById('add-to-favorites-section');
        if (addToFavoritesSection && allScreenings.length > 0) {
            addToFavoritesSection.style.display = 'block';
            // Store filmData for the "Add to Favorites" handler
            this.currentParsedFilmData = filmData;
        } else if (addToFavoritesSection) {
            addToFavoritesSection.style.display = 'none';
        }
        
        allScreenings.forEach((screening, index) => {
            const option = document.createElement('div');
            // Check availability - explicit check: false means unavailable, true/undefined means available
            const isAvailable = screening.available !== false;
            
            // Debug logging
            console.log(`Screening ${index + 1}:`, {
                available: screening.available,
                unavailableReason: screening.unavailableReason,
                isAvailable: isAvailable,
                location: screening.location,
                startTime: screening.startTime
            });
            
            option.className = `screening-option ${!isAvailable ? 'unavailable' : ''}`;
            
            const qaBadge = screening.hasQA ? '<span style="color: #a78bfa; font-size: 0.85em;">• Q&A</span>' : '';
            const unavailableBadge = !isAvailable ? `<span style="color: rgba(255,255,255,0.5); font-size: 0.85em; font-style: italic;">• ${screening.unavailableReason || 'Not Available'}</span>` : '';
            
            const startDate = new Date(screening.startTime);
            const endDate = new Date(screening.endTime);
            const dateStr = this.formatDate(startDate);
            const startTimeStr = this.formatTime(startDate);
            const endTimeStr = this.formatTime(endDate);
            
            option.innerHTML = `
                <strong>${dateStr} | ${startTimeStr} - ${endTimeStr}</strong><br>
                ${screening.location} ${qaBadge} ${unavailableBadge}<br>
                ${this.calculateDuration(screening.startTime, screening.endTime)} minutes
            `;
            
            // Apply unavailable styles
            if (!isAvailable) {
                option.style.cursor = 'not-allowed';
                option.style.opacity = '0.5';
                option.style.backgroundColor = 'rgba(100, 100, 100, 0.2)';
                option.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                option.style.pointerEvents = 'none'; // Prevent all interactions
            }
            
            option.addEventListener('click', () => {
                if (!isAvailable) {
                    console.log('Blocked click on unavailable screening:', screening.unavailableReason);
                    return; // Don't allow clicking on unavailable screenings
                }
                document.querySelectorAll('.screening-option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                
                // Add film with selected screening
                const film = {
                    ...filmData,
                    startTime: screening.startTime,
                    endTime: screening.endTime,
                    location: screening.location,
                    iffrLink: screening.link,
                    hasQA: screening.hasQA || false,
                    id: Date.now() + index,
                    moderating: false,
                    favorited: true, // Auto-favorite films added via IFFR link
                    ticket: false,
                    screenings: allScreenings, // Store all screenings for switching later
                    isCombinedProgramme: filmData.isCombinedProgramme || false,
                    combinedFilms: filmData.combinedFilms || []
                };
                
                this.films.push(film);
                this.saveFilms();
                
                // Create in Notion if configured
                if (this.notionApiKey && this.notionDatabaseId && this.backendUrl) {
                    console.log('Creating film in Notion with screenings:', film.screenings.length, film.screenings);
                    this.createFilmInNotion(film).then(notionId => {
                        if (notionId) {
                            film.notionPageId = notionId;
                            this.saveFilms();
                            console.log('Film created in Notion with pageId:', notionId);
                        } else {
                            console.warn('Failed to create film in Notion - no pageId returned');
                        }
                    }).catch(err => {
                        console.error('Error creating film in Notion:', err);
                    });
                }
                
                // UX: mirror the behavior when scheduling from favorites / switching screenings
                const filmDate = new Date(film.startTime);
                // Navigate calendar so the new screening is visible
                this.navigateToDate(filmDate);
                
                // Close modal so the user can see the calendar update and animation
                this.closeModal();
                
                // Re-render calendar and favorites, then pulse the new block and show feedback
                this.renderCalendar();
                this.addPulseAnimation(film.id);
                this.showScheduleFeedback(film.title, filmDate, false);
                this.renderFavoritesSidebar();
            });
            
            results.appendChild(option);
        });
    }

    handleAddToFavorites() {
        if (!this.currentParsedFilmData) {
            alert('Please parse an IFFR link first');
            return;
        }

        const filmData = this.currentParsedFilmData;
        const allScreenings = filmData.screenings || [];
        
        // Ensure IFFR link is included - get it from input field if not in filmData
        const linkInput = document.getElementById('iffr-link');
        const iffrLink = filmData.iffrLink || (linkInput ? linkInput.value : null);

        // Debug: log what we're storing
        console.log('Adding to favorites:', {
            title: filmData.title,
            iffrLink: iffrLink,
            screeningsCount: allScreenings.length,
            screenings: allScreenings,
            filmDataKeys: Object.keys(filmData)
        });

        // Create film without scheduled time, but with all screenings stored
        const film = {
            ...filmData,
            iffrLink: iffrLink, // Explicitly ensure IFFR link is included
            startTime: null,
            endTime: null,
            location: null,
            id: Date.now().toString(), // Use string ID for consistency
            moderating: false,
            favorited: true,
            ticket: false,
            screenings: allScreenings, // Store all screenings for later scheduling
            isCombinedProgramme: filmData.isCombinedProgramme || false,
            combinedFilms: filmData.combinedFilms || []
        };
        
        // Debug: verify IFFR link is in film object
        console.log('Film object before saving:', {
            title: film.title,
            iffrLink: film.iffrLink,
            hasIffrLink: !!film.iffrLink
        });

        // Ensure screenings is an array
        if (!Array.isArray(film.screenings)) {
            film.screenings = [];
        }

        this.films.push(film);
        this.saveFilms();

        // Create in Notion if configured (without start/end times)
        if (this.notionApiKey && this.notionDatabaseId && this.backendUrl) {
            console.log('Creating film in Notion:', {
                title: film.title,
                iffrLink: film.iffrLink,
                screeningsCount: film.screenings.length,
                hasIffrLink: !!film.iffrLink
            });
            this.createFilmInNotion(film).then(notionId => {
                if (notionId) {
                    film.notionPageId = notionId;
                    this.saveFilms();
                    console.log('Film created in Notion with pageId:', notionId);
                } else {
                    console.warn('Failed to create film in Notion - no pageId returned');
                }
            }).catch(err => {
                console.error('Error creating film in Notion:', err);
            });
        } else {
            console.log('Notion not configured, skipping Notion save');
        }

        this.renderFavoritesSidebar();
        this.closeModal();
        
        // Show success message
        this.showSyncIndicator('✓ Added to favorites', 'success');
        setTimeout(() => this.hideSyncIndicator(), 2000);
    }

    scheduleFilmFromFavorites(filmId) {
        // Prevent scheduling in shared view
        if (this.isSharedView) {
            alert('Cannot schedule films in shared view. This is a read-only schedule.');
            return;
        }
        
        // Handle both string and number IDs
        const film = this.films.find(f => String(f.id) === String(filmId));
        if (!film) {
            console.error('Film not found:', filmId);
            alert('Film not found');
            return;
        }
        
        // Check if screenings exist
        if (!film.screenings || !Array.isArray(film.screenings) || film.screenings.length === 0) {
            console.log('Film screenings:', film.screenings, 'Film:', film);
            
            // If we have an IFFR link, offer to re-parse it to get screenings
            if (film.iffrLink) {
                const shouldReparse = confirm('No screenings found. Would you like to re-parse the IFFR link to get screening times?\n\n(This happens if the "Screenings" property is missing from your Notion database. You can add it as a Text property.)');
                if (shouldReparse) {
                    // Re-parse the IFFR link
                    this.parseIFFRLink(film.iffrLink).then(filmData => {
                        // Update the existing film with new screenings
                        film.screenings = filmData.screenings || [];
                        this.saveFilms();
                        
                        // Update in Notion if configured
                        if (this.notionApiKey && this.notionDatabaseId && this.backendUrl && film.notionPageId) {
                            this.updateFilmInNotion(film).catch(err => {
                                console.error('Failed to update screenings in Notion:', err);
                            });
                        }
                        
                        // Re-render sidebar and try scheduling again
                        this.renderFavoritesSidebar();
                        // Recursively call this function now that screenings are loaded
                        setTimeout(() => this.scheduleFilmFromFavorites(filmId), 100);
                    }).catch(err => {
                        alert('Failed to re-parse IFFR link: ' + err.message);
                    });
                    return;
                }
            }
            
            alert('No screenings available for this film. Please re-add the film from an IFFR link to get screening information.');
            return;
        }

        // Show screening selection modal
        const modal = document.getElementById('film-modal');
        const results = document.getElementById('parse-results');
        const iffrmode = document.getElementById('iffr-mode');
        const manualmode = document.getElementById('manual-mode');
        
        document.getElementById('modal-title').textContent = `Schedule: ${film.title}`;
        iffrmode.style.display = 'block';
        manualmode.style.display = 'none';
        document.getElementById('iffr-link').value = film.iffrLink || '';
        
        results.innerHTML = '<h3>Select Screening:</h3>';
        
        film.screenings.forEach((screening, index) => {
            const option = document.createElement('div');
            const isAvailable = screening.available !== false; // Default to true if not set
            option.className = `screening-option ${!isAvailable ? 'unavailable' : ''}`;
            
            const qaBadge = screening.hasQA ? '<span style="color: #a78bfa; font-size: 0.85em;">• Q&A</span>' : '';
            const unavailableBadge = !isAvailable ? `<span style="color: rgba(255,255,255,0.5); font-size: 0.85em; font-style: italic;">• ${screening.unavailableReason || 'Not Available'}</span>` : '';
            
            const startDate = new Date(screening.startTime);
            const endDate = new Date(screening.endTime);
            const dateStr = this.formatDate(startDate);
            const startTimeStr = this.formatTime(startDate);
            const endTimeStr = this.formatTime(endDate);
            
            option.innerHTML = `
                <strong>${dateStr} | ${startTimeStr} - ${endTimeStr}</strong><br>
                ${screening.location} ${qaBadge} ${unavailableBadge}<br>
                ${this.calculateDuration(screening.startTime, screening.endTime)} minutes
            `;
            
            if (!isAvailable) {
                option.style.cursor = 'not-allowed';
                option.style.opacity = '0.5';
            }
            
            option.addEventListener('click', () => {
                if (!isAvailable) {
                    return; // Don't allow clicking on unavailable screenings
                }
                // Update existing film with selected screening
                film.startTime = screening.startTime;
                film.endTime = screening.endTime;
                film.location = screening.location;
                film.iffrLink = screening.link;
                film.hasQA = screening.hasQA || false;
                
                this.saveFilms();
                
                // Update in Notion if configured
                if (this.notionApiKey && this.notionDatabaseId && this.backendUrl && film.notionPageId) {
                    this.updateFilmInNotion(film).catch(err => {
                        console.error('Failed to update in Notion:', err);
                    });
                }
                
                // Navigate calendar to show the scheduled film
                const filmDate = new Date(film.startTime);
                this.navigateToDate(filmDate);
                
                // Close modal first so user can see the calendar
                this.closeModal();
                
                // Render calendar and add pulse animation
                this.renderCalendar();
                this.addPulseAnimation(film.id);
                
                // Show feedback - explicitly set isSwitching to false for first-time scheduling
                this.showScheduleFeedback(film.title, filmDate, false);
                
                this.renderFavoritesSidebar();
            });
            
            results.appendChild(option);
        });
        
        modal.style.display = 'block';
    }

    async showFilmDetailFromFavorites(filmId) {
        // Handle both string and number IDs
        let film = this.films.find(f => String(f.id) === String(filmId));
        if (!film) {
            console.error('Film not found:', filmId, 'Available films:', this.films.map(f => f.id));
            return;
        }
        
        // If film has no screenings but has an IFFR link, try to re-parse it automatically
        const hasScreenings = film.screenings && Array.isArray(film.screenings) && film.screenings.length > 0;
        if (!hasScreenings && film.iffrLink) {
            console.log('Film has IFFR link but no screenings, attempting to re-parse...', film.title);
            try {
                const filmData = await this.parseIFFRLink(film.iffrLink);
                // Update the existing film with new screenings
                film.screenings = filmData.screenings || [];
                film.director = film.director || filmData.director;
                film.country = film.country || filmData.country;
                film.programme = film.programme || filmData.programme;
                film.isCombinedProgramme = film.isCombinedProgramme || filmData.isCombinedProgramme;
                film.combinedFilms = film.combinedFilms || filmData.combinedFilms;
                // Ensure IFFR link is preserved
                film.iffrLink = film.iffrLink || filmData.iffrLink;
                
                // Save updated film
                this.saveFilms();
                
                // Update in Notion if configured
                if (this.notionApiKey && this.notionDatabaseId && this.backendUrl && film.notionPageId) {
                    this.updateFilmInNotion(film).catch(err => {
                        console.error('Failed to update screenings in Notion:', err);
                    });
                }
                
                // Re-render sidebar to show updated screening count
                this.renderFavoritesSidebar();
                
                console.log('Successfully re-parsed IFFR link, found', film.screenings.length, 'screenings');
            } catch (err) {
                console.error('Failed to re-parse IFFR link:', err);
                // Continue to show detail anyway, user can see the error
            }
        }
        
        // Create a temporary element to position the detail modal
        const favoritesItem = document.querySelector(`[data-film-id="${filmId}"]`);
        if (favoritesItem) {
            this.showFilmDetail(film, favoritesItem);
        } else {
            // Fallback: show in center
            this.showFilmDetail(film, document.body);
        }
        
        // On mobile, scroll to ensure the entire modal is visible from top to bottom
        this.scrollModalIntoView();
    }

    async switchFilmScreening(filmId, screeningIndex) {
        // Prevent switching screenings in shared view
        if (this.isSharedView) {
            alert('Cannot change screenings in shared view. This is a read-only schedule.');
            return;
        }
        
        const film = this.films.find(f => String(f.id) === String(filmId));
        if (!film) {
            console.error('Film not found');
            return;
        }

        // Re-parse IFFR link to get updated screening information (availability, sold out status, etc.)
        if (film.iffrLink) {
            try {
                const filmData = await this.parseIFFRLink(film.iffrLink);
                // Update screenings with fresh data
                film.screenings = filmData.screenings || film.screenings;
                // Also update other film data that might have changed
                if (filmData.director && !film.director) {
                    film.director = filmData.director;
                }
                if (filmData.country && !film.country) {
                    film.country = filmData.country;
                }
                if (filmData.programme && !film.programme) {
                    film.programme = filmData.programme;
                }
                this.saveFilms();
            } catch (error) {
                console.error('Failed to re-parse IFFR link:', error);
                // Continue with existing screenings if re-parsing fails
            }
        }

        // Check if screening still exists after re-parsing
        if (!film.screenings || !film.screenings[screeningIndex]) {
            alert('This screening is no longer available. Please select a different screening.');
            // Re-render the detail modal to show updated screenings
            this.showFilmDetail(film);
            return;
        }

        const screening = film.screenings[screeningIndex];
        
        // Check if screening is available
        if (screening.available === false) {
            alert(`This screening is not available: ${screening.unavailableReason || 'Not Available'}`);
            return;
        }
        
        // Update film with new screening
        film.startTime = screening.startTime;
        film.endTime = screening.endTime;
        film.location = screening.location;
        film.iffrLink = screening.link || film.iffrLink;
        film.hasQA = screening.hasQA || false;
        
        this.saveFilms();
        
        // Update in Notion if configured
        if (this.notionApiKey && this.notionDatabaseId && this.backendUrl && film.notionPageId) {
            this.updateFilmInNotion(film).catch(err => {
                console.error('Failed to update in Notion:', err);
            });
        }
        
        // Navigate calendar to show the new screening date
        const filmDate = new Date(film.startTime);
        this.navigateToDate(filmDate);
        
        // Close detail modal so user can see the calendar animation
        this.closeDetailModal();
        
        // Render calendar and add pulse animation
        this.renderCalendar();
        this.addPulseAnimation(film.id);
        
        // Show feedback
        this.showScheduleFeedback(film.title, filmDate, true);
    }

    navigateToDate(targetDate) {
        // Calculate which day range should be shown to include the target date
        const festivalStart = new Date('2026-01-29');
        const festivalEnd = new Date('2026-02-08');
        
        // Ensure target date is within festival range
        if (targetDate < festivalStart) {
            targetDate = festivalStart;
        } else if (targetDate > festivalEnd) {
            targetDate = festivalEnd;
        }
        
        // Calculate the start date for the view that includes the target date
        // We want to show the target date within our current view range
        const targetDayOfYear = Math.floor((targetDate - festivalStart) / (1000 * 60 * 60 * 24));
        const viewStartDay = Math.max(0, targetDayOfYear - Math.floor(this.daysToShow / 2));
        const newStartDate = new Date(festivalStart);
        newStartDate.setDate(newStartDate.getDate() + viewStartDay);
        
        // Ensure we don't go past the festival end
        const viewEndDate = new Date(newStartDate);
        viewEndDate.setDate(viewEndDate.getDate() + this.daysToShow - 1);
        if (viewEndDate > festivalEnd) {
            const daysOver = Math.ceil((viewEndDate - festivalEnd) / (1000 * 60 * 60 * 24));
            newStartDate.setDate(newStartDate.getDate() - daysOver);
        }
        
        // Update current start date and save
        this.currentStartDate = newStartDate;
        localStorage.setItem('iffrCurrentStartDate', newStartDate.toISOString());
    }

    addPulseAnimation(filmId) {
        // Wait for calendar to render, then add pulse animation
        setTimeout(() => {
            const filmBlock = document.querySelector(`[data-film-id="${filmId}"]`);
            if (filmBlock) {
                filmBlock.classList.add('pulse-animation');
                // Remove animation class after animation completes
                setTimeout(() => {
                    filmBlock.classList.remove('pulse-animation');
                }, 2000); // Animation duration
            }
        }, 100);
    }

    showScheduleFeedback(filmTitle, filmDate, isSwitching = false) {
        // Create or update feedback message
        let feedbackEl = document.getElementById('schedule-feedback');
        if (!feedbackEl) {
            feedbackEl = document.createElement('div');
            feedbackEl.id = 'schedule-feedback';
            feedbackEl.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                background: rgba(78, 205, 196, 0.95);
                color: #000;
                padding: 16px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                z-index: 10000;
                font-weight: 500;
                font-size: 14px;
                max-width: 300px;
                animation: slideInRight 0.3s ease-out;
            `;
            document.body.appendChild(feedbackEl);
        }
        
        const dateStr = this.formatDate(filmDate);
        const message = isSwitching 
            ? `✅ Switched to ${dateStr}`
            : `✅ Scheduled: ${filmTitle}`;
        
        feedbackEl.textContent = message;
        feedbackEl.style.display = 'block';
        
        // Hide after 3 seconds
        setTimeout(() => {
            feedbackEl.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                feedbackEl.style.display = 'none';
                feedbackEl.style.animation = '';
            }, 300);
        }, 3000);
    }

    async updateFilmInNotion(film) {
        if (!this.backendUrl || !this.notionApiKey || !film.notionPageId) {
            return;
        }

        try {
            const updates = {
                'Title': film.title
            };

            // Only update start/end time if they exist (null means unscheduled)
            if (film.startTime) {
                updates['Start Time'] = film.startTime;
            } else {
                // If startTime is explicitly null, we might want to clear it
                // But Notion doesn't support clearing date fields easily, so we'll skip it
            }
            if (film.endTime) {
                updates['End Time'] = film.endTime;
            }
            if (film.location) {
                updates['Location'] = film.location;
            }
            if (film.director) {
                updates['Director'] = film.director;
            }
            if (film.country) {
                updates['Country'] = film.country;
            }
            if (film.programme) {
                updates['Programme'] = film.programme;
            }
            if (film.iffrLink) {
                updates['IFFR Link'] = film.iffrLink;
            }
            
            updates['Favorited'] = film.favorited || false;
            updates['Ticket'] = film.ticket || false;
            updates['Moderating'] = film.moderating || false;
            // Explicitly handle unavailable - ensure boolean value
            updates['Unavailable'] = film.unavailable === true || film.unavailable === 'true';
            
            // Store screenings as JSON string if available
            if (film.screenings && film.screenings.length > 0) {
                updates['Screenings'] = JSON.stringify(film.screenings);
            }
            
            // Store combined programme data if available
            if (film.isCombinedProgramme && film.combinedFilms && film.combinedFilms.length > 0) {
                updates['Combined Programme'] = JSON.stringify({
                    isCombinedProgramme: true,
                    combinedFilms: film.combinedFilms
                });
            }

            const response = await fetch(`${this.backendUrl}/api/notion/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pageId: film.notionPageId,
                    apiKey: this.notionApiKey,
                    updates: updates
                })
            });

            if (!response.ok) {
                throw new Error(`Notion API error: ${response.status}`);
            }
        } catch (error) {
            console.error('Error updating film in Notion:', error);
            throw error;
        }
    }

    toggleFilmStatus(film) {
        // Toggle individual statuses - allow multiple
        // For now, just toggle favorited as the default action
        // In detail view, user can toggle specific statuses
        film.favorited = !film.favorited;
        
        this.saveFilms();
        this.renderCalendar();
    }
    
    toggleFilmStatusTypeInPlace(film, statusType, buttonElement) {
        // Prevent editing in shared view
        if (this.isSharedView) {
            alert('Cannot modify films in shared view. This is a read-only schedule.');
            return;
        }
        
        // Toggle a specific status type
        if (statusType === 'favorited') {
            film.favorited = !film.favorited;
        } else if (statusType === 'ticket') {
            film.ticket = !film.ticket;
        } else if (statusType === 'moderating') {
            film.moderating = !film.moderating;
        }
        
        // Update button appearance in place
        const isActive = film[statusType];
        buttonElement.classList.toggle('active', isActive);
        
        // Update button content with/without checkmark
        const statuses = {
            'favorited': { icon: '❤️', label: 'Favorited' },
            'ticket': { icon: '🎫', label: 'Ticket' },
            'moderating': { icon: 'M', label: 'Moderating' }
        };
        const statusInfo = statuses[statusType];
        const iconSpan = buttonElement.querySelector('.status-btn-icon');
        const labelSpan = buttonElement.querySelector('.status-btn-label');
        if (iconSpan) iconSpan.textContent = statusInfo.icon;
        if (labelSpan) labelSpan.textContent = `${statusInfo.label}${isActive ? ' ✓' : ''}`;
        
        // Save films
        this.saveFilms();
        
        // Sync status change to Notion if configured
        if (this.notionApiKey && this.notionDatabaseId && this.backendUrl && film.notionPageId) {
            this.syncStatusToNotion(film, statusType).catch(err => {
                console.error('Failed to sync status to Notion:', err);
            });
        }
        
        // Update the film block in the calendar in place (update classes and content)
        const filmBlock = document.querySelector(`[data-film-id="${film.id}"]`);
        if (filmBlock) {
            // Update status classes
            filmBlock.classList.remove('ticket', 'favorited', 'moderating', 'default', 'unavailable');
            
            // Determine status class - priority: unavailable > moderating > ticket > favorited
            // Ticket color shows when ticket is checked, except if moderating is also checked
            if (film.unavailable) {
                filmBlock.classList.add('unavailable');
            } else if (film.moderating) {
                filmBlock.classList.add('moderating');
            } else if (film.ticket) {
                filmBlock.classList.add('ticket');
            } else if (film.favorited) {
                filmBlock.classList.add('favorited');
            } else {
                filmBlock.classList.add('default');
            }
            
            // Update status icons
            const statusIcons = [];
            if (film.favorited) {
                statusIcons.push('<span class="status-icon" title="Favorited">❤️</span>');
            }
            if (film.ticket) {
                statusIcons.push('<span class="status-icon" title="Ticket">🎫</span>');
            }
            if (film.moderating) {
                statusIcons.push('<span class="status-icon" title="Moderating">M</span>');
            }
            
            const startTime = this.formatTime(new Date(film.startTime));
            const endTime = this.formatTime(new Date(film.endTime));
            const duration = this.calculateDuration(film.startTime, film.endTime);
            const durationText = `${duration} min`;
            const locationShortcode = this.getLocationShortcode(film.location);
            
            // Update film block content
            const timeEl = filmBlock.querySelector('.film-time');
            const titleEl = filmBlock.querySelector('.film-title');
            const extraInfoEl = filmBlock.querySelector('.film-extra-info');
            const statusIconsEl = filmBlock.querySelector('.film-status-icons');
            
            if (timeEl) timeEl.textContent = `${startTime} → ${endTime}`;
            if (titleEl) titleEl.textContent = film.title;
            if (extraInfoEl) {
                extraInfoEl.innerHTML = `
                    ${durationText}
                    ${locationShortcode ? ` • ${locationShortcode}` : ''}
                    ${film.programme ? ` • ${film.programme}` : ''}
                `;
            }
            if (statusIconsEl) {
                statusIconsEl.innerHTML = statusIcons.join('');
            }
        }
    }
    
    toggleFilmStatusType(film, statusType) {
        // Toggle a specific status type
        if (statusType === 'favorited') {
            film.favorited = !film.favorited;
        } else if (statusType === 'ticket') {
            film.ticket = !film.ticket;
        } else if (statusType === 'moderating') {
            film.moderating = !film.moderating;
        }
        
        this.saveFilms();
        this.renderCalendar();
        if (this.currentDetailFilm && this.currentDetailFilm.id === film.id) {
            this.showFilmDetail(film, document.querySelector(`[data-film-id="${film.id}"]`));
        }
    }

    openModal(mode = 'iffr') {
        document.getElementById('film-modal').style.display = 'block';
        
        if (mode === 'iffr') {
            document.getElementById('iffr-mode').style.display = 'block';
            document.getElementById('manual-mode').style.display = 'none';
            document.getElementById('modal-title').textContent = 'Add Film from IFFR Link';
            document.getElementById('iffr-link').value = '';
            document.getElementById('parse-results').innerHTML = '';
            // Hide "Add to Favorites" button initially
            const addToFavoritesSection = document.getElementById('add-to-favorites-section');
            if (addToFavoritesSection) {
                addToFavoritesSection.style.display = 'none';
            }
            this.currentParsedFilmData = null;
        } else {
            document.getElementById('iffr-mode').style.display = 'none';
            document.getElementById('manual-mode').style.display = 'block';
            document.getElementById('modal-title').textContent = 'Add Film Manually';
            // Set default date to first day of current view
            const defaultDate = this.currentStartDate.toISOString().slice(0, 10);
            document.getElementById('manual-date').value = defaultDate;
            document.getElementById('manual-start-time').value = '08:00';
            document.getElementById('manual-end-time').value = '10:00';
            document.getElementById('manual-room').value = '';
            // Reset status checkboxes
            document.getElementById('manual-favorited').checked = false;
            document.getElementById('manual-ticket').checked = false;
            document.getElementById('manual-moderating').checked = false;
            document.getElementById('manual-unavailable').checked = false;
            document.getElementById('manual-title').value = '';
            // Reset unavailable state
            this.handleUnavailableToggle({ target: { checked: false } });
        }
    }
    
    handleUnavailableToggle(e) {
        const isUnavailable = e.target.checked;
        const titleInput = document.getElementById('manual-title');
        const disabledFields = document.querySelectorAll('.unavailable-disabled input, .unavailable-disabled select');
        const disabledLabels = document.querySelectorAll('.unavailable-disabled');
        
        if (isUnavailable) {
            // Auto-fill title
            titleInput.value = 'Unavailable for IFFR';
            // Disable and grey out irrelevant fields
            disabledFields.forEach(field => {
                field.disabled = true;
                field.style.opacity = '0.4';
                field.style.cursor = 'not-allowed';
            });
            disabledLabels.forEach(label => {
                label.style.opacity = '0.4';
            });
        } else {
            // Clear title if it's the default unavailable title
            if (titleInput.value === 'Unavailable for IFFR') {
                titleInput.value = '';
            }
            // Re-enable fields
            disabledFields.forEach(field => {
                field.disabled = false;
                field.style.opacity = '1';
                field.style.cursor = '';
            });
            disabledLabels.forEach(label => {
                label.style.opacity = '1';
            });
        }
    }

    handleManualAddFilm(e) {
        e.preventDefault();
        
        const date = document.getElementById('manual-date').value;
        const startTime = document.getElementById('manual-start-time').value;
        const endTime = document.getElementById('manual-end-time').value;
        const location = document.getElementById('manual-location').value;
        const room = document.getElementById('manual-room').value;
        
        // Combine date and time
        const startDateTime = new Date(`${date}T${startTime}`);
        const endDateTime = new Date(`${date}T${endTime}`);
        
        // If end time is before start time, assume it's next day (for late night screenings)
        if (endDateTime < startDateTime) {
            endDateTime.setDate(endDateTime.getDate() + 1);
        }
        
        const fullLocation = room ? `${location} ${room}` : location;
        
        const isUnavailable = document.getElementById('manual-unavailable').checked;
        const title = document.getElementById('manual-title').value || (isUnavailable ? 'Unavailable for IFFR' : '');
        
        const film = {
            id: Date.now(),
            title: title,
            director: document.getElementById('manual-director').value,
            country: document.getElementById('manual-country').value,
            programme: document.getElementById('manual-programme').value,
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            location: fullLocation,
            iffrLink: document.getElementById('manual-link').value,
            moderating: document.getElementById('manual-moderating').checked,
            favorited: document.getElementById('manual-favorited').checked,
            ticket: document.getElementById('manual-ticket').checked,
            unavailable: isUnavailable
        };
        
        this.films.push(film);
        this.saveFilms();
        
        // Create in Notion if configured
        if (this.notionApiKey && this.notionDatabaseId && this.backendUrl) {
            this.createFilmInNotion(film).then(notionId => {
                if (notionId) {
                    film.notionPageId = notionId;
                    this.saveFilms();
                }
            }).catch(err => {
                console.error('Error creating film in Notion:', err);
            });
        }
        
        this.renderCalendar();
        this.closeModal();
    }

    closeModal() {
        document.getElementById('film-modal').style.display = 'none';
    }

    openSettingsModal() {
        const modal = document.getElementById('settings-modal');
        const userNameInput = document.getElementById('user-name');
        const apiKeyInput = document.getElementById('notion-api-key');
        const dbIdInput = document.getElementById('notion-database-id');
        const backendUrlInput = document.getElementById('backend-url');
        
        // Pre-fill with saved values
        if (userNameInput) {
            userNameInput.value = this.userName || '';
        }
        if (this.notionApiKey) {
            apiKeyInput.value = this.notionApiKey;
        }
        if (this.notionDatabaseId) {
            dbIdInput.value = this.notionDatabaseId;
        }
        if (this.backendUrl) {
            backendUrlInput.value = this.backendUrl;
        }
        
        modal.style.display = 'block';
    }

    closeSettingsModal() {
        document.getElementById('settings-modal').style.display = 'none';
    }

    handleSettingsSave(e) {
        e.preventDefault();
        const userName = document.getElementById('user-name').value.trim();
        const apiKey = document.getElementById('notion-api-key').value.trim();
        const dbId = document.getElementById('notion-database-id').value.trim();
        const backendUrl = document.getElementById('backend-url').value.trim();
        
        // Save user name
        if (userName) {
            localStorage.setItem('userName', userName);
            this.userName = userName;
        } else {
            localStorage.removeItem('userName');
            this.userName = '';
        }
        this.updateHeaderTitle();
        
        // Note: API key and Database ID are optional (only required for Notion sync)
        // If provided, validate and save them
        if (apiKey || dbId) {
            if (!apiKey || !dbId) {
                this.showNotionStatus('Please enter both API key and Database ID, or leave both empty', 'error');
                return;
            }
        }
        
        // Save to localStorage
        localStorage.setItem('notionApiKey', apiKey);
        localStorage.setItem('notionDatabaseId', dbId);
        if (backendUrl) {
            localStorage.setItem('backendUrl', backendUrl);
            this.backendUrl = backendUrl;
        } else {
            // If empty, remove saved backend URL and use auto-detect
            localStorage.removeItem('backendUrl');
            // Recalculate auto-detect URL
            const hostname = window.location.hostname;
            const protocol = window.location.protocol;
            const isLocal = window.location.protocol === 'file:' || 
                           hostname === 'localhost' || 
                           hostname === '127.0.0.1' ||
                           hostname === '' ||
                           hostname.startsWith('192.168.') ||
                           hostname.startsWith('10.') ||
                           hostname.startsWith('172.');
            const isTunnel = hostname.includes('trycloudflare.com') || hostname.includes('ngrok.io') || hostname.includes('localtunnel.me');
            const port = '3001';
            if (isTunnel || (protocol === 'https:' && !isLocal)) {
                this.backendUrl = `${protocol}//${hostname}`;
            } else {
                this.backendUrl = isLocal ? `http://${hostname || 'localhost'}:${port}` : '';
            }
        }
        
        // Update instance variables
        this.notionApiKey = apiKey;
        this.notionDatabaseId = dbId;
        
        // Try to load from Notion (only if API key and DB ID are provided)
        if (apiKey && dbId) {
            this.showNotionStatus('Saving settings...', 'info');
            this.loadFilmsFromNotion().then(() => {
                this.showNotionStatus('Settings saved! Films loaded from Notion.', 'success');
            }).catch(() => {
                this.showNotionStatus('Settings saved, but failed to load from Notion. Check your credentials.', 'error');
            });
        } else {
            this.showNotionStatus('Settings saved!', 'success');
        }
    }

    updateHeaderTitle() {
        const headerTitle = document.querySelector('header h1');
        const subtitle = document.getElementById('user-schedule-subtitle');
        
        // Always keep the main title as "Unofficial Film Planner"
        if (headerTitle) {
            headerTitle.textContent = 'Unofficial Film Planner';
        }
        
        // Show/hide and update subtitle based on user name
        if (subtitle) {
            if (this.isSharedView) {
                subtitle.textContent = `📤 ${this.sharedUserName}'s Schedule (Shared)`;
                subtitle.style.display = 'block';
            } else if (this.userName) {
                subtitle.textContent = `${this.userName}'s Schedule`;
                subtitle.style.display = 'block';
            } else {
                subtitle.style.display = 'none';
            }
        }
    }

    async testNotionConnection() {
        const apiKey = document.getElementById('notion-api-key').value.trim();
        const dbId = document.getElementById('notion-database-id').value.trim();
        
        if (!apiKey || !dbId) {
            this.showNotionStatus('Please enter both API key and Database ID', 'error');
            return;
        }
        
        this.showNotionStatus('Testing connection...', 'info');
        
        // Check if backend is configured
        if (!this.backendUrl) {
            this.showNotionStatus(
                '❌ Backend server not configured. Please set backendUrl in app.js to your server URL.',
                'error'
            );
            return;
        }

        try {
            // Call our backend server which proxies to Notion API
            const response = await fetch(`${this.backendUrl}/api/notion/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    databaseId: dbId,
                    apiKey: apiKey
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Connection failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
            }
            
            const data = await response.json();
            this.showNotionStatus(`✅ Connection successful! Database: "${data.title[0]?.plain_text || 'Unknown'}"`, 'success');
        } catch (error) {
            // Check if it's a connection error
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                this.showNotionStatus(
                    `❌ Cannot connect to backend server at ${this.backendUrl}. Make sure the server is running.`,
                    'error'
                );
            } else {
                this.showNotionStatus(`❌ Connection failed: ${error.message}`, 'error');
            }
        }
    }

    showNotionStatus(message, type) {
        const statusEl = document.getElementById('notion-status');
        if (!statusEl) return;
        
        statusEl.style.display = 'block';
        statusEl.textContent = message;
        
        // Set background color based on type
        if (type === 'success') {
            statusEl.style.background = 'rgba(78, 205, 196, 0.2)';
            statusEl.style.border = '1px solid var(--teal)';
            statusEl.style.color = 'var(--teal)';
        } else if (type === 'error') {
            statusEl.style.background = 'rgba(231, 76, 60, 0.2)';
            statusEl.style.border = '1px solid var(--red)';
            statusEl.style.color = 'var(--red)';
        } else {
            statusEl.style.background = 'rgba(255, 255, 255, 0.1)';
            statusEl.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            statusEl.style.color = '#E0E0E0';
        }
    }

    async syncStatusToNotion(film, statusType) {
        if (!this.backendUrl || !this.notionApiKey || !film.notionPageId) {
            return;
        }

        // Show sync indicator
        this.showSyncIndicator('Syncing to Notion...');

        try {
            const updates = {};
            updates[statusType] = film[statusType];

            const startTime = Date.now();
            const response = await fetch(`${this.backendUrl}/api/notion/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pageId: film.notionPageId,
                    apiKey: this.notionApiKey,
                    updates: updates
                })
            });

            const duration = Date.now() - startTime;

            if (!response.ok) {
                throw new Error(`Notion API error: ${response.status}`);
            }

            // Show success indicator
            this.showSyncIndicator(`✓ Synced to Notion (${duration}ms)`, 'success');
            setTimeout(() => this.hideSyncIndicator(), 2000);
        } catch (error) {
            console.error('Error syncing to Notion:', error);
            this.showSyncIndicator('✗ Sync failed - check console', 'error');
            setTimeout(() => this.hideSyncIndicator(), 3000);
        }
    }

    async createFilmInNotion(film) {
        if (!this.backendUrl || !this.notionApiKey || !this.notionDatabaseId) {
            return null;
        }

        try {
            const response = await fetch(`${this.backendUrl}/api/notion/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    databaseId: this.notionDatabaseId,
                    apiKey: this.notionApiKey,
                    film: film
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create in Notion');
            }

            const data = await response.json();
            // Update film with Notion page ID
            film.notionPageId = data.id;
            return data.id;
        } catch (error) {
            console.error('Error creating film in Notion:', error);
            return null;
        }
    }

    showSyncIndicator(message, type = 'info') {
        let indicator = document.getElementById('notion-sync-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'notion-sync-indicator';
            indicator.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 8px;
                font-size: 13px;
                font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Courier New', monospace;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                transition: opacity 0.3s;
            `;
            document.body.appendChild(indicator);
        }

        if (type === 'success') {
            indicator.style.background = 'rgba(78, 205, 196, 0.9)';
            indicator.style.border = '1px solid var(--teal)';
            indicator.style.color = '#FFFFFF';
        } else if (type === 'error') {
            indicator.style.background = 'rgba(231, 76, 60, 0.9)';
            indicator.style.border = '1px solid var(--red)';
            indicator.style.color = '#FFFFFF';
        } else {
            indicator.style.background = 'rgba(139, 92, 246, 0.9)';
            indicator.style.border = '1px solid var(--purple)';
            indicator.style.color = '#FFFFFF';
        }

        indicator.textContent = message;
        indicator.style.display = 'block';
        indicator.style.opacity = '1';
    }

    hideSyncIndicator() {
        const indicator = document.getElementById('notion-sync-indicator');
        if (indicator) {
            indicator.style.opacity = '0';
            setTimeout(() => {
                if (indicator) indicator.style.display = 'none';
            }, 300);
        }
    }

    // Utility functions
    formatDate(date) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    formatDateKey(date) {
        return date.toISOString().split('T')[0];
    }

    formatTime(date) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false });
    }

    formatDateTime(date) {
        return date.toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: false // Use 24-hour format
        });
    }

    getDayName(date) {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    }

    calculateDuration(start, end) {
        return Math.round((new Date(end) - new Date(start)) / (1000 * 60));
    }

    // Share schedule functionality
    async checkForSharedSchedule() {
        const urlParams = new URLSearchParams(window.location.search);
        const shareId = urlParams.get('shareId');
        const sharedData = urlParams.get('share');
        
        // First check for dynamic share (shareId) - always shows latest version
        if (shareId) {
            try {
                const response = await fetch(`${this.backendUrl || window.location.origin}/api/share/${shareId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.films && Array.isArray(data.films)) {
                        this.isSharedView = true;
                        this.sharedUserName = data.userName || 'Shared';
                        this.userName = data.userName || '';
                        this.films = data.films;
                        
                        // Disable editing in shared view
                        this.disableEditingInSharedView();
                        
                        // Update header to show it's a shared schedule
                        this.updateHeaderTitle();
                        
                        // Render the shared schedule
                        this.renderCalendar();
                        this.renderFavoritesSidebar();
                        
                        console.log(`Loaded shared schedule from ${this.sharedUserName} (dynamic)`);
                        return;
                    }
                } else {
                    console.error('Failed to load shared schedule:', response.status);
                }
            } catch (error) {
                console.error('Error loading shared schedule from server:', error);
                // Fall through to try static share
            }
        }
        
        // Fallback to static share (URL-encoded data)
        if (sharedData) {
            try {
                const decoded = this.decodeScheduleData(sharedData);
                if (decoded && decoded.films && Array.isArray(decoded.films)) {
                    this.isSharedView = true;
                    this.sharedUserName = decoded.userName || 'Shared';
                    this.userName = decoded.userName || '';
                    this.films = decoded.films;
                    
                    // Disable editing in shared view
                    this.disableEditingInSharedView();
                    
                    // Update header to show it's a shared schedule
                    this.updateHeaderTitle();
                    
                    // Render the shared schedule
                    this.renderCalendar();
                    this.renderFavoritesSidebar();
                    
                    console.log(`Loaded shared schedule from ${this.sharedUserName} (static)`);
                }
            } catch (error) {
                console.error('Error loading shared schedule:', error);
                alert('Error loading shared schedule. The link may be invalid.');
            }
        }
    }

    disableEditingInSharedView() {
        // Hide edit buttons
        const addFilmBtn = document.getElementById('add-film-btn');
        const manualAddBtn = document.getElementById('manual-add-btn');
        const settingsBtn = document.getElementById('settings-btn');
        const shareScheduleBtn = document.getElementById('share-schedule-btn');
        
        if (addFilmBtn) addFilmBtn.style.display = 'none';
        if (manualAddBtn) manualAddBtn.style.display = 'none';
        if (settingsBtn) settingsBtn.style.display = 'none';
        if (shareScheduleBtn) shareScheduleBtn.style.display = 'none';
        
        // Hide delete button in detail modal
        const deleteBtn = document.getElementById('delete-film-btn');
        if (deleteBtn) deleteBtn.style.display = 'none';
        
        // Disable status toggle buttons in shared view
        document.querySelectorAll('#status-section .status-toggle-btn').forEach(btn => {
            btn.disabled = true;
            btn.classList.add('disabled');
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        });
        
        // Disable film block interactions (they'll still be viewable)
        // The detail modal will still work but won't have delete/edit options
    }

    async shareSchedule() {
        if (this.films.length === 0) {
            this.showShareStatus('No films to share. Add some films to your schedule first!', 'error');
            return;
        }

        const scheduleData = {
            userName: this.userName || 'Anonymous',
            films: this.films
        };

        // Always try dynamic sharing first (creates short URLs)
        // For Cloudflare tunnels or HTTPS (remote access), always use current origin
        // This ensures the API calls go to the same server serving the page
        const isTunnel = window.location.hostname.includes('trycloudflare.com') || 
                         window.location.hostname.includes('ngrok.io') || 
                         window.location.hostname.includes('localtunnel.me');
        const isRemote = window.location.protocol === 'https:' && window.location.hostname !== 'localhost';
        
        let shareApiUrl;
        if (isTunnel || isRemote) {
            // For tunnels/remote, always use the current origin (the tunnel URL)
            shareApiUrl = window.location.origin;
        } else if (this.backendUrl && this.backendUrl.trim()) {
            // Use saved backend URL if available
            shareApiUrl = this.backendUrl.trim();
        } else if (window.location.protocol === 'file:') {
            // If opened as file://, default to localhost
            shareApiUrl = 'http://localhost:3001';
        } else {
            // Otherwise use current origin
            shareApiUrl = window.location.origin;
        }
        
        try {
            // Check if we already have a share ID stored
            let shareId = localStorage.getItem('myShareId');
            
            const response = await fetch(`${shareApiUrl}/api/share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...scheduleData,
                    shareId: shareId || undefined // Include existing shareId if we have one
                })
            });

            if (response.ok) {
                const data = await response.json();
                shareId = data.shareId;
                
                // Store the share ID for future updates
                localStorage.setItem('myShareId', shareId);
                
                const shareUrl = `${window.location.origin}${window.location.pathname}?shareId=${shareId}`;
                
                // Copy to clipboard - ensure it's copied
                await this.copyToClipboard(shareUrl);
                this.showShareStatus(`✅ Share link copied! This link will always show your latest schedule.`, 'success');
                this.showShareUrlInput(shareUrl, true);
            } else {
                // If server endpoint doesn't exist, show helpful message
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 404) {
                    this.showShareStatus('⚠️ Sharing server not available. Please make sure your backend server is running with the /api/share endpoint.', 'error');
                } else {
                    throw new Error(errorData.error || 'Failed to save share on server');
                }
            }
        } catch (error) {
            console.error('Error with dynamic sharing:', error);
            console.error('Tried to use shareApiUrl:', shareApiUrl);
            // Show error with more details
            const errorMsg = error.message.includes('Failed to fetch') || error.message.includes('NetworkError')
                ? `Cannot reach server at ${shareApiUrl}. Make sure your server is running and accessible.`
                : `Error: ${error.message}`;
            this.showShareStatus(`⚠️ Could not create short link. ${errorMsg}`, 'error');
            
            // Offer static sharing as fallback
            const useStatic = confirm('Dynamic sharing failed. Would you like to create a long static link instead? (This will encode all data in the URL)');
            if (useStatic) {
                this.shareScheduleStatic(scheduleData);
            }
        }
    }

    async shareScheduleStatic(scheduleData) {
        try {
            const encoded = this.encodeScheduleData(scheduleData);
            const shareUrl = `${window.location.origin}${window.location.pathname}?share=${encoded}`;
            
            // Copy to clipboard - ensure it's copied
            await this.copyToClipboard(shareUrl);
            this.showShareStatus(`✅ Shareable link copied to clipboard! Note: This is a snapshot - it won't update if you change your schedule.`, 'success');
            this.showShareUrlInput(shareUrl, false);
        } catch (error) {
            console.error('Error generating share URL:', error);
            this.showShareStatus('Error generating share URL. Please try again.', 'error');
        }
    }

    async copyToClipboard(text) {
        // Try modern Clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return; // Success!
            } catch (err) {
                console.warn('Clipboard API failed, trying fallback:', err);
            }
        }
        
        // Fallback method for older browsers or when Clipboard API fails
        try {
            // Create a temporary textarea element
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-999999px';
            textarea.style.top = '-999999px';
            document.body.appendChild(textarea);
            
            // Select and copy
            textarea.focus();
            textarea.select();
            
            // For iOS Safari
            if (navigator.userAgent.match(/ipad|ipod|iphone/i)) {
                const range = document.createRange();
                range.selectNodeContents(textarea);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                textarea.setSelectionRange(0, 999999);
            }
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);
            
            if (!successful) {
                throw new Error('execCommand copy failed');
            }
        } catch (err) {
            console.error('All clipboard methods failed:', err);
            // Still show the URL input so user can manually copy
            throw err;
        }
    }

    showShareUrlInput(url, isDynamic) {
        const shareStatus = document.getElementById('share-status');
        if (!shareStatus) return;

        const dynamicNote = isDynamic 
            ? '<div class="share-note dynamic">✨ Always shows your latest schedule to anyone you share it with</div>'
            : '<div class="share-note static">ℹ️ Snapshot - won\'t update. Generate a new link for changes.</div>';

        shareStatus.className = 'success';
        shareStatus.style.display = 'block';
        shareStatus.innerHTML = `
            <div class="share-success-message">✅ Link copied to clipboard!</div>
            <input type="text" id="share-url-input" value="${url}" readonly onclick="this.select();">
            <div class="share-help-text">
                Link is already in your clipboard! Click above to select if needed.
            </div>
            ${dynamicNote}
        `;

        // Scroll the dialog into view (especially important on mobile)
        setTimeout(() => {
            shareStatus.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            
            // Auto-select the input text (as backup if clipboard didn't work)
            const input = document.getElementById('share-url-input');
            if (input) {
                input.select();
                input.focus();
            }
        }, 100);
    }

    showShareStatus(message, type) {
        const statusEl = document.getElementById('share-status');
        if (!statusEl) return;
        
        statusEl.style.display = 'block';
        statusEl.textContent = message;
        statusEl.className = type || 'info';
        
        // Scroll the dialog into view (especially important on mobile)
        setTimeout(() => {
            statusEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }, 100);
    }

    encodeScheduleData(data) {
        // Compress the data by removing unnecessary fields and using shorter keys
        const compressed = {
            n: data.userName, // n = name
            f: data.films.map(film => ({
                t: film.title, // t = title
                d: film.director, // d = director
                c: film.country, // c = country
                p: film.programme, // p = programme
                l: film.location, // l = location
                st: film.startTime, // st = startTime
                et: film.endTime, // et = endTime
                r: film.room, // r = room
                link: film.iffrLink, // link = iffrLink
                fav: film.favorited, // fav = favorited
                tick: film.ticket, // tick = ticket
                mod: film.moderating, // mod = moderating
                qa: film.hasQA, // qa = hasQA
                scr: film.screenings || [] // scr = screenings
            }))
        };
        
        const json = JSON.stringify(compressed);
        // Use base64 encoding for URL-safe transmission
        return btoa(encodeURIComponent(json));
    }

    decodeScheduleData(encoded) {
        try {
            const json = decodeURIComponent(atob(encoded));
            const compressed = JSON.parse(json);
            
            // Expand the compressed data back to full format
            return {
                userName: compressed.n || '',
                films: compressed.f.map(film => ({
                    title: film.t || '',
                    director: film.d || '',
                    country: film.c || '',
                    programme: film.p || '',
                    location: film.l || '',
                    startTime: film.st || null,
                    endTime: film.et || null,
                    room: film.r || '',
                    iffrLink: film.link || '',
                    favorited: film.fav || false,
                    ticket: film.tick || false,
                    moderating: film.mod || false,
                    hasQA: film.qa || false,
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9), // Generate new ID
                    screenings: film.scr || [] // scr = screenings (preserve screenings if available)
                }))
            };
        } catch (error) {
            console.error('Error decoding schedule data:', error);
            throw new Error('Invalid share link');
        }
    }
}

// Initialize app when DOM is ready
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new FilmFestivalPlanner();
    
    // Force h1 to be black even in dark mode (aggressive override)
    const forceH1Black = () => {
        const h1 = document.querySelector('header h1');
        if (h1) {
            h1.style.color = '#000000';
            h1.style.setProperty('color', '#000000', 'important');
            h1.style.setProperty('-webkit-text-fill-color', '#000000', 'important');
        }
    };
    
    // Apply immediately and on any changes
    forceH1Black();
    setTimeout(forceH1Black, 100);
    setTimeout(forceH1Black, 500);
    
    // Also apply when dark mode changes
    if (window.matchMedia) {
        const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        darkModeQuery.addEventListener('change', forceH1Black);
    }
});
