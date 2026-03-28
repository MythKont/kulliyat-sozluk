/**
 * KÜLLİYAT v2.0 - FULL ENGINE
 * Her şey dahil, tam kapasite sürüm.
 */

// --- 1. GLOBAL STATE ---
let currentUser = JSON.parse(localStorage.getItem("user")) || null;
let currentTopicId = null;
let currentTopicTitle = "";

// --- 2. CORE INITIALIZER ---
window.onload = () => {
    console.log("Külliyat Engine Başlatıldı...");
    updateNav();
    loadTrends();
    loadEntries();
    
    // Global Modal Kapatma (Dışarı tıklama)
    window.onclick = (event) => {
        const authModal = document.getElementById('auth-modal');
        const topicModal = document.getElementById('new-topic-modal');
        if (event.target == authModal) authModal.classList.add('hidden');
        if (event.target == topicModal) topicModal.classList.add('hidden');
    };
};

// --- 3. İÇERİK YÜKLEME VE LİSTELEME ---

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
    } catch (e) { console.error("Trend yükleme hatası", e); }
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
        
        if (Array.isArray(data)) {
            // Sadece parentId'si olmayan "Ana Başlıklar"
            const mainTopics = data.filter(item => !item.parentId);
            
            feed.innerHTML = mainTopics.map(topic => `
                <div onclick="openTopic('${topic._id}', '${topic.title}')" 
                     class="glass-panel p-6 rounded-lg entry-card cursor-pointer border border-white/5 hover:border-blue-500/50 transition-all mb-4 group">
                    <div class="flex items-center justify-between mb-2">
                        <h2 class="text-blue-400 font-black text-xl italic uppercase tracking-tighter group-hover:translate-x-1 transition-transform"># ${topic.title}</h2>
                        <span class="text-[10px] text-gray-600 font-mono uppercase">@${topic.username}</span>
                    </div>
                    <p class="text-sm text-gray-400 line-clamp-2 font-light">${topic.content}</p>
                    <div class="mt-4 flex justify-between items-center text-[9px] font-bold text-blue-500/60 uppercase">
                        GÖZ ATMAK İÇİN TIKLA →
                    </div>
                </div>
            `).join('');
        }
    } catch (e) { console.error(e); }
    finally { toggleLoader(false); }
}

async function openTopic(topicId, title) {
    currentTopicId = topicId;
    currentTopicTitle = title || "Başlıksız";

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
    } catch (e) { console.error(e); }
    finally { toggleLoader(false); }
}

// --- 4. DALLANMA (THREADING) SİSTEMİ ---

function renderThreadedFeed(data) {
    const feed = document.getElementById('feed');
    const entryMap = {};
    const roots = [];

    // Haritayı kur
    data.forEach(item => { 
        item.children = []; 
        entryMap[item._id] = item; 
    });

    // İlişkiyi bağla (En kritik kısım: naber ve iyi burada birleşiyor)
    data.forEach(item => {
        // Eğer parentId konunun ID'sinden farklıysa, bu bir yanıttır
        if (item.parentId && entryMap[item.parentId] && item.parentId !== currentTopicId) {
            entryMap[item.parentId].children.push(item);
        } else if (item.parentId === currentTopicId || !item.parentId) {
            roots.push(item);
        }
    });

    feed.innerHTML = roots.length > 0 
        ? roots.map(renderEntry).join('') 
        : `<p class="text-gray-600 text-[10px] text-center mt-10 italic">Henüz entry girilmemiş...</p>`;
}

