// --- 1. GLOBAL STATE & CONFIG ---
let currentUser = JSON.parse(localStorage.getItem("user")) || null;
let currentTopicId = null;
let currentTopicTitle = "";

// --- 2. SAYFA BAŞLATICI ---
window.onload = () => {
    updateNav();
    loadTrends();
    loadEntries();
    
    // Modal kapatma mantığı (Dışarı tıklayınca)
    window.onclick = (e) => {
        const authModal = document.getElementById('auth-modal');
        const topicModal = document.getElementById('new-topic-modal');
        if (e.target == authModal) authModal.classList.add('hidden');
        if (e.target == topicModal) topicModal.classList.add('hidden');
    };
};

// --- 3. İÇERİK YÜKLEME MOTORU ---

async function loadTrends() {
    const trendList = document.getElementById('trend-list');
    if (!trendList) return;
    try {
        const res = await fetch('/api/posts?trend=true');
        const data = await res.json();
        if (!Array.isArray(data)) return;
        trendList.innerHTML = data.map(item => `
            <div onclick="openTopic('${item._id}', '${item.title}')" 
                 class="group cursor-pointer border-b border-white/5 pb-3 pt-2 px-2 hover:bg-white/5 rounded-lg transition-all">
                <h4 class="text-[11px] font-bold text-gray-400 group-hover:text-blue-400 uppercase tracking-tighter transition-colors">
                    # ${item.title}
                </h4>
                <div class="flex items-center justify-between mt-1 text-[9px] text-gray-600 font-mono">
                    <span>${item.entryCount || 0} YAZI</span>
                    <span class="text-blue-900/60 font-black">@${item.username}</span>
                </div>
            </div>
        `).join('');
    } catch (e) { console.error("Trend hatası"); }
}

