class SpielberichtApp {
    constructor() {
        this.matches = [];
        this.selectedMatches = new Set();
        this.sortField = 'id';
        this.sortDirection = 'asc';
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateFileNames();
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

        // Generate button
        document.getElementById('generateBtn').addEventListener('click', () => this.generateReports());
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

                // Reset sort to default when loading new data
                this.sortField = 'id';
                this.sortDirection = 'asc';

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
            <div class="header-league" data-sort="Liga">Liga</div>
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

        // Render the sorted matches
        sortedMatches.forEach((match, index) => {
            const matchDiv = document.createElement('div');
            matchDiv.className = 'match-item matches-grid';
            // Create a sanitized class name for the league (remove spaces, special chars, etc.)
            const leagueClass = this.getLeagueClassName(match.Liga);

            matchDiv.innerHTML = `
                <input type="checkbox" class="match-checkbox" data-match-id="${match.id}">
                <div class="match-number">#${match.id}</div>
                <div class="match-time">${match.Startzeit}</div>
                <div class="match-teams">${match['Team 1']} vs ${match['Team 2']}</div>
                <div class="match-league league-${leagueClass}">${match.Liga}</div>
                <div class="match-referee">${match.Schiedsrichter}</div>
                <div class="match-date">${match.Tag}</div>
            `;

            // Add click event for checkbox
            const checkbox = matchDiv.querySelector('.match-checkbox');
            checkbox.addEventListener('change', () => this.handleMatchSelection(match.id, checkbox.checked));

            matchesList.appendChild(matchDiv);
        });

        this.updateSelectionCount();
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
        this.matches.forEach(match => {
            this.selectedMatches.add(match.id);
        });

        // Update all checkboxes
        document.querySelectorAll('.match-checkbox').forEach(checkbox => {
            checkbox.checked = true;
        });

        this.updateSelectionCount();
        this.updateMatchVisuals();
    }

    selectNoMatches() {
        this.selectedMatches.clear();

        // Update all checkboxes
        document.querySelectorAll('.match-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });

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

    // Return a sorted copy of the matches array
    getSortedMatches() {
        // Clone the array to avoid modifying the original
        const sortedMatches = [...this.matches];

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
        section.scrollIntoView({ behavior: 'smooth' });
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
        const statusDiv = document.getElementById('uploadStatus');
        statusDiv.textContent = message;
        statusDiv.className = `status-message ${type}`;

        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                statusDiv.textContent = '';
                statusDiv.className = 'status-message';
            }, 5000);
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SpielberichtApp();
});