function renderEntry(entry) {
    const hasChildren = entry.children && entry.children.length > 0;
    const score = (entry.upvotes || 0) - (entry.downvotes || 0);

    return `
        <div class="glass-panel p-4 rounded-lg entry-card border border-white/5 mb-3 transition-all">
            <div class="flex items-center space-x-2 mb-2 text-[10px]">
                <div class="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white uppercase">
                    ${entry.username ? entry.username[0] : '?'}
                </div>
                <span class="text-blue-500 font-bold cursor-pointer" onclick="openProfile('${entry.username}')">@${entry.username}</span>
                <span class="text-gray-600">• ${new Date(entry.createdAt).toLocaleString('tr-TR')}</span>
            </div>
            
            <p class="text-sm text-gray-300 leading-relaxed">${entry.content}</p>
            
            <div class="flex items-center space-x-4 mt-3 pt-3 border-t border-white/5 text-[9px] font-black">
                <div class="flex items-center space-x-2 bg-white/5 px-2 py-1 rounded">
                    <button onclick="castVote('${entry._id}', 'up')" class="hover:text-green-500 transition-colors">▲</button>
                    <span class="text-gray-400">${score}</span>
                    <button onclick="castVote('${entry._id}', 'down')" class="hover:text-red-500 transition-colors">▼</button>
                </div>
                <button onclick="showReplyBox('${entry._id}')" class="text-gray-500 hover:text-white uppercase tracking-tighter">💬 YANITLA</button>
                ${hasChildren ? `
                    <button onclick="toggleThreads('${entry._id}')" id="btn-thread-${entry._id}" class="text-blue-500/50 uppercase tracking-tighter">
                        ▶ ${entry.children.length} YANIT
                    </button>` : ''}
            </div>

            <div id="reply-${entry._id}" class="hidden mt-3 bg-black/20 p-3 rounded border border-white/5">
                <textarea id="input-${entry._id}" class="w-full bg-black/50 border border-[#222] rounded p-2 text-xs text-white outline-none focus:border-blue-600" placeholder="Yanıtını buraya bırak..."></textarea>
                <div class="flex justify-end mt-2">
                    <button onclick="submitReply('${entry._id}')" class="bg-blue-600 text-white px-4 py-1 rounded text-[10px] uppercase font-bold">GÖNDER</button>
                </div>
            </div>

            <div id="children-${entry._id}" class="hidden mt-3 ml-4 border-l-2 border-white/5 pl-4">
                ${entry.children.map(renderEntry).join('')}
            </div>
        </div>
    `;
}

// --- 5. AKSİYON FONKSİYONLARI (API) ---

async function createTopic() {
    const titleInput = document.getElementById('topic-title');
    const contentInput = document.getElementById('topic-content');
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    
    if (!title || !content) return alert("Başlık ve içerik boş bırakılamaz!");
    if (!currentUser) return alert("Başlık açmak için giriş yapmalısın!");

    toggleLoader(true);
    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${currentUser.token}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ title, content, parentId: null })
        });

        if (res.ok) {
            const result = await res.json();
            titleInput.value = ''; 
            contentInput.value = '';
            toggleNewTopicModal(); // Modalı kapat
            await loadTrends();
            openTopic(result.topicId || result._id, title); 
        } else {
            alert("Başlık oluşturulamadı.");
        }
    } catch (err) { alert("Bağlantı hatası!"); }
    finally { toggleLoader(false); }
}

async function submitEntryToTopic() {
    const input = document.getElementById('main-entry-input');
    const content = input.value.trim();
    if (!content || !currentTopicId) return;
    if (!currentUser) return alert("Giriş yapmalısın!");

    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${currentUser.token}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ content, parentId: currentTopicId })
        });
        if (res.ok) {
            input.value = '';
            openTopic(currentTopicId, currentTopicTitle);
        }
    } catch (e) { console.error(e); }
}

async function submitReply(parentId) {
    const input = document.getElementById(`input-${parentId}`);
    const content = input.value.trim();
    if (!content || !currentUser) return alert("Giriş yapmalısın!");

    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${currentUser.token}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ content, parentId })
        });
        if (res.ok) {
            input.value = '';
            openTopic(currentTopicId, currentTopicTitle);
        }
    } catch (e) { console.error(e); }
}

