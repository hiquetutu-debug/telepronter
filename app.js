class TeleprompterApp {
    constructor() {
        this.playlist = this.loadPlaylist();
        this.currentSong = null;
        this.isScrolling = false;
        this.scrollSpeed = 1;
        this.scrollInterval = null;
        this.scrollContainer = null;
        
        this.initElements();
        this.attachEventListeners();
        this.registerServiceWorker();
        this.handleInstallPrompt();
        this.renderPlaylist();
    }

    initElements() {
        this.musicInput = document.getElementById('musicInput');
        this.addBtn = document.getElementById('addBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.playlistUl = document.getElementById('playlistUl');
        
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