async function loadEntries() {
    const feed = document.getElementById('feed');
    const topicHeader = document.getElementById('topic-title-display');
    const entryArea = document.getElementById('entry-submission-area');
    
    currentTopicId = null;
    if (topicHeader) topicHeader.innerText = "KÜLLİYAT'A HOŞ GELDİN";
    if (entryArea) entryArea.classList.add('hidden');
    
    toggleLoader(true);
    try {
        const res = await fetch('/api/posts');
        const data = await res.json();
        const mainTopics = data.filter(item => !item.parentId);
        
        feed.innerHTML = mainTopics.map(topic => `
            <div onclick="openTopic('${topic._id}', '${topic.title}')" 
                 class="glass-panel p-6 rounded-2xl entry-card cursor-pointer border border-white/5 hover:border-blue-500/30 transition-all mb-4 group relative overflow-hidden">
                <div class="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div class="relative z-10">
                    <div class="flex items-center justify-between mb-2">
                        <h2 class="text-blue-400 font-black text-xl italic uppercase tracking-tighter"># ${topic.title}</h2>
                        <span class="text-[9px] bg-white/5 px-2 py-1 rounded text-gray-500 font-mono">@${topic.username}</span>
                    </div>
                    <p class="text-sm text-gray-400 line-clamp-2 font-light italic">"${topic.content}"</p>
                    <div class="mt-4 flex items-center text-[9px] font-black text-blue-600 tracking-[0.2em] uppercase">
                        DETAYLARI GÖR <span class="ml-2 group-hover:translate-x-2 transition-transform">→</span>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
    finally { toggleLoader(false); }
}

async function openTopic(topicId, title) {
    currentTopicId = topicId;
    currentTopicTitle = title;
    const topicHeader = document.getElementById('topic-title-display');
    const entryArea = document.getElementById('entry-submission-area');
    const feed = document.getElementById('feed');

    topicHeader.innerText = `# ${title}`;
    entryArea.classList.toggle('hidden', false);
    feed.innerHTML = ''; 
    toggleLoader(true);

    try {
        const res = await fetch(`/api/posts?topicId=${topicId}`);
        const data = await res.json();
        renderThreadedFeed(data);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { console.error(e); }
    finally { toggleLoader(false); }
}

// --- 4. CORE RENDER & THREADING ---

function renderThreadedFeed(data) {
    const feed = document.getElementById('feed');
    const entryMap = {};
    const roots = [];

    data.forEach(item => { item.children = []; entryMap[item._id] = item; });

    data.forEach(item => {
        if (item.parentId && entryMap[item.parentId] && item.parentId !== currentTopicId) {
            entryMap[item.parentId].children.push(item);
        } else {
            roots.push(item);
        }
    });

    feed.innerHTML = roots.length > 0 
        ? roots.map(renderEntry).join('') 
        : `<p class="text-gray-600 text-[10px] text-center mt-20 tracking-widest uppercase">Bu başlık henüz bakir...</p>`;
}

function renderEntry(entry) {
    const hasChildren = entry.children && entry.children.length > 0;
    const score = (entry.upvotes || 0) - (entry.downvotes || 0);

    return `
        <div class="glass-panel p-5 rounded-xl entry-card border border-white/5 mb-3 animate-in fade-in duration-500">
            <div class="flex items-center space-x-3 mb-3 text-[10px]">
                <div onclick="openProfile('${entry.username}')" class="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-700 flex items-center justify-center font-black text-white cursor-pointer shadow-lg shadow-blue-900/20">
                    ${entry.username ? entry.username[0].toUpperCase() : '?'}
                </div>
                <div class="flex flex-col">
                    <span class="text-blue-400 font-black hover:text-white transition-colors cursor-pointer" onclick="openProfile('${entry.username}')">@${entry.username}</span>
                    <span class="text-gray-600 font-mono text-[8px] uppercase">${new Date(entry.createdAt).toLocaleString('tr-TR')}</span>
                </div>
            </div>
            
            <p class="text-[13px] text-gray-300 leading-relaxed font-light">${entry.content}</p>
            
            <div class="flex items-center space-x-6 mt-4 pt-3 border-t border-white/5">
                <div class="flex items-center space-x-3 bg-black/40 px-3 py-1 rounded-full border border-white/5 text-[10px]">
                    <button onclick="castVote('${entry._id}', 'up')" class="hover:text-green-500 transition-colors">▲</button>
                    <span class="font-bold ${score < 0 ? 'text-red-500' : 'text-gray-400'}">${score}</span>
                    <button onclick="castVote('${entry._id}', 'down')" class="hover:text-red-500 transition-colors">▼</button>
                </div>
                
                <button onclick="showReplyBox('${entry._id}')" class="text-[9px] font-black text-gray-500 hover:text-blue-400 uppercase tracking-widest transition-all">
                    💬 YANITLA
                </button>

                ${hasChildren ? `
                    <button onclick="toggleThreads('${entry._id}')" id="btn-thread-${entry._id}" class="text-[9px] font-black text-blue-500/50 hover:text-blue-400 uppercase tracking-widest">
                        ▶ ${entry.children.length} YANIT
                    </button>` : ''}
            </div>

            <div id="reply-${entry._id}" class="hidden mt-4">
                <textarea id="input-${entry._id}" class="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-xs text-white outline-none focus:border-blue-600 transition-all" placeholder="Düşüncelerini buraya kus..."></textarea>
                <div class="flex justify-end mt-2 space-x-2">
                    <button onclick="showReplyBox('${entry._id}')" class="text-[9px] text-gray-600 uppercase font-bold px-2">KAPAT</button>
                    <button onclick="submitReply('${entry._id}')" class="bg-blue-600 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase shadow-lg shadow-blue-600/20">GÖNDER</button>
                </div>
            </div>

            <div id="children-${entry._id}" class="hidden mt-4 ml-6 border-l-2 border-white/5 pl-4 space-y-3">
                ${entry.children.map(renderEntry).join('')}
            </div>
        </div>
    `;
}

// --- 5. AUTH SİSTEMİ (GİRİŞ & KAYIT) ---

function showAuthModal(mode) {
    const modal = document.getElementById('auth-modal');
    const title = document.getElementById('modal-title');
    const btn = document.getElementById('auth-submit-btn');
    modal.classList.remove('hidden');
    title.innerText = mode === 'login' ? 'KÜLLİYAT\'A DÖN' : 'BİZE KATIL';
    btn.innerText = mode === 'login' ? 'GİRİŞ YAP' : 'HESAP OLUŞTUR';
    
    btn.onclick = () => {
        const user = document.getElementById('auth-user').value.trim();
        const pass = document.getElementById('auth-pass').value.trim();
        handleAuth(mode, user, pass);
    };
}

async function handleAuth(action, username, password) {
    if(!username || !password) return alert("Alanlar boş geçilemez!");
    toggleLoader(true);
    try {
        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, username, password })
        });
        const data = await res.json();
        if (res.ok) {
            if (action === 'register') {
                alert("Kayıt başarılı! Şimdi giriş yapabilirsin.");
                return showAuthModal('login');
            }
            localStorage.setItem("user", JSON.stringify(data));
            location.reload();
        } else {
            alert(data.error || "İşlem başarısız.");
        }
    } catch (err) { alert("Sunucu hatası!"); }
    finally { toggleLoader(false); }
}

function logout() {
    localStorage.removeItem("user");
    location.reload();
}

// --- 6. PROFİL YÖNETİMİ ---

