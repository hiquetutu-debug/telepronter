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
        this.addBtn.addEventListener('click', () => this.addSongs());
        this.clearBtn.addEventListener('click', () => this.clearPlaylist());
        this.musicInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.addSongs();
            }
        });
        
        document.getElementById('generateAllBtn').addEventListener('click', () => this.generateAllLyrics());
        document.getElementById('clearGeneratedBtn').addEventListener('click', () => this.clearGeneratedLyrics());
        document.getElementById('closeGeneratedSection').addEventListener('click', () => this.closeGeneratedSection());
        
        this.closeLyricsBtn.addEventListener('click', () => this.closeModal());
        this.playPauseBtn.addEventListener('click', () => this.toggleScroll());
        this.speedSlider.addEventListener('input', (e) => this.updateSpeed(e.target.value));
        this.resetBtn.addEventListener('click', () => this.resetScroll());
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    }

    addSongs() {
        const input = this.musicInput.value.trim();
        if (!input) {
            alert('Digite ou cole as músicas!');
            return;
        }
        
        // Debug: log do input
        console.log('Input recebido:', input.substring(0, 100));
        console.log('Contém quebra de linha?', /[\r\n]/.test(input));
        
        // Estratégia 1: Quebra por quebras de linha (mais comum)
        let lines = input.split(/[\r\n]+/);
        
        // Estratégia 2: Se não achou quebras de linha, tenta separar por números (1., 2., etc)
        if (lines.length <= 1 || (lines.length === 1 && input.includes('.'))) {
            console.log('Tentando separar por números...');
            // Separa por padrão "número. " no início
            lines = input.split(/\d+\.\s+/).filter(line => line.length > 0);
        }
        
        // Limpa cada linha
        lines = lines
            .map(line => line.trim())
            .filter(line => line.length > 0);

        console.log(`Encontradas ${lines.length} linhas`);
        
        if (lines.length === 0) {
            alert('Nenhuma música detectada!');
            return;
        }

        // Se tem mais de uma linha, trata como lote
        if (lines.length > 1) {
            console.log('Adicionando como lote:', lines.length, 'músicas');
            this.addBatchSongs(null, lines);
        } else {
            // Uma única música
            console.log('Adicionando única música:', lines[0]);
            this.playlist.push(lines[0]);
            this.savePlaylist();
            this.musicInput.value = '';
            this.renderPlaylist();
        }
    }

    addBatchSongs(input = null, preProcessedLines = null) {
        let lines;
        
        if (preProcessedLines) {
            lines = preProcessedLines;
        } else {
            const text = input || this.musicInput.value.trim();
            if (!text) {
                alert('Digite ou cole as músicas!');
                return;
            }

            // Múltiplas estratégias de separação
            lines = text
                .split(/[\r\n]+/)
                .map(line => line.trim())
                .filter(line => line.length > 0);
        }

        if (lines.length === 0) {
            alert('Nenhuma música detectada!');
            return;
        }

        console.log('Adicionando', lines.length, 'músicas:', lines);

        let added = 0;
        lines.forEach((line, idx) => {
            if (line) {
                // Remove número do início se tiver (1. , 2. , etc)
                const cleaned = line.replace(/^\d+\.\s*/, '').trim();
                console.log(`[${idx + 1}] "${cleaned}"`);
                this.playlist.push(cleaned);
                added++;
            }
        });

        this.savePlaylist();
        this.renderPlaylist();
        this.musicInput.value = '';
        
        if (added > 1) {
            alert(`✅ ${added} música(s) adicionada(s)!\n\nAbra o DevTools (F12) e veja o console para debug.`);
        }
    }
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
                    <div class="song-title">🎵 ${index + 1}. ${this.escapeHtml(song)}</div>
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

    async fetchLyricsImproved(songQuery) {
        try {
            // Step 1: Limpar a entrada
            let cleaned = this.cleanSongQuery(songQuery);
            
            if (!cleaned) {
                return { 
                    found: false, 
                    lyrics: `❌ Entrada inválida: "${songQuery}"` 
                };
            }

            // Step 2: Tentar múltiplos separadores e formatos
            const separators = [' - ', ' -- ', ' / ', ' de ', ' by ', '|', '–', '—'];
            const formats = this.generateSearchFormats(cleaned, separators);

            for (let format of formats) {
                const result = await this.searchLyricsAPI(format.artist, format.title);
                if (result.found) {
                    return { found: true, lyrics: result.lyrics };
                }
            }
            
            // Step 3: Se não encontrou com separadores, tenta palavra-chave única
            const singleWordResult = await this.searchLyricsAPI(cleaned, '');
            if (singleWordResult.found) {
                return { found: true, lyrics: singleWordResult.lyrics };
            }

            // Se não encontrou
            return { 
                found: false, 
                lyrics: `❌ Letra não encontrada para: "${songQuery}"\n\nTente:\n• Verificar ortografia\n• Usar formato "Artista - Título" ou "Título - Artista"\n• Procurar o nome no Google para confirmar\n\nExemplos que funcionam:\n• Nirvana - In Bloom\n• In Bloom - Nirvana\n• The Beatles - Imagine` 
            };
        } catch (error) {
            console.log('Erro ao buscar letras:', error);
            return { 
                found: false, 
                lyrics: `❌ Erro ao conectar com o servidor.\n\nVerifique sua conexão de internet.` 
            };
        }
    }

    cleanSongQuery(query) {
        // Remove números no início (1., 2., etc)
        let cleaned = query.replace(/^\d+\.\s*/, '').trim();
        
        // Remove caracteres especiais extras mas mantém separadores
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        
        return cleaned || null;
    }

    generateSearchFormats(songQuery, separators) {
        const formats = [];
        
        for (let sep of separators) {
            if (songQuery.includes(sep)) {
                const parts = songQuery.split(sep).map(p => p.trim()).filter(p => p);
                
                if (parts.length === 2) {
                    // Formato 1: primeira parte = artista, segunda = título
                    formats.push({
                        artist: parts[0],
                        title: parts[1]
                    });
                    
                    // Formato 2: invertido
                    formats.push({
                        artist: parts[1],
                        title: parts[0]
                    });
                }
            }
        }
        
        return formats;
    }

    async searchLyricsAPI(artist, title) {
        try {
            // Se apenas um termo, tenta buscar como artista com qualquer título
            if (!title || title.length === 0) {
                // Isso depende da API - lyrics.ovh precisa de ambos
                return { found: false };
            }

            const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
            const response = await fetch(url);
            
            if (response.ok) {
                const data = await response.json();
                if (data.lyrics && data.lyrics.length > 100) {
                    return { found: true, lyrics: data.lyrics };
                }
            }
            
            return { found: false };
        } catch (error) {
            console.log(`Erro ao buscar ${artist} - ${title}:`, error);
            return { found: false };
        }
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
        generateAllBtn.textContent = '⏳ Gerando... (isso pode levar um tempo)';
        
        this.generatedLyrics = [];
        let success = 0;
        let failed = 0;
        
        // Processa uma música por vez (sequencial, não paralelo!)
        for (let i = 0; i < this.playlist.length; i++) {
            const song = this.playlist[i];
            this.showLoading(true);
            
            // Aguarda cada resultado antes de passar para a próxima
            const result = await this.fetchLyricsImproved(song);
            
            // Pequeno delay para não sobrecarregar a API
            await new Promise(resolve => setTimeout(resolve, 300));
            
            this.generatedLyrics.push({
                song: song,
                lyrics: result.lyrics,
                timestamp: new Date().toLocaleTimeString(),
                status: result.found ? '✅' : '❌',
                found: result.found
            });
            
            if (result.found) success++;
            else failed++;
            
            this.showLoading(false);
            this.renderGeneratedLyrics();
            
            // Atualiza o botão com progresso
            generateAllBtn.textContent = `⏳ ${i + 1}/${this.playlist.length}`;
        }
        
        generateAllBtn.disabled = false;
        generateAllBtn.textContent = '⚡ Gerar Todas';
        this.isGeneratingAll = false;
        this.showGeneratedSection();
        
        setTimeout(() => {
            alert(`✅ ${success}/${this.playlist.length} letras encontradas\n❌ ${failed} não encontradas\n\nClique em "Ver Completo" nas com ❌ para tentar novamente.`);
        }, 500);
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
            <div class="generated-item ${item.found ? 'found' : 'not-found'}">
                <div class="generated-item-header">
                    <h3>${item.status} ${index + 1}. ${this.escapeHtml(item.song)}</h3>
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
