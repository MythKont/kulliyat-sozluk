// --- GLOBAL DEĞİŞKENLER ---
let currentUser = JSON.parse(localStorage.getItem("user")) || null;
let lastCheckTime = Date.now();
let newPostsCount = 0;
let currentTopicId = null;
let currentTopicTitle = "";

// --- SAYFA BAŞLATICI ---
window.onload = () => {
    updateNav();
    loadTrends();
    loadEntries(); // İlk açılışta genel akışı getir
};

// --- İÇERİK YÜKLEME FONKSİYONLARI ---

async function loadTrends() {
    const trendList = document.getElementById('trend-list');
    if (!trendList) return;

    try {
        const res = await fetch('/api/posts?trend=true');
        const data = await res.json();

        if (!Array.isArray(data)) return;

        trendList.innerHTML = data.map(item => `
            <div onclick="openTopic('${item._id}', '${item.title}')" 
                 class="group cursor-pointer border-b border-white/5 pb-3 pt-2 px-2 hover:bg-white/5 rounded transition-all">
                <h4 class="text-[11px] font-bold text-gray-300 group-hover:text-blue-400 uppercase tracking-tighter">
                    # ${item.title}
                </h4>
                <div class="flex items-center justify-between mt-1 text-[9px] text-gray-600 font-mono">
                    <span>${item.entryCount || 0} ENTRY</span>
                    <span class="text-blue-900">@${item.username}</span>
                </div>
            </div>
        `).join('');
    } catch (e) { console.error("Trend yüklenemedi", e); }
}

async function loadEntries() {
    const feed = document.getElementById('feed');
    const topicHeader = document.getElementById('topic-title-display');
    const entryArea = document.getElementById('entry-submission-area');
    
    currentTopicId = null; // Genel akıştayız
    if (topicHeader) topicHeader.innerText = "KÜLLİYAT'A HOŞ GELDİN";
    if (entryArea) entryArea.classList.add('hidden');
    
    toggleLoader(true);
    try {
        const res = await fetch('/api/posts');
        const data = await res.json();
        if (Array.isArray(data)) renderThreadedFeed(data);
    } catch (e) { console.error("Yükleme hatası:", e); }
    finally { toggleLoader(false); }
}