async function openProfile(username) {
    const feed = document.getElementById('feed');
    const topicHeader = document.getElementById('topic-title-display');
    const entryArea = document.getElementById('entry-submission-area');

    if (entryArea) entryArea.classList.add('hidden');
    toggleLoader(true);
    topicHeader.innerText = `@${username.toUpperCase()}`;

    try {
        const res = await fetch('/api/posts');
        const data = await res.json();
        const userEntries = data.filter(e => e.username === username);
        const karma = userEntries.reduce((acc, curr) => acc + ((curr.upvotes || 0) - (curr.downvotes || 0)), 0);

        feed.innerHTML = `
            <div class="glass-panel p-10 rounded-3xl border-blue-600/20 bg-gradient-to-b from-blue-600/10 to-transparent mb-10 text-center animate-in zoom-in duration-500">
                <div class="w-24 h-24 rounded-full bg-gradient-to-br from-blue-600 to-indigo-900 mx-auto mb-4 flex items-center justify-center text-4xl font-black text-white shadow-2xl shadow-blue-600/40 border-4 border-white/5">
                    ${username[0].toUpperCase()}
                </div>
                <h2 class="text-3xl font-black text-white italic tracking-tighter uppercase">@${username}</h2>
                <p class="text-[10px] text-blue-400 font-bold mt-2 tracking-[0.4em] uppercase opacity-60 italic">Külliyat Üyesi</p>
                
                <div class="flex justify-center space-x-12 mt-8">
                    <div class="text-center group">
                        <p class="text-[9px] text-gray-500 font-black uppercase tracking-widest group-hover:text-blue-400 transition-colors">Toplam Entry</p>
                        <p class="text-3xl font-black text-white">${userEntries.length}</p>
                    </div>
                    <div class="text-center group">
                        <p class="text-[9px] text-gray-500 font-black uppercase tracking-widest group-hover:text-purple-400 transition-colors">Yazar Karması</p>
                        <p class="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">${karma}</p>
                    </div>
                </div>
            </div>
            <h3 class="text-[10px] font-black text-gray-700 mb-6 tracking-[0.5em] uppercase border-b border-white/5 pb-4 flex items-center">
                <span class="mr-4">YAZARIN ARŞİVİ</span>
                <div class="flex-1 h-px bg-white/5"></div>
            </h3>
            <div class="space-y-4">${userEntries.map(renderEntry).join('')}</div>
        `;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { console.error(e); }
    finally { toggleLoader(false); }
}

// --- 7. ETKİLEŞİMLER (POST, VOTE, UI) ---

async function submitReply(parentId) {
    const input = document.getElementById(`input-${parentId}`);
    const content = input.value.trim();
    if (!content || !currentUser) return;
    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentUser.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, parentId })
        });
        if (res.ok) {
            input.value = '';
            openTopic(currentTopicId, currentTopicTitle);
        }
    } catch (e) { console.error(e); }
}

async function castVote(entryId, type) {
    if (!currentUser) return showAuthModal('login');
    try {
        const res = await fetch('/api/votes', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentUser.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ entryId, type })
        });
        if (res.ok) {
            currentTopicId ? openTopic(currentTopicId, currentTopicTitle) : loadEntries();
        } else {
            const d = await res.json(); alert(d.error);
        }
    } catch (e) { console.error(e); }
}

function updateNav() {
    const nav = document.getElementById('auth-buttons');
    if (currentUser) {
        nav.innerHTML = `
            <div class="flex items-center space-x-6">
                <span onclick="openProfile('${currentUser.username}')" class="text-[10px] text-gray-500 hover:text-blue-400 cursor-pointer uppercase font-black tracking-widest transition-all">
                    @${currentUser.username}
                </span>
                <button onclick="logout()" class="text-[9px] text-red-500/50 hover:text-red-500 font-black uppercase tracking-tighter">ÇIKIŞ</button>
            </div>
        `;
    } else {
        nav.innerHTML = `
            <button onclick="showAuthModal('login')" class="text-[10px] font-black mr-6 hover:text-blue-500 transition-colors uppercase tracking-widest">GİRİŞ</button>
            <button onclick="showAuthModal('register')" class="bg-blue-600 text-white px-5 py-2 rounded-full text-[10px] font-black hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/30 uppercase tracking-widest">KATIL</button>
        `;
    }
}

function showReplyBox(id) { document.getElementById(`reply-${id}`).classList.toggle('hidden'); }
function toggleThreads(id) {
    const div = document.getElementById(`children-${id}`);
    const btn = document.getElementById(`btn-thread-${id}`);
    const isHidden = div.classList.toggle('hidden');
    btn.innerHTML = isHidden ? `▶ ${div.children.length} YANIT` : `▼ GİZLE`;
}
const toggleLoader = (show) => {
    const l = document.getElementById('loading');
    if(l) l.classList.toggle('hidden', !show);
};