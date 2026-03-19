class TeleprompterApp {
    constructor() {
        this.playlist = this.loadPlaylist();
        this.generatedLyrics = this.loadGeneratedLyrics();
        this.currentSong = null;
        this.isScrolling = false;
        this.scrollSpeed = 1;
        this.scrollInterval = null;
        this.scrollContainer = null;
        this.isGeneratingAll = false;
        
        this.initElements();
        this.attachEventListeners();
        this.registerServiceWorker();
        this.handleInstallPrompt();
        this.renderPlaylist();
        this.renderGeneratedLyrics();
    }

    initElements() {
        this.musicInput = document.getElementById('musicInput');
        this.addBtn = document.getElementById('addBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.playlistUl = document.getElementById('playlistUl');
        
        // Batch mode
        this.batchInput = document.getElementById('batchInput');
        this.addBatchBtn = document.getElementById('addBatchBtn');
        this.clearBatchBtn = document.getElementById('clearBatchBtn');
        this.singleModeBtn = document.getElementById('singleModeBtn');
        this.batchModeBtn = document.getElementById('batchModeBtn');
        this.singleMode = document.getElementById('singleMode');
        this.batchMode = document.getElementById('batchMode');
        
        this.modal = document.getElementById('lyricsModal');
        this.closeLyricsBtn = document.getElementById('closeLyrics');
        this.currentSongTitle = document.getElementById('currentSongTitle');
        this.lyricsText = document.getElementById('lyricsText');
        this.lyricsContainer = document.getElementById('lyricsContainer');
        
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.speedSlider = document.getElementById('speedSlider');
        this.speedValue = document.getElementById('speedValue');
        this.resetBtn = document.getElementById('resetBtn');
        
        this.loadingSpinner = document.getElementById('loadingSpinner');
    }

    attachEventListeners() {
        this.addBtn.addEventListener('click', () => this.addSong());
        this.clearBtn.addEventListener('click', () => this.clearPlaylist());
        this.musicInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addSong();
        });
        
        document.getElementById('generateAllBtn').addEventListener('click', () => this.generateAllLyrics());
        document.getElementById('clearGeneratedBtn').addEventListener('click', () => this.clearGeneratedLyrics());
        document.getElementById('closeGeneratedSection').addEventListener('click', () => this.closeGeneratedSection());
        
        // Batch mode listeners
        this.singleModeBtn.addEventListener('click', () => this.switchMode('single'));
        this.batchModeBtn.addEventListener('click', () => this.switchMode('batch'));
        this.addBatchBtn.addEventListener('click', () => this.addBatchSongs());
        this.clearBatchBtn.addEventListener('click', () => this.clearBatchInput());
        this.batchInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.addBatchSongs();
            }
        });
        
        this.closeLyricsBtn.addEventListener('click', () => this.closeModal());
        this.playPauseBtn.addEventListener('click', () => this.toggleScroll());
        this.speedSlider.addEventListener('input', (e) => this.updateSpeed(e.target.value));
        this.resetBtn.addEventListener('click', () => this.resetScroll());
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    }

    addSong() {
        const input = this.musicInput.value.trim();
        if (!input) return;
        
        this.playlist.push(input);
        this.savePlaylist();
        this.musicInput.value = '';
        this.renderPlaylist();
    }

    switchMode(mode) {
        if (mode === 'single') {
            this.singleMode.classList.add('active');
            this.batchMode.classList.add('hidden');
            this.singleModeBtn.classList.add('active');
            this.batchModeBtn.classList.remove('active');
            this.musicInput.focus();
        } else {
            this.singleMode.classList.remove('active');
            this.batchMode.classList.remove('hidden');
            this.singleModeBtn.classList.remove('active');
            this.batchModeBtn.classList.add('active');
            this.batchInput.focus();
        }
    }

    addBatchSongs() {
        const input = this.batchInput.value.trim();
        if (!input) {
            alert('Cole as músicas no campo de texto!');
            return;
        }

        // Quebrar por linhas e adicionar cada uma
        const lines = input.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (lines.length === 0) return;

        let added = 0;
        lines.forEach(line => {
            if (line) {
                this.playlist.push(line);
                added++;
            }
        });

        this.savePlaylist();
        this.renderPlaylist();
        this.batchInput.value = '';
        
        // Feedback visual
        alert(`✅ ${added} música(s) adicionada(s)!`);
        this.switchMode('single');
    }

    clearBatchInput() {
        this.batchInput.value = '';
        this.batchInput.focus();
    }

    clearPlaylist() {
        if (confirm('Tem certeza que deseja limpar toda a playlist?')) {
            this.playlist = [];
            this.savePlaylist();
            this.renderPlaylist();
            this.closeModal();
        }
    }

    renderPlaylist() {
        if (this.playlist.length === 0) {
            this.playlistUl.innerHTML = '<li class="empty-state">Adicione uma música para começar!</li>';
            return;
        }

        this.playlistUl.innerHTML = this.playlist.map((song, index) => `
            <li class="playlist-item" data-index="${index}">
                <div class="song-info">
                    <div class="song-title">🎵 ${this.escapeHtml(song)}</div>
                </div>
                <div class="item-actions">
                    <button class="btn-small btn-play-item" onclick="app.openSongLyrics(${index})">Ver Letra</button>
                    <button class="btn-small btn-delete" onclick="app.deleteSong(${index})">Deletar</button>
                </div>
            </li>
        `).join('');
    }

    deleteSong(index) {
        this.playlist.splice(index, 1);
        this.savePlaylist();
        this.renderPlaylist();
    }

    async openSongLyrics(index) {
        const song = this.playlist[index];
        this.currentSong = song;
        this.currentSongTitle.textContent = song;
        this.modal.classList.remove('hidden');
        this.resetScroll();
        
        this.showLoading(true);
        const lyrics = await this.fetchLyrics(song);
        this.showLoading(false);
        
        this.lyricsText.textContent = lyrics;
    }

    async fetchLyrics(songQuery) {
        try {
            // Tentar buscar de uma API legítima
            const [title, artist] = songQuery.split(' - ').map(s => s.trim());
            
            if (artist) {
                // Usar API lyrics.ovh (gratuita e legal)
                const response = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.lyrics) {
                        return data.lyrics;
                    }
                }
            }
            
            // Fallback: demonstração
            return this.getDemoLyrics(songQuery);
        } catch (error) {
            console.log('Erro ao buscar letras:', error);
            return this.getDemoLyrics(songQuery);
        }
    }

    getDemoLyrics(songQuery) {
        return `🎵 ${songQuery}

[Para ver as letras completas, certifique-se de estar conectado à internet]

Este app busca letras de músicas através de APIs legítimas.
Se a música não for encontrada, verifique:
- Se o nome da música está correto
- Se a banda/artista está no formato: "Título - Artista"

Exemplos:
• Imagine - The Beatles
• Bohemian Rhapsody - Queen
• Stairway to Heaven - Led Zeppelin

Use este app apenas com fins educacionais e pessoais.`;
    }

    toggleScroll() {
        this.isScrolling = !this.isScrolling;
        
        if (this.isScrolling) {
            this.playPauseBtn.textContent = '⏸ Pausar';
            this.playPauseBtn.classList.add('active');
            this.startScroll();
        } else {
            this.playPauseBtn.textContent = '▶ Play';
            this.playPauseBtn.classList.remove('active');
            this.stopScroll();
        }
    }

    startScroll() {
        if (this.scrollInterval) clearInterval(this.scrollInterval);
        
        const scrollSpeed = Math.max(10, 100 / this.scrollSpeed);
        
        this.scrollInterval = setInterval(() => {
            if (this.lyricsContainer) {
                this.lyricsContainer.scrollBy({
                    top: 2,
                    behavior: 'auto'
                });
            }
        }, scrollSpeed);
    }

    stopScroll() {
        if (this.scrollInterval) {
            clearInterval(this.scrollInterval);
            this.scrollInterval = null;
        }
    }

    updateSpeed(value) {
        this.scrollSpeed = parseFloat(value);
        this.speedValue.textContent = value + 'x';
        
        if (this.isScrolling) {
            this.stopScroll();
            this.startScroll();
        }
    }

    resetScroll() {
        this.stopScroll();
        this.isScrolling = false;
        this.playPauseBtn.textContent = '▶ Play';
        this.playPauseBtn.classList.remove('active');
        this.speedSlider.value = 1;
        this.scrollSpeed = 1;
        this.speedValue.textContent = '1x';
        
        if (this.lyricsContainer) {
            this.lyricsContainer.scrollTop = 0;
        }
    }

    closeModal() {
        this.stopScroll();
        this.resetScroll();
        this.modal.classList.add('hidden');
        this.currentSong = null;
    }

    showLoading(show) {
        if (show) {
            this.loadingSpinner.classList.remove('hidden');
        } else {
            this.loadingSpinner.classList.add('hidden');
        }
    }

    savePlaylist() {
        localStorage.setItem('telepromter_playlist', JSON.stringify(this.playlist));
    }

    loadPlaylist() {
        const saved = localStorage.getItem('telepromter_playlist');
        return saved ? JSON.parse(saved) : [];
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('service-worker.js').catch(err => {
                console.log('ServiceWorker registration failed:', err);
            });
        }
    }

    handleInstallPrompt() {
        let deferredPrompt;
        const installPrompt = document.getElementById('installPrompt');

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            installPrompt.classList.remove('hidden');

            installPrompt.addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    console.log(`User response to the install prompt: ${outcome}`);
                    deferredPrompt = null;
                    installPrompt.classList.add('hidden');
                }
            });
        });

        window.addEventListener('appinstalled', () => {
            console.log('PWA was installed');
            installPrompt.classList.add('hidden');
        });
    }

    async generateAllLyrics() {
        if (this.playlist.length === 0) {
            alert('Adicione músicas à playlist primeiro!');
            return;
        }
        
        if (this.isGeneratingAll) return;
        this.isGeneratingAll = true;
        
        const generateAllBtn = document.getElementById('generateAllBtn');
        generateAllBtn.disabled = true;
        generateAllBtn.textContent = '⏳ Gerando...';
        
        this.generatedLyrics = [];
        
        for (let i = 0; i < this.playlist.length; i++) {
            const song = this.playlist[i];
            this.showLoading(true);
            const lyrics = await this.fetchLyrics(song);
            this.generatedLyrics.push({
                song: song,
                lyrics: lyrics,
                timestamp: new Date().toLocaleTimeString()
            });
            this.showLoading(false);
            this.renderGeneratedLyrics();
        }
        
        generateAllBtn.disabled = false;
        generateAllBtn.textContent = '⚡ Gerar Todas';
        this.isGeneratingAll = false;
        this.showGeneratedSection();
    }

    renderGeneratedLyrics() {
        const section = document.getElementById('generatedLyricsSection');
        const list = document.getElementById('generatedLyricsList');
        
        if (this.generatedLyrics.length === 0) {
            section.classList.add('hidden');
            return;
        }
        
        section.classList.remove('hidden');
        list.innerHTML = this.generatedLyrics.map((item, index) => `
            <div class="generated-item">
                <div class="generated-item-header">
                    <h3>${index + 1}. ${this.escapeHtml(item.song)}</h3>
                    <span class="generated-time">${item.timestamp}</span>
                </div>
                <div class="generated-item-lyrics">
                    ${item.lyrics.split('\n').slice(0, 10).join('<br>')}
                    ${item.lyrics.split('\n').length > 10 ? '<p class="more-text">...</p>' : ''}
                </div>
                <div class="generated-item-actions">
                    <button class="btn-small btn-play-item" onclick="app.openGeneratedLyrics(${index})">Ver Completo</button>
                    <button class="btn-small btn-delete" onclick="app.deleteGeneratedLyric(${index})">Deletar</button>
                </div>
            </div>
        `).join('');
        
        this.saveGeneratedLyrics();
    }

    openGeneratedLyrics(index) {
        const item = this.generatedLyrics[index];
        this.currentSongTitle.textContent = item.song;
        this.lyricsText.textContent = item.lyrics;
        this.modal.classList.remove('hidden');
        this.resetScroll();
    }

    deleteGeneratedLyric(index) {
        this.generatedLyrics.splice(index, 1);
        this.renderGeneratedLyrics();
    }

    clearGeneratedLyrics() {
        if (confirm('Tem certeza que deseja limpar todas as letras geradas?')) {
            this.generatedLyrics = [];
            this.renderGeneratedLyrics();
            this.closeGeneratedSection();
        }
    }

    showGeneratedSection() {
        document.getElementById('generatedLyricsSection').classList.remove('hidden');
    }

    closeGeneratedSection() {
        document.getElementById('generatedLyricsSection').classList.add('hidden');
    }

    saveGeneratedLyrics() {
        localStorage.setItem('telepromter_generated', JSON.stringify(this.generatedLyrics));
    }

    loadGeneratedLyrics() {
        const saved = localStorage.getItem('telepromter_generated');
        return saved ? JSON.parse(saved) : [];
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

// Inicializar app quando o DOM estiver pronto
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new TeleprompterApp();
});
