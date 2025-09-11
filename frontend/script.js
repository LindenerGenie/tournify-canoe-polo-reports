class SpielberichtApp {
    constructor() {
        this.matches = [];
        this.selectedMatches = new Set();
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

        this.matches.forEach((match, index) => {
            const matchDiv = document.createElement('div');
            matchDiv.className = 'match-item';
            matchDiv.innerHTML = `
                <input type="checkbox" class="match-checkbox" data-match-id="${match.id}">
                <div class="match-number">#${match.id + 1}</div>
                <div class="match-time">${match.Startzeit}</div>
                <div class="match-teams">${match['Team 1']} vs ${match['Team 2']}</div>
                <div class="match-league">${match.Liga}</div>
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

    updateMatchVisuals() {
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