async function openTopic(topicId, title) {
    currentTopicId = topicId;
    currentTopicTitle = title || "Başlıksız Konu";

    const topicHeader = document.getElementById('topic-title-display');
    const entryArea = document.getElementById('entry-submission-area');
    const feed = document.getElementById('feed');

    if (topicHeader) topicHeader.innerText = `# ${currentTopicTitle}`;
    if (entryArea) entryArea.classList.remove('hidden');
    
    feed.innerHTML = ''; 
    toggleLoader(true);

    try {
        const res = await fetch(`/api/posts?topicId=${topicId}`);
        const data = await res.json();
        if (Array.isArray(data)) renderThreadedFeed(data);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { console.error("Konu yükleme hatası:", e); }
    finally { toggleLoader(false); }
}

// --- CORE RENDER MANTIĞI ---

function renderThreadedFeed(data) {
    const feed = document.getElementById('feed');
    const entryMap = {};
    const roots = [];

    data.forEach(item => { 
        item.children = []; 
        entryMap[item._id] = item; 
    });

    data.forEach(item => {
        if (item.parentId && entryMap[item.parentId] && item.parentId !== currentTopicId) {
            entryMap[item.parentId].children.push(item);
        } else {
            roots.push(item);
        }
    });

    feed.innerHTML = roots.length > 0 
        ? roots.map(renderEntry).join('') 
        : `<p class="text-gray-600 text-[10px] text-center mt-10 italic">Burası henüz ıssız...</p>`;
}

function renderEntry(entry) {
    const dateStr = new Date(entry.createdAt).toLocaleDateString('tr-TR');
    const hasChildren = entry.children && entry.children.length > 0;
    const score = (entry.upvotes || 0) - (entry.downvotes || 0);

    return `
        <div class="glass-panel p-4 rounded-lg entry-card transition-all mb-2 border border-white/5">
            <div class="flex items-center space-x-3 mb-3">
                <div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                    ${entry.username.substring(0, 1)}
                </div>
                <div class="text-[11px]">
                    <span onclick="openProfile('${entry.username}')" class="text-white font-bold cursor-pointer hover:text-blue-400">@${entry.username}</span>
                    <span class="text-gray-500 ml-2">• ${dateStr}</span>
                </div>
            </div>
            <div class="mb-4">
                ${entry.title ? `<h2 class="text-blue-400 font-bold text-base mb-2"># ${entry.title}</h2>` : ''}
                <p class="text-sm text-gray-300 leading-relaxed font-light">${entry.content}</p>
            </div>
            <div class="flex items-center space-x-6 text-[10px] font-bold text-gray-500 border-t border-white/5 pt-3">
                <div class="flex items-center space-x-2 bg-white/5 rounded-md px-2 py-1">
                    <button onclick="castVote('${entry._id}', 'up')" class="hover:text-green-500">▲</button>
                    <span class="text-gray-300">${score}</span>
                    <button onclick="castVote('${entry._id}', 'down')" class="hover:text-red-500">▼</button>
                </div>
                <button onclick="showReplyBox('${entry._id}')" class="hover:text-white flex items-center">
                    <span class="mr-1 text-blue-500">💬</span> YANITLA
                </button>
                ${hasChildren ? `
                    <button onclick="toggleThreads('${entry._id}')" id="btn-thread-${entry._id}" class="text-blue-500/80">
                        <span class="mr-1">▶</span> ${entry.children.length} YANIT
                    </button>
                ` : ''}
            </div>
            <div id="reply-${entry._id}" class="hidden mt-4 pt-4 border-t border-white/5">
                <textarea id="input-${entry._id}" class="w-full bg-black/40 border border-[#333] rounded p-3 text-xs text-gray-200 outline-none focus:border-blue-500" placeholder="Yanıtın nedir?"></textarea>
                <div class="flex justify-end mt-2 space-x-2">
                    <button onclick="submitReply('${entry._id}')" class="bg-blue-600 text-white px-5 py-1.5 rounded-full text-[10px]">GÖNDER</button>
                </div>
            </div>
            <div id="children-${entry._id}" class="hidden thread-line mt-4">
                ${entry.children.map(renderEntry).join('')}
            </div>
        </div>
    `;
}

// --- AKSİYON FONKSİYONLARI ---

async function createTopic() {
    const titleInput = document.getElementById('topic-title');
    const contentInput = document.getElementById('topic-content');
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    
    if (!title || !content) return alert("Boş bırakılamaz!");
    if (!currentUser) return alert("Giriş yapmalısın!");

    toggleLoader(true);
    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentUser.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, parentId: null })
        });

        if (res.ok) {
            const result = await res.json();
            titleInput.value = ''; contentInput.value = '';
            toggleNewTopicModal();
            await loadTrends();
            openTopic(result.topicId || result._id, title); 
        }
    } catch (err) { alert("Bağlantı hatası!"); }
    finally { toggleLoader(false); }
}

async function submitEntryToTopic() {
    const input = document.getElementById('main-entry-input');
    const content = input.value.trim();
    if (!content || !currentTopicId) return;

    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentUser.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, parentId: currentTopicId })
        });
        if (res.ok) {
            input.value = '';
            openTopic(currentTopicId, currentTopicTitle);
            loadTrends();
        }
    } catch (e) { alert("Hata oluştu."); }
}

async function submitReply(parentId) {
    const input = document.getElementById(`input-${parentId}`);
    const content = input.value.trim();
    if (!content) return;

    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentUser.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, parentId: parentId })
        });
        if (res.ok) {
            input.value = '';
            currentTopicId ? openTopic(currentTopicId, currentTopicTitle) : loadEntries();
        }
    } catch (e) { alert("Gönderilemedi."); }
}

async function openProfile(username) {
    const feed = document.getElementById('feed');
    const topicHeader = document.getElementById('topic-title-display');
    const entryArea = document.getElementById('entry-submission-area');

    if (entryArea) entryArea.classList.add('hidden');
    toggleLoader(true);
    topicHeader.innerText = `@${username} profili`;

    try {
        const res = await fetch('/api/posts');
        const data = await res.json();
        const userEntries = data.filter(e => e.username === username);
        const karma = userEntries.reduce((acc, curr) => acc + ((curr.upvotes || 0) - (curr.downvotes || 0)), 0);

        feed.innerHTML = `
            <div class="glass-panel p-8 rounded-2xl border-blue-600/20 bg-gradient-to-b from-blue-600/5 to-transparent mb-10 text-center">
                <div class="w-20 h-20 rounded-full bg-blue-600 mx-auto mb-4 flex items-center justify-center text-3xl font-black shadow-lg shadow-blue-600/20">
                    ${username.substring(0, 1).toUpperCase()}
                </div>
                <h2 class="text-2xl font-black text-white italic tracking-tighter uppercase">@${username}</h2>
                <div class="flex justify-center space-x-8 mt-6">
                    <div class="text-center">
                        <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Entry</p>
                        <p class="text-xl font-black text-blue-500">${userEntries.length}</p>
                    </div>
                    <div class="text-center">
                        <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Karma</p>
                        <p class="text-xl font-black text-purple-500">${karma}</p>
                    </div>
                </div>
            </div>
            <h3 class="text-[10px] font-black text-gray-600 mb-6 tracking-[0.3em] uppercase border-b border-white/5 pb-2">YAZARIN İZLERİ</h3>
            <div class="space-y-6">${userEntries.map(renderEntry).join('')}</div>
        `;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { console.error(e); }
    finally { toggleLoader(false); }
}

// --- YARDIMCI ARAÇLAR ---

function toggleNewTopicModal() {
    const modal = document.getElementById('new-topic-modal');
    if (modal) {
        modal.classList.toggle('hidden');
        if (!modal.classList.contains('hidden')) document.getElementById('topic-title').focus();
    }
}

function showReplyBox(id) { document.getElementById(`reply-${id}`).classList.toggle('hidden'); }

function toggleThreads(id) {
    const div = document.getElementById(`children-${id}`);
    const btn = document.getElementById(`btn-thread-${id}`);
    div.classList.toggle('hidden');
    btn.innerHTML = div.classList.contains('hidden') ? `<span class="mr-1">▶</span> Yanıtları gör` : `<span class="mr-1">▼</span> Gizle`;
}

const toggleLoader = (show) => document.getElementById('loading').classList.toggle('hidden', !show);

function updateNav() {
    const nav = document.getElementById('auth-buttons');
    if (currentUser) {
        nav.innerHTML = `
            <span onclick="openProfile('${currentUser.username}')" class="text-xs text-gray-400 cursor-pointer hover:text-white transition-colors uppercase font-bold tracking-widest">@${currentUser.username}</span>
            <button onclick="logout()" class="text-[10px] bg-red-900/20 text-red-500 px-3 py-1 rounded ml-3 hover:bg-red-900/40 transition-all font-bold">ÇIKIŞ</button>
        `;
    } else {
        nav.innerHTML = `
            <button onclick="showAuthModal('login')" class="text-[10px] font-bold px-3 py-1 hover:text-blue-500 uppercase tracking-widest">GİRİŞ YAP</button>
            <button onclick="showAuthModal('register')" class="text-[10px] font-bold bg-white text-black px-4 py-1.5 rounded uppercase tracking-widest hover:bg-gray-200 transition-all">KAYIT OL</button>
        `;
    }
}

function logout() { localStorage.removeItem("user"); location.reload(); }

async function castVote(entryId, type) {
    if (!currentUser) return alert("Giriş yapmalısın!");
    try {
        const res = await fetch('/api/votes', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentUser.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ entryId, type })
        });
        if (res.ok) {
            currentTopicId ? openTopic(currentTopicId, currentTopicTitle) : loadEntries();
            loadTrends();
        } else {
            const data = await res.json();
            alert(data.error || "Oylama başarısız.");
        }
    } catch (e) { alert("Hata oluştu."); }
}

function showAuthModal(mode) {
    const modal = document.getElementById('auth-modal');
    const title = document.getElementById('modal-title');
    const btn = document.getElementById('auth-submit-btn');
    modal.classList.remove('hidden');
    title.innerText = mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol';
    btn.onclick = () => handleAuth(mode, document.getElementById('auth-user').value, document.getElementById('auth-pass').value);
}

async function handleAuth(action, username, password) {
    if(!username || !password) return alert("Alanları doldur!");
    toggleLoader(true);
    try {
        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, username, password })
        });
        const data = await res.json();
        if (res.ok) {
            if (action === 'register') return handleAuth('login', username, password);
            localStorage.setItem("user", JSON.stringify(data));
            location.reload();
        } else alert(data.error);
    } catch (err) { alert("Hata!"); }
    finally { toggleLoader(false); }
}