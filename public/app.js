let currentUser = JSON.parse(localStorage.getItem("user")) || null;

// --- YARDIMCI FONKSİYONLAR ---
const toggleLoader = (show) => {
    document.getElementById('loading').classList.toggle('hidden', !show);
};

function logout() {
    localStorage.removeItem("user");
    location.reload();
}

function showAuthModal(mode) {
    const modal = document.getElementById('auth-modal');
    const title = document.getElementById('modal-title');
    const btn = document.getElementById('auth-submit-btn');
    
    modal.classList.remove('hidden');
    title.innerText = mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol';
    btn.onclick = () => {
        const u = document.getElementById('auth-user').value;
        const p = document.getElementById('auth-pass').value;
        handleAuth(mode, u, p);
    };
}

// --- AUTH İŞLEMLERİ ---
async function handleAuth(action, username, password) {
    if(!username || !password) return alert("Alanları doldur!");
    toggleLoader(true);
    try {
        const res = await fetch('/api/auth', {
            method: 'POST',
            body: JSON.stringify({ action, username, password })
        });
        const data = await res.json();
        
        if (data.token) {
            localStorage.setItem("user", JSON.stringify(data));
            location.reload();
        } else {
            alert(data.error || "Hata oluştu");
        }
    } catch (err) {
        alert("Bağlantı hatası");
    } finally {
        toggleLoader(false);
    }
}

function updateNav() {
    const nav = document.getElementById('auth-buttons');
    if (currentUser) {
        nav.innerHTML = `
            <span class="text-xs text-gray-400 flex items-center">@${currentUser.username}</span>
            <button onclick="logout()" class="text-xs bg-red-900/30 text-red-500 px-3 py-1 rounded">ÇIKIŞ</button>
        `;
        document.getElementById('new-topic-area').classList.remove('hidden');
    } else {
        nav.innerHTML = `
            <button onclick="showAuthModal('login')" class="text-xs font-bold px-3 py-1">GİRİŞ YAP</button>
            <button onclick="showAuthModal('register')" class="text-xs font-bold bg-white text-black px-3 py-1 rounded">KAYIT OL</button>
        `;
    }
}

// --- İÇERİK İŞLEMLERİ ---
async function loadEntries() {
    toggleLoader(true);
    try {
        const res = await fetch('/api/posts');
        const data = await res.json();
        
        const feed = document.getElementById('feed');
        feed.innerHTML = '';

        const entryMap = {};
        data.forEach(item => { item.children = []; entryMap[item._id] = item; });

        const roots = [];
        data.forEach(item => {
            if (item.parentId && entryMap[item.parentId]) {
                entryMap[item.parentId].children.push(item);
            } else {
                roots.push(item);
            }
        });

        feed.innerHTML = roots.map(renderEntry).join('');
    } catch (e) { console.error(e); }
    finally { toggleLoader(false); }
}

function renderEntry(entry) {
    const dateStr = new Date(entry.createdAt).toLocaleDateString('tr-TR');
    return `
        <div class="glass-panel p-4 rounded-lg entry-card transition-all">
            <div class="flex items-center space-x-3 mb-3">
                <div class="w-8 h-8 rounded-full bg-gray-800 border border-gray-700"></div>
                <div class="text-[11px]">
                    <span class="text-white font-bold">@${entry.username}</span>
                    <span class="text-gray-500 ml-2">• ${dateStr}</span>
                </div>
            </div>
            
            <p class="text-sm text-gray-300 leading-relaxed mb-4">
                ${entry.title ? `<strong class="block text-white mb-1">#${entry.title}</strong>` : ''}
                ${entry.content}
            </p>
            
            <div class="flex items-center space-x-6 text-[10px] font-bold text-gray-500">
                <div class="flex items-center space-x-2 bg-[#2a2a2a] rounded px-2 py-1">
                    <button id="vote-up-${entry._id}" onclick="castVote('${entry._id}', 'up')" class="hover:text-white transition">▲</button>
                    <span class="text-gray-300">${(entry.upvotes || 0) - (entry.downvotes || 0)}</span>
                    <button id="vote-down-${entry._id}" onclick="castVote('${entry._id}', 'down')" class="hover:text-white transition">▼</button>
                </div>
                <button onclick="showReplyBox('${entry._id}')" class="hover:text-white flex items-center">
                    <span class="mr-1">💬</span> KONUŞLAR
                </button>
                <span class="text-gray-600">KONFİRMED INFO</span>
            </div>
            
            <div id="reply-${entry._id}" class="hidden mt-4 pt-4 border-t border-[#333]">
                <textarea id="input-${entry._id}" class="w-full bg-[#121212] border border-[#444] rounded p-2 text-xs outline-none" placeholder="Yanıtını yaz..."></textarea>
                <button onclick="submitReply('${entry._id}')" class="bg-blue-600 text-white px-4 py-1 rounded mt-2 text-[10px]">GÖNDER</button>
            </div>

            ${entry.children.length > 0 ? `
                <div class="thread-line mt-4">
                    ${entry.children.map(renderEntry).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

async function createTopic() {
    const titleInput = document.getElementById('topic-title');
    const content = titleInput.value;
    if (!content) return alert("Mesaj yazmalısın!");

    toggleLoader(true);
    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentUser.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, title: content.split(' ')[0] }) // İlk kelimeyi başlık yapar
        });
        if (res.ok) { titleInput.value = ''; await loadEntries(); }
    } finally { toggleLoader(false); }
}

async function submitReply(parentId) {
    const input = document.getElementById(`input-${parentId}`);
    const content = input.value;
    if (!content) return;

    toggleLoader(true);
    try {
        await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentUser.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, parentId })
        });
        await loadEntries();
    } finally { toggleLoader(false); }
}

function showReplyBox(id) {
    document.getElementById(`reply-${id}`).classList.toggle('hidden');
}

async function castVote(entryId, type) {
    if (!currentUser) return alert("Giriş yapmalısın!");
    try {
        const res = await fetch('/api/votes', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentUser.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ entryId, type })
        });
        if (res.ok) loadEntries();
        else alert("Zaten oy verdin!");
    } catch (e) { alert("Hata!"); }
}

// Başlat
updateNav();
loadEntries();