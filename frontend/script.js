class SpielberichtApp {
    renderTeamSearchResults() {
        const resultsDiv = document.getElementById('teamSearchResults');
        if (!resultsDiv) return;
        resultsDiv.innerHTML = '';

        if (!this.teamSearchQuery) {
            resultsDiv.innerHTML = '<p>Bitte geben Sie einen Teamnamen oder eine Liga ein.</p>';
            document.getElementById('teamMatchListing').innerHTML = '';
            return;
        }

        // Gather all teams and their liga
        const teams = [];
        this.matches.forEach(match => {
            if (match['Team 1']) teams.push({ name: match['Team 1'], liga: match['Liga'] });
            if (match['Team 2']) teams.push({ name: match['Team 2'], liga: match['Liga'] });
        });

        // Remove duplicates (team+liga combo)
        const uniqueTeams = Array.from(new Set(teams.map(t => t.name + '|' + t.liga)))
            .map(str => {
                const [name, liga] = str.split('|');
                return { name, liga };
            });

        // Fuzzy search
        const query = this.teamSearchQuery.toLowerCase();
        const terms = query.split(/\s+/).filter(Boolean);
        const filtered = uniqueTeams.filter(teamObj => {
            // Match if all terms are in team name or liga
            return terms.every(term =>
                teamObj.name.toLowerCase().includes(term) ||
                (teamObj.liga && teamObj.liga.toLowerCase().includes(term))
            );
        });

        if (filtered.length === 0) {
            resultsDiv.innerHTML = `<p>Keine Teams gefunden für "${this.teamSearchQuery}"</p>`;
            document.getElementById('teamMatchListing').innerHTML = '';
            return;
        }

        // Show results
        const ul = document.createElement('ul');
        ul.className = 'team-search-list';
        filtered.forEach(teamObj => {
            const li = document.createElement('li');
            li.className = 'team-search-item';
            li.innerHTML = `<strong>${this.highlightText(teamObj.name, this.teamSearchQuery)}</strong> <span class="team-liga">(${teamObj.liga})</span>`;
            ul.appendChild(li);
        });
        resultsDiv.appendChild(ul);

        // --- Match listing for filtered teams ---
        this.renderTeamMatchListing(filtered);
    }
    constructor() {
        this.matches = [];
        this.filteredMatches = [];
        this.selectedMatches = new Set();
        this.sortField = 'id';
        this.sortDirection = 'asc';
        this.searchQuery = '';
        // We no longer need Fuse.js options as we're implementing custom search
        this.init();
        this.teamSearchQuery = '';
    }

    bindTeamSearchEvents() {
        const teamSearchInput = document.getElementById('teamSearchInput');
        if (teamSearchInput) {
            teamSearchInput.addEventListener('input', (e) => this.handleTeamSearchInput(e.target.value));
        }
        const clearTeamSearchBtn = document.getElementById('clearTeamSearch');
        if (clearTeamSearchBtn) {
            clearTeamSearchBtn.addEventListener('click', () => this.clearTeamSearch());
        }
    }
    // --- Team/Liga fuzzy search logic for tab 2 ---
    handleTeamSearchInput(query) {
        this.teamSearchQuery = query.trim();
        this.renderTeamSearchResults();
        // Toggle clear button visibility
        const clearBtn = document.getElementById('clearTeamSearch');
        if (this.teamSearchQuery) {
            clearBtn.classList.add('visible');
        } else {
            clearBtn.classList.remove('visible');
        }
    }

    clearTeamSearch() {
        const teamSearchInput = document.getElementById('teamSearchInput');
        teamSearchInput.value = '';
        this.teamSearchQuery = '';
        this.renderTeamSearchResults();
        document.getElementById('clearTeamSearch').classList.remove('visible');
        teamSearchInput.focus();
    }

    renderTeamMatchListing(filteredTeams) {
        // Store filtered teams for export
        this.lastFilteredTeams = filteredTeams.map(t => t.name);
        // Store the latest relevant matches for export
        this.latestEinsaetzeListing = [];
        const listingDiv = document.getElementById('teamMatchListing');
        if (!listingDiv) return;
        const teamNames = filteredTeams.map(t => t.name);
        // Get current date/time
        const now = new Date();
        // Find all matches where any team is playing or is referee
    const relevantMatches = this.matches.filter(match => {
            // Parse date and time
            const dateStr = match['Tag'];
            const timeStr = match['Startzeit'];
            let matchDate;
            if (dateStr && timeStr) {
                // Try to parse as YYYY-MM-DD HH:MM or DD.MM.YYYY HH:MM
                let iso = dateStr;
                if (iso.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
                    // Convert DD.MM.YYYY to YYYY-MM-DD
                    const [d, m, y] = iso.split('.');
                    iso = `${y}-${m}-${d}`;
                }
                matchDate = new Date(`${iso}T${timeStr}`);
            }
            // Only include matches in the future
            if (!matchDate || matchDate < now) return false;
            return teamNames.some(name =>
                match['Team 1'] === name ||
                match['Team 2'] === name ||
                match['Schiedsrichter'] === name
            );
        });
    // Sort by date/time
    relevantMatches.sort((a, b) => {
            const getDate = m => {
                let iso = m['Tag'];
                if (iso && iso.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
                    const [d, mth, y] = iso.split('.');
                    iso = `${y}-${mth}-${d}`;
                }
                return new Date(`${iso}T${m['Startzeit']}`);
            };
            return getDate(a) - getDate(b);
        });
        if (relevantMatches.length === 0) {
            listingDiv.innerHTML = '<p>Keine zukünftigen Spiele für die gefilterten Teams gefunden.</p>';
            this.latestEinsaetzeListing = [];
            return;
        }
        // Render as table
        const table = document.createElement('table');
        table.className = 'team-match-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Zeit</th>
                    <th>Teams</th>
                    <th>Liga</th>
                    <th>Beteiligung</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');
        relevantMatches.forEach(match => {
            const involved = [];
            teamNames.forEach(name => {
                if (match['Team 1'] === name || match['Team 2'] === name) {
                    involved.push({ name, type: 'player' });
                }
                if (match['Schiedsrichter'] === name) {
                    involved.push({ name, type: 'referee' });
                }
            });
            const uniqueInvolved = Array.from(new Set(involved.map(i => i.name + '|' + i.type)))
                .map(str => {
                    const [name, type] = str.split('|');
                    return { name, type };
                });
            const icons = { player: '⚽', referee: '🦺' };
            const colors = { player: 'var(--color-primary)', referee: 'var(--color-warning)' };
            const involvedStr = uniqueInvolved.map(i =>
                `<span style="color:${colors[i.type]};font-weight:bold;">${icons[i.type]} ${i.name}</span>`
            ).join(', ');
            const einsatzObj = {
                date: `${match['Tag']} ${match['Startzeit']}`,
                teams: `${match['Team 1']} vs ${match['Team 2']}`,
                liga: match['Liga'] + (match['Gruppe'] ? ' - ' + match['Gruppe'] : ''),
                involved: uniqueInvolved.map(i => `${i.name} (${i.type === 'player' ? 'Spieler' : 'SR'})`).join(', ')
            };
            this.latestEinsaetzeListing.push(einsatzObj);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${einsatzObj.date}</td>
                <td>${einsatzObj.teams}</td>
                <td>${einsatzObj.liga}</td>
                <td>${involvedStr}</td>
            `;
            tbody.appendChild(tr);
        });
        listingDiv.innerHTML = '';
        listingDiv.appendChild(table);
    }

    init() {
        this.bindEvents();
        this.bindTeamSearchEvents();
        this.bindExportEinsaetzePdfEvent();
        this.updateFileNames();
    }

    bindExportEinsaetzePdfEvent() {
        const btn = document.getElementById('exportEinsaetzePdfBtn');
        if (btn) {
            btn.addEventListener('click', () => this.exportEinsaetzePdf());
        }
    }

    async exportEinsaetzePdf() {
        if (!this.latestEinsaetzeListing || this.latestEinsaetzeListing.length === 0) {
            alert('Keine Einsätze zum Exportieren gefunden.');
            return;
        }
        const filteredTeams = this.lastFilteredTeams || [];
        try {
            const response = await fetch('/api/einsaetze_pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ listing: this.latestEinsaetzeListing, filteredTeams })
            });
            if (!response.ok) throw new Error('PDF Export fehlgeschlagen');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'einsaetze_uebersicht.pdf';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert('Fehler beim PDF Export: ' + err.message);
        }
    }

    bindEvents() {
        console.log("Binding events");
        // File upload form
        const uploadForm = document.getElementById('uploadForm');
        uploadForm.addEventListener('submit', (e) => this.handleUpload(e));

        // File input changes
        document.getElementById('spielplan').addEventListener('change', () => this.updateFileName('spielplan'));
        document.getElementById('players').addEventListener('change', () => this.updateFileName('players'));

        // Match selection controls
        document.getElementById('selectAll').addEventListener('click', () => this.selectAllMatches());
        document.getElementById('selectNone').addEventListener('click', () => this.selectNoMatches());

        // Search input
        const searchInput = document.getElementById('searchMatches');
        searchInput.addEventListener('input', (e) => this.handleSearchInput(e.target.value));

        // Clear search button
        const clearSearchBtn = document.getElementById('clearSearch');
        clearSearchBtn.addEventListener('click', () => this.clearSearch());

        // Generate button
        document.getElementById('generateBtn').addEventListener('click', () => this.generateReports());
    }

    handleSearchInput(query) {
        this.searchQuery = query.trim();
        this.filterMatches();
        this.renderMatches();

        // Toggle clear button visibility
        const clearBtn = document.getElementById('clearSearch');
        if (this.searchQuery) {
            clearBtn.classList.add('visible');
        } else {
            clearBtn.classList.remove('visible');
        }
    }

    clearSearch() {
        const searchInput = document.getElementById('searchMatches');
        searchInput.value = '';
        this.searchQuery = '';
        this.filterMatches();
        this.renderMatches();

        // Hide clear button
        document.getElementById('clearSearch').classList.remove('visible');

        // Focus back on search input
        searchInput.focus();
    }

    filterMatches() {
        if (!this.searchQuery) {
            // If no search query, show all matches
            this.filteredMatches = this.matches;
            return;
        }

        // Custom search implementation that focuses on teams, league, time, and date
        const query = this.searchQuery.toLowerCase();

        // Convert the query into search terms (split by spaces)
        const searchTerms = query.split(/\s+/).filter(term => term.length > 0);

        this.filteredMatches = this.matches.filter(match => {
            // Check if all search terms match
            return searchTerms.every(term => {
                // Fields to search in
                const team1 = (match['Team 1'] || '').toLowerCase();
                const team2 = (match['Team 2'] || '').toLowerCase();
                const liga = (match['Liga'] || '').toLowerCase();
                const gruppe = (match['Gruppe'] || '').toLowerCase(); // Add Gruppe to search fields
                const time = (match['Startzeit'] || '').toLowerCase();
                const date = (match['Tag'] || '').toLowerCase();

                // Check if the term appears in any of the fields in the correct order
                return this.isTermInString(team1, term) ||
                       this.isTermInString(team2, term) ||
                       this.isTermInString(liga, term) ||
                       this.isTermInString(gruppe, term) || // Add check for Gruppe
                       this.isTermInString(time, term) ||
                       this.isTermInString(date, term);
            });
        });
    }

    // Helper method to check if a term is in a string, respecting word boundaries
    isTermInString(str, term) {
        // Get all words in the string
        const words = str.split(/\s+/);

        // Check each word to see if it contains the term
        for (const word of words) {
            if (word.includes(term)) {
                return true;
            }
        }

        // Also check if the term spans multiple words but in the correct sequence
        if (str.includes(term)) {
            return true;
        }

        return false;
    }

    updateFileName(inputId) {
        console.log("Updating file name for:", inputId);
        const input = document.getElementById(inputId);
        const nameSpan = document.getElementById(inputId + 'Name');

        if (input.files.length > 0) {
            nameSpan.textContent = input.files[0].name;
            nameSpan.style.color = '#4CAF50';
        } else {
            nameSpan.textContent = 'Keine Datei ausgewählt';
            nameSpan.style.color = '#666';
        }
    }

    updateFileNames() {
        this.updateFileName('spielplan');
        this.updateFileName('players');
    }

    async handleUpload(e) {
        console.log("Upload form submitted");
        e.preventDefault();

        const uploadBtn = e.target.querySelector('button[type="submit"]');
        const spinner = document.getElementById('uploadSpinner');
        const statusDiv = document.getElementById('uploadStatus');

        // Show loading state
        uploadBtn.disabled = true;
        spinner.classList.add('active');
        statusDiv.innerHTML = '';

        try {
            const formData = new FormData();
            const spielplanInput = document.getElementById('spielplan');
            if (!spielplanInput || !spielplanInput.files || spielplanInput.files.length === 0) {
                throw new Error('Bitte wählen Sie eine Spielplan-Datei aus.');
            }
            formData.append('spielplan', spielplanInput.files[0]);

            const playersInput = document.getElementById('players');
            if (playersInput && playersInput.files && playersInput.files.length > 0) {
                formData.append('players', playersInput.files[0]);
            }

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            console.log("Upload response status:", response.status);
            console.log("Upload response:", response);
            const result = await response.json();

            if (result.success) {
                this.matches = result.matches;
                this.filteredMatches = result.matches; // Initialize filtered matches with all matches

                // Reset sort and search when loading new data
                this.sortField = 'id';
                this.sortDirection = 'asc';
                this.searchQuery = '';
                document.getElementById('searchMatches').value = '';

                this.renderMatches();
                this.showMatchesSection();
                this.showStatus(result.message, 'success');
            } else {
                this.showStatus('Fehler beim Hochladen der Dateien', 'error');
            }

        } catch (error) {
            this.showStatus(`Fehler: ${error.message}`, 'error');
        } finally {
            // Hide loading state
            uploadBtn.disabled = false;
            spinner.classList.remove('active');
        }
    }

    renderMatches() {
        const matchesList = document.getElementById('matchesList');
        matchesList.innerHTML = '';
        let matchListHeader = document.createElement('div');
        matchListHeader.className = 'matches-header matches-grid';
        matchListHeader.innerHTML = `
            <div class="header-checkbox"></div>
            <div class="header-id" data-sort="id">Nr</div>
            <div class="header-time" data-sort="Startzeit">Zeit</div>
            <div class="header-teams" data-sort="teams">Teams</div>
            <div class="header-league" data-sort="Liga">Liga/Gruppe</div>
            <div class="header-referee" data-sort="Schiedsrichter">Schiri</div>
            <div class="header-date" data-sort="Tag">Tag</div>
        `;
        matchesList.appendChild(matchListHeader);

        // Add sort click handlers to column headers
        matchListHeader.querySelectorAll('[data-sort]').forEach(header => {
            const sortField = header.getAttribute('data-sort');

            // Add sort direction class to current sort field
            if (sortField === this.sortField) {
                header.classList.add(this.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
            }

            // Add click handler
            header.addEventListener('click', () => this.handleSortClick(sortField));
        });

        // Sort the matches
        const sortedMatches = this.getSortedMatches();

        // If no matches found with the current search
        if (sortedMatches.length === 0 && this.searchQuery) {
            const noMatchesDiv = document.createElement('div');
            noMatchesDiv.className = 'no-matches-message';
            noMatchesDiv.innerHTML = `
                <p>Keine Spiele gefunden für "${this.searchQuery}"</p>
            `;
            matchesList.appendChild(noMatchesDiv);
        } else {
            // Render the sorted matches
            sortedMatches.forEach((match, index) => {
                const matchDiv = document.createElement('div');
                matchDiv.className = 'match-item matches-grid';
                // Create a sanitized class name for the league (remove spaces, special chars, etc.)
                const leagueClass = this.getLeagueClassName(match.Liga);

                // Prepare values with highlights if search query exists
                const team1 = this.searchQuery ? this.highlightText(match['Team 1'], this.searchQuery) : match['Team 1'];
                const team2 = this.searchQuery ? this.highlightText(match['Team 2'], this.searchQuery) : match['Team 2'];

                // Combine Liga and Gruppe if Gruppe exists
                let ligaDisplay = match.Liga || '';
                if (match.Gruppe) {
                    // Highlight both Liga and Gruppe if there's a search query
                    const gruppe = this.searchQuery ? this.highlightText(match.Gruppe, this.searchQuery) : match.Gruppe;
                    ligaDisplay += ` - ${gruppe}`;
                }

                const liga = this.searchQuery ? this.highlightText(ligaDisplay, this.searchQuery) : ligaDisplay;
                const schiri = this.searchQuery ? this.highlightText(match.Schiedsrichter, this.searchQuery) : match.Schiedsrichter;
                const tag = this.searchQuery ? this.highlightText(match.Tag, this.searchQuery) : match.Tag;
                const time = this.searchQuery ? this.highlightText(match.Startzeit, this.searchQuery) : match.Startzeit;

                matchDiv.innerHTML = `
                    <input type="checkbox" class="match-checkbox" data-match-id="${match.id}">
                    <div class="match-number">#${match.id}</div>
                    <div class="match-time">${time}</div>
                    <div class="match-teams">${team1} vs ${team2}</div>
                    <div class="match-league league-${leagueClass}">${liga}</div>
                    <div class="match-referee">${schiri}</div>
                    <div class="match-date">${tag}</div>
                `;

                // Add click event for checkbox
                const checkbox = matchDiv.querySelector('.match-checkbox');
                checkbox.addEventListener('change', () => this.handleMatchSelection(match.id, checkbox.checked));

                // Set initial checkbox state based on selection status
                checkbox.checked = this.selectedMatches.has(match.id);

                matchesList.appendChild(matchDiv);
            });
        }

        this.updateSelectionCount();
        this.updateMatchVisuals();
    }

    handleMatchSelection(matchId, isSelected) {
        if (isSelected) {
            this.selectedMatches.add(matchId);
        } else {
            this.selectedMatches.delete(matchId);
        }

        this.updateSelectionCount();
        this.updateMatchVisuals();
    }

    selectAllMatches() {
        // Always use filtered matches which will contain:
        // - All matches if no search query
        // - Only matches matching the search query if there's a search
        this.filteredMatches.forEach(match => {
            this.selectedMatches.add(match.id);
        });

        // Update only visible checkboxes (which correspond to filtered matches)
        document.querySelectorAll('.match-checkbox').forEach(checkbox => {
            checkbox.checked = true;
        });

        this.updateSelectionCount();
        this.updateMatchVisuals();
    }

    selectNoMatches() {
        // If there's a search query, only deselect matches currently visible
        if (this.searchQuery) {
            this.filteredMatches.forEach(match => {
                this.selectedMatches.delete(match.id);
            });

            // Update only visible checkboxes
            document.querySelectorAll('.match-checkbox').forEach(checkbox => {
                checkbox.checked = false;
            });
        } else {
            // If no search query, clear all selections
            this.selectedMatches.clear();

            // Update all checkboxes
            document.querySelectorAll('.match-checkbox').forEach(checkbox => {
                checkbox.checked = false;
            });
        }

        this.updateSelectionCount();
        this.updateMatchVisuals();
    }

    updateSelectionCount() {
        const countSpan = document.getElementById('selectionCount');
        const generateBtn = document.getElementById('generateBtn');

        const count = this.selectedMatches.size;
        countSpan.textContent = `${count} Spiele ausgewählt`;

        generateBtn.disabled = count === 0;
    }

    // Helper method to create a valid CSS class name from a league name
    getLeagueClassName(leagueName) {
        if (!leagueName) return 'default';

        // Create a consistent hash from the league name to get a deterministic color
        const hash = Array.from(leagueName)
            .reduce((acc, char) => acc + char.charCodeAt(0), 0) % 8 + 1;

        return `color-${hash}`;
    }

    // Helper method to highlight search text
    highlightText(text, query) {
        if (!query || !text) return text;

        let highlightedText = text.toString();
        const textLower = highlightedText.toLowerCase();

        // Split query into terms
        const terms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);

        // Create a set to track which parts of the string have been highlighted already
        const highlightedRanges = [];

        // Process each search term
        terms.forEach(term => {
            // Find all occurrences of the term
            let startPos = 0;
            while ((startPos = textLower.indexOf(term, startPos)) >= 0) {
                const endPos = startPos + term.length;

                // Check if this range overlaps with any previously highlighted range
                const overlaps = highlightedRanges.some(([start, end]) => {
                    return (startPos >= start && startPos < end) ||
                           (endPos > start && endPos <= end) ||
                           (startPos <= start && endPos >= end);
                });

                if (!overlaps) {
                    highlightedRanges.push([startPos, endPos]);
                }

                startPos = endPos;
            }
        });

        // Sort ranges in reverse order (to avoid messing up the indices)
        highlightedRanges.sort((a, b) => b[0] - a[0]);

        // Apply the highlight to each range
        highlightedRanges.forEach(([start, end]) => {
            const beforeHighlight = highlightedText.substring(0, start);
            const toHighlight = highlightedText.substring(start, end);
            const afterHighlight = highlightedText.substring(end);

            highlightedText = beforeHighlight +
                              '<span class="search-highlight">' + toHighlight + '</span>' +
                              afterHighlight;
        });

        return highlightedText;
    }

    // Handle sorting when a column header is clicked
    handleSortClick(field) {
        // If clicking the same column, toggle direction
        if (field === this.sortField) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            // New column, default to ascending
            this.sortField = field;
            this.sortDirection = 'asc';
        }

        // Re-render the matches with the new sort
        this.renderMatches();
    }

    // Return a sorted copy of the filtered matches array
    getSortedMatches() {
        // Clone the filtered array to avoid modifying it
        const sortedMatches = [...this.filteredMatches];

        // Sort according to current sort field and direction
        sortedMatches.sort((a, b) => {
            let valueA, valueB;

            // Handle special case for teams which needs to combine two fields
            if (this.sortField === 'teams') {
                valueA = `${a['Team 1']} ${a['Team 2']}`;
                valueB = `${b['Team 1']} ${b['Team 2']}`;
            } else {
                valueA = a[this.sortField];
                valueB = b[this.sortField];
            }

            // Handle numeric vs string comparison
            let result;
            if (this.sortField === 'id') {
                // For ID, do numeric comparison
                result = Number(valueA) - Number(valueB);
            } else {
                // For everything else, do string comparison
                result = String(valueA).localeCompare(String(valueB));
            }

            // Reverse for descending sort
            return this.sortDirection === 'asc' ? result : -result;
        });

        return sortedMatches;
    }    updateMatchVisuals() {
        document.querySelectorAll('.match-item').forEach(item => {
            const checkbox = item.querySelector('.match-checkbox');
            const matchId = parseInt(checkbox.dataset.matchId);

            if (this.selectedMatches.has(matchId)) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    showMatchesSection() {
        const section = document.getElementById('matchesSection');
        section.style.display = 'block';

        // Scroll to the section after a small delay to ensure it's rendered
        setTimeout(() => {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    async generateReports() {
        if (this.selectedMatches.size === 0) {
            this.showStatus('Bitte wählen Sie mindestens ein Spiel aus', 'error');
            return;
        }

        const generateBtn = document.getElementById('generateBtn');
        const spinner = document.getElementById('generateSpinner');

        // Show loading state
        generateBtn.disabled = true;
        spinner.classList.add('active');

        try {
            const selectedIds = Array.from(this.selectedMatches);

            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(selectedIds)
            });

            if (response.ok) {
                // Get filename from response headers
                const contentDisposition = response.headers.get('Content-Disposition');
                let filename = 'spielberichte.pdf';
                if (contentDisposition) {
                    const matches = /filename=([^;]+)/.exec(contentDisposition);
                    if (matches) {
                        filename = matches[1];
                    }
                }

                // Download the file
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);

                this.showStatus(`${selectedIds.length} Spielberichte erfolgreich generiert und heruntergeladen!`, 'success');
            } else {
                const error = await response.json();
                this.showStatus(`Fehler: ${error.detail}`, 'error');
            }

        } catch (error) {
            this.showStatus(`Fehler beim Generieren: ${error.message}`, 'error');
        } finally {
            // Hide loading state
            generateBtn.disabled = false;
            spinner.classList.remove('active');
        }
    }

    showStatus(message, type) {
        // Update both status divs - the upload status in the form and the floating status
        const uploadStatusDiv = document.getElementById('uploadStatus');
        if (uploadStatusDiv) {
            uploadStatusDiv.textContent = message;
            uploadStatusDiv.className = `status-message ${type}`;
        }

        // Show floating status message
        const statusDiv = document.getElementById('statusMessage');
        statusDiv.textContent = message;
        statusDiv.className = `status-message floating-status ${type} visible`;

        // Auto-hide all status messages after 5 seconds
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                if (uploadStatusDiv) {
                    uploadStatusDiv.textContent = '';
                    uploadStatusDiv.className = 'status-message';
                }
                statusDiv.className = 'status-message floating-status';
            }, 5000);
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SpielberichtApp();
});