async function castVote(entryId, type) {
    if (!currentUser) return alert("Giriş yapmalısın!");
    try {
        const res = await fetch('/api/votes', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${currentUser.token}`, 
                'Content-Type': 'application/json' 
            },
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

// --- 6. AUTH SİSTEMİ ---

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
            if (action === 'register') {
                alert("Kayıt başarılı! Giriş yapılıyor...");
                return handleAuth('login', username, password);
            }
            localStorage.setItem("user", JSON.stringify(data));
            location.reload();
        } else {
            alert(data.error || "Hata!");
        }
    } catch (err) { alert("Sunucuya ulaşılamıyor!"); }
    finally { toggleLoader(false); }
}

function logout() {
    localStorage.removeItem("user");
    location.reload();
}

// --- 7. PROFİL VE UI YÖNETİMİ ---

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
                <div class="w-20 h-20 rounded-full bg-blue-600 mx-auto mb-4 flex items-center justify-center text-3xl font-black text-white">
                    ${username[0].toUpperCase()}
                </div>
                <h2 class="text-2xl font-black text-white uppercase italic">@${username}</h2>
                <div class="flex justify-center space-x-12 mt-6">
                    <div><p class="text-[9px] text-gray-500 font-bold uppercase">Entry</p><p class="text-xl font-black text-blue-500">${userEntries.length}</p></div>
                    <div><p class="text-[9px] text-gray-500 font-bold uppercase">Karma</p><p class="text-xl font-black text-purple-500">${karma}</p></div>
                </div>
            </div>
            <h3 class="text-[10px] font-black text-gray-600 mb-6 tracking-widest uppercase border-b border-white/5 pb-2">YAZARIN ENTRYLERİ</h3>
            <div class="space-y-4">${userEntries.map(renderEntry).join('')}</div>
        `;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { console.error(e); }
    finally { toggleLoader(false); }
}

// --- 8. MODAL VE UTILITY ---

function toggleNewTopicModal() {
    const modal = document.getElementById('new-topic-modal');
    if (modal) {
        modal.classList.toggle('hidden');
        if (!modal.classList.contains('hidden')) document.getElementById('topic-title').focus();
    }
}

function showAuthModal(mode) {
    const modal = document.getElementById('auth-modal');
    const title = document.getElementById('modal-title');
    const btn = document.getElementById('auth-submit-btn');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    title.innerText = mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol';
    btn.onclick = () => {
        const u = document.getElementById('auth-user').value;
        const p = document.getElementById('auth-pass').value;
        handleAuth(mode, u, p);
    };
}

function updateNav() {
    const nav = document.getElementById('auth-buttons');
    if (!nav) return;
    if (currentUser) {
        nav.innerHTML = `
            <span onclick="openProfile('${currentUser.username}')" class="text-xs text-gray-400 cursor-pointer uppercase font-bold">@${currentUser.username}</span>
            <button onclick="logout()" class="text-[10px] text-red-500 ml-4 font-bold uppercase">Çıkış</button>
        `;
    } else {
        nav.innerHTML = `
            <button onclick="showAuthModal('login')" class="text-[10px] font-bold mr-4 uppercase">Giriş</button>
            <button onclick="showAuthModal('register')" class="bg-white text-black px-4 py-1 rounded text-[10px] font-bold uppercase">Kayıt</button>
        `;
    }
}

function showReplyBox(id) {
    const box = document.getElementById(`reply-${id}`);
    if (box) box.classList.toggle('hidden');
}

function toggleThreads(id) {
    const div = document.getElementById(`children-${id}`);
    const btn = document.getElementById(`btn-thread-${id}`);
    const isHidden = div.classList.toggle('hidden');
    btn.innerHTML = isHidden ? `▶ ${div.children.length} YANIT` : `▼ GİZLE`;
}

function toggleLoader(show) {
    const loader = document.getElementById('loading');
    if (loader) loader.classList.toggle('hidden', !show);
}