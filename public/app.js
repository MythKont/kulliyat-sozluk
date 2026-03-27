let currentUser = JSON.parse(localStorage.getItem("user")) || null;
let lastCheckTime = Date.now();
let newPostsCount = 0;
let selectedTopicId = null;
let currentTopicId = null;
let currentTopicTitle = "";

async function loadTrends() {
    const trendList = document.getElementById('trend-list');
    if (!trendList) return; // Element yoksa hata vermemesi için

    try {
        const res = await fetch('/api/posts?trend=true');
        const data = await res.json();

        // Veri liste değilse (hata mesajı geldiyse) durdur
        if (!Array.isArray(data)) {
            console.error("Gelen veri liste değil:", data);
            return;
        }

        trendList.innerHTML = data.map(item => `
            <div onclick="openTopic('${item._id}', '${item.title}')" 
                 class="group cursor-pointer border-b border-white/5 pb-3 pt-2 px-2 hover:bg-white/5 rounded transition-all">
                <h4 class="text-[11px] font-bold text-gray-300 group-hover:text-blue-400 uppercase tracking-tighter">
                    # ${item.title}
                </h4>
                <div class="flex items-center justify-between mt-1 text-[9px] text-gray-600 font-mono">
                    <span>${item.entryCount || item.replyCount || 0} ENTRY</span>
                    <span class="text-blue-900">@${item.username}</span>
                </div>
            </div>
        `).join('');
    } catch (e) { 
        console.error("Trend yüklenemedi", e); 
    }
}

async function openTopic(topicId, title) {
    // 1. Global değişkenleri güncelle (Hangi konudayız bilelim)
    currentTopicId = topicId;
    currentTopicTitle = title || "Başlıksız Konu";

    // 2. HTML elementlerini yakala
    const topicHeader = document.getElementById('topic-title-display');
    const entryArea = document.getElementById('entry-submission-area');
    const feed = document.getElementById('feed');

    // 3. Görsel hazırlık: Başlığı yaz ve Entry kutusunu aç
    if (topicHeader) topicHeader.innerText = `# ${currentTopicTitle}`;
    if (entryArea) entryArea.classList.remove('hidden');
    
    feed.innerHTML = ''; // Eski konuyu temizle
    toggleLoader(true);

    try {
        // 4. Backend'den sadece bu konunun entry'lerini getir
        const res = await fetch(`/api/posts?topicId=${topicId}`);
        const data = await res.json();

        if (Array.isArray(data) && data.length > 0) {
            // Dallanma (Thread) mantığını koruyarak render et
            const entryMap = {};
            data.forEach(item => { item.children = []; entryMap[item._id] = item; });
            const roots = [];
            data.forEach(item => {
                if (item.parentId && entryMap[item.parentId] && item.parentId !== topicId) {
                    entryMap[item.parentId].children.push(item);
                } else {
                    roots.push(item);
                }
            });
            feed.innerHTML = roots.map(renderEntry).join('');
        } else {
            feed.innerHTML = `<p class="text-gray-600 text-[10px] text-center mt-10 italic">Bu başlık henüz boş, ilk entry'i sen gir!</p>`;
        }

        // 5. Sayfayı en üste yumuşakça kaydır
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (e) {
        console.error("Konu yükleme hatası:", e);
        feed.innerHTML = `<p class="text-red-500 text-xs text-center mt-10">Konu yüklenirken bir hata oluştu.</p>`;
    } finally {
        toggleLoader(false);
    }
}

// 2. KONU AÇMA (BURADA KONU AÇILINCA DİREKT İÇİNE GİRİYORUZ)
async function createTopic() {
    const titleInput = document.getElementById('topic-title');
    const contentInput = document.getElementById('topic-content');
    
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    
    if (!title || !content) return alert("Başlık ve ilk entry boş olamaz!");
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
            titleInput.value = '';
            contentInput.value = '';
            // PANALİ KAPAT
            document.getElementById('new-topic-area').classList.add('hidden');
            
            // YENİ AÇILAN KONUYA GİT
            await loadTrends();
            openTopic(result.topicId, title); 
        }
    } catch (err) { alert("Bağlantı hatası!"); }
    finally { toggleLoader(false); }
}

// 4. KONUYA ENTRY GİR (SADECE MESAJ)
async function submitEntryToTopic() {
    const input = document.getElementById('main-entry-input');
    const content = input.value.trim();
    
    if (!content || !currentTopicId) return alert("Boş entry girilemez!");
    if (!currentUser) return alert("Önce giriş yapmalısın!");

    toggleLoader(true);
    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentUser.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, parentId: currentTopicId })
        });

        if (res.ok) {
            input.value = '';
            // Konuyu yenile
            openTopic(currentTopicId, currentTopicTitle);
            loadTrends(); // Sayı güncellensin
        }
    } catch (e) { alert("Gönderilemedi."); }
    finally { toggleLoader(false); }
}

// 3. Konuya Yorum At (Başlık Yazma Yeri Olmadan!)
async function submitMainReply() {
    const input = document.getElementById('main-reply-input');
    const content = input.value.trim();
    
    if (!content || !currentTopicId) return;
    if (!currentUser) return alert("Giriş yapmalıs itsin!");

    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentUser.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, parentId: currentTopicId }) // Konuya bağla
        });

        if (res.ok) {
            input.value = '';
            openTopic(currentTopicId, currentTopicTitle); // Sayfayı güncelle
            loadTrends(); // Yorum sayısı arttığı için trendleri de güncelle
        }
    } catch (e) { alert("Hata oluştu."); }
}

// SAYFA İLK AÇILDIĞINDA
window.onload = () => {
    updateNav();
    loadTrends(); // Önce sağ tarafı doldur
    // İstersen en popüler konuyu otomatik açtırabilirsin:
    // fetch('/api/posts?trend=true').then(r => r.json()).then(d => openTopic(d[0]._id));
};

// Akıllı Polling: Her 30 saniyede bir yeni post var mı diye kontrol et
setInterval(checkNewPosts, 5000);

async function checkNewPosts() {
    if (document.hidden) return; 

    try {
        // Sadece son kontrol zamanından sonrasını soruyoruz
        const res = await fetch(`/api/posts?since=${lastCheckTime}`);
        const data = await res.json();
        
        if (data && data.length > 0) {
            // Sadece başkalarının attığı postları say (opsiyonel ama daha iyi hissettirir)
            const othersPosts = data.filter(p => p.username !== currentUser?.username);
            
            if (othersPosts.length > 0) {
                newPostsCount += othersPosts.length;
                showNewPostAlert();
            }
        }
        // Zaman damgasını her kontrolde güncelle ki aynı şeyleri tekrar sormayalım
        lastCheckTime = Date.now();
    } catch (e) { console.log("Canlı kontrol hatası"); }
}

function showNewPostAlert() {
    let alertBox = document.getElementById('new-post-alert');
    if (!alertBox) {
        alertBox = document.createElement('div');
        alertBox.id = 'new-post-alert';
        // Görseldeki tasarıma uygun, yüzen mavi bir buton
        alertBox.className = "fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white px-6 py-2 rounded-full shadow-2xl cursor-pointer font-bold text-[10px] animate-bounce border border-blue-400";
        document.body.appendChild(alertBox);
    }
    alertBox.innerHTML = `✨ ${newPostsCount} YENİ GÖNDERİ VAR`;
    alertBox.onclick = () => {
        newPostsCount = 0;
        alertBox.remove();
        loadEntries(); 
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
}

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
        
        if (res.ok) {
            // EĞER KAYIT BAŞARILIYSA: Hemen otomatik giriş yap
            if (action === 'register') {
                return handleAuth('login', username, password); 
            }
            
            // EĞER GİRİŞ BAŞARILIYSA: Token'ı kaydet ve sayfayı yenile
            if (data.token) {
                localStorage.setItem("user", JSON.stringify(data));
                location.reload();
            }
        } else {
            alert(data.error || "İşlem sırasında bir hata oluştu");
        }
    } catch (err) {
        alert("Bağlantı hatası oluştu.");
    } finally {
        toggleLoader(false);
    }
}

function updateNav() {
    const nav = document.getElementById('auth-buttons');
    if (currentUser) {
        nav.innerHTML = `
            <span class="text-xs text-gray-400 flex items-center">@${currentUser.username}</span>
            <button onclick="logout()" class="text-xs bg-red-900/30 text-red-500 px-3 py-1 rounded ml-2">ÇIKIŞ</button>
        `;
        // BURADAKİ classList.remove('hidden') SATIRINI SİLDİK!
    } else {
        nav.innerHTML = `
            <button onclick="showAuthModal('login')" class="text-xs font-bold px-3 py-1">GİRİŞ YAP</button>
            <button onclick="showAuthModal('register')" class="text-xs font-bold bg-white text-black px-3 py-1 rounded">KAYIT OL</button>
        `;
    }
}

// --- İÇERİK İŞLEMLERİ ---
async function loadEntries() {
    // Balon tıklandığında veya sayfa yenilendiğinde sayaçları sıfırla
    newPostsCount = 0;
    lastCheckTime = Date.now(); 

    const feed = document.getElementById('feed');
    // Eğer içerik boşsa yükleme animasyonunu göster
    if (feed.innerHTML === '') toggleLoader(true);

    try {
        const res = await fetch('/api/posts');
        const data = await res.json();
        
        // GÜVENLİK KONTROLÜ: Eğer gelen veri bir liste (array) değilse durdur
        if (!Array.isArray(data)) {
            console.error("Gelen veri liste değil:", data);
            feed.innerHTML = `<p class="text-gray-500 text-center text-xs mt-10">Henüz bir gönderi yok veya bir bağlantı sorunu var.</p>`;
            return;
        }

        const entryMap = {};
        const roots = [];

        // 1. Adım: Tüm verileri haritaya yerleştir ve çocuk listelerini hazırla
        data.forEach(item => { 
            item.children = []; 
            entryMap[item._id] = item; 
        });

        // 2. Adım: Dallanma (Thread) mantığını kur
        data.forEach(item => {
            if (item.parentId && entryMap[item.parentId]) {
                // Eğer bir ebeveyni varsa, onun çocuklarına ekle
                entryMap[item.parentId].children.push(item);
            } else {
                // Ebeveyni yoksa bu bir ana konudur
                roots.push(item);
            }
        });

        // 3. Adım: Ekrana bas
        feed.innerHTML = roots.map(renderEntry).join('');

    } catch (e) {
        console.error("Yükleme hatası:", e);
        feed.innerHTML = `<p class="text-red-500 text-center text-xs mt-10">Veriler yüklenirken bir hata oluştu.</p>`;
    } finally {
        toggleLoader(false);
    }
}

function renderEntry(entry) {
    const dateStr = new Date(entry.createdAt).toLocaleDateString('tr-TR');
    const hasChildren = entry.children && entry.children.length > 0;

    return `
        <div class="glass-panel p-4 rounded-lg entry-card transition-all mb-2 border border-white/5">
            <div class="flex items-center space-x-3 mb-3">
                <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                    ${entry.username.substring(0, 1)}
                </div>
                <div class="text-[11px]">
                    <span class="text-white font-bold cursor-pointer hover:text-blue-400 transition">@${entry.username}</span>
                    <span class="text-gray-500 ml-2">• ${dateStr}</span>
                </div>
            </div>
            
            <div class="mb-4">
                ${entry.title ? `<h2 class="text-blue-400 font-bold text-base mb-2 tracking-tight"># ${entry.title}</h2>` : ''}
                <p class="text-sm text-gray-300 leading-relaxed font-light">
                    ${entry.content}
                </p>
            </div>
            
            <div class="flex items-center space-x-6 text-[10px] font-bold text-gray-500 border-t border-white/5 pt-3">
                <div class="flex items-center space-x-2 bg-white/5 rounded-md px-2 py-1 border border-white/5">
                    <button onclick="castVote('${entry._id}', 'up')" class="hover:text-green-500 transition-colors">▲</button>
                    <span class="text-gray-300 min-w-[12px] text-center">${(entry.upvotes || 0) - (entry.downvotes || 0)}</span>
                    <button onclick="castVote('${entry._id}', 'down')" class="hover:text-red-500 transition-colors">▼</button>
                </div>
                
                <button onclick="showReplyBox('${entry._id}')" class="hover:text-white flex items-center transition-colors">
                    <span class="mr-1 text-xs text-blue-500">💬</span> YANITLA
                </button>

                ${hasChildren ? `
                    <button onclick="toggleThreads('${entry._id}')" id="btn-thread-${entry._id}" class="text-blue-500/80 hover:text-blue-400 flex items-center transition-colors">
                        <span class="mr-1">▶</span> ${entry.children.length} YANIT
                    </button>
                ` : ''}
            </div>
            
            <div id="reply-${entry._id}" class="hidden mt-4 pt-4 border-t border-white/5 animate-fade-in">
                <textarea id="input-${entry._id}" 
                    class="w-full bg-black/40 border border-[#333] rounded p-3 text-xs text-gray-200 outline-none focus:border-blue-500/50 transition-all min-h-[80px]" 
                    placeholder="Düşüncelerini paylaş..."></textarea>
                <div class="flex justify-end mt-2 space-x-2">
                    <button onclick="showReplyBox('${entry._id}')" class="text-[9px] text-gray-500 px-3 uppercase">Vazgeç</button>
                    <button onclick="submitReply('${entry._id}')" class="bg-blue-600 hover:bg-blue-500 text-white px-5 py-1.5 rounded-full text-[10px] shadow-lg shadow-blue-600/20 transition-all uppercase tracking-tighter">Gönder</button>
                </div>
            </div>

            ${hasChildren ? `
                <div id="children-${entry._id}" class="hidden thread-line mt-4">
                    ${entry.children.map(renderEntry).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

function toggleThreads(id) {
    const threadDiv = document.getElementById(`children-${id}`);
    const btn = document.getElementById(`btn-thread-${id}`);
    const isHidden = threadDiv.classList.contains('hidden');

    if (isHidden) {
        threadDiv.classList.remove('hidden');
        btn.innerHTML = `<span class="mr-1">▼</span> Yanıtları gizle`;
    } else {
        threadDiv.classList.add('hidden');
        // Orijinal yanıt sayısını korumak için buton metnini tekrar hesaplatabiliriz 
        // veya basitçe eski haline döndürebiliriz:
        btn.innerHTML = `<span class="mr-1">▶</span> Yanıtları gör`;
    }
}

async function createTopic() {
    const titleInput = document.getElementById('topic-title');
    const contentInput = document.getElementById('topic-content');
    
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    
    if (!title || !content) return alert("Başlık ve içerik girmelisin!");
    if (!currentUser) return alert("Önce giriş yapmalısın!");

    toggleLoader(true);
    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${currentUser.token}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ 
                title: title, 
                content: content,
                parentId: null // Bu bir ana konudur
            })
        });

        if (res.ok) {
            titleInput.value = ''; 
            contentInput.value = '';
            // 1. Sağ taraftaki listeyi güncelle (Yeni konu orada görünsün)
            await loadTrends(); 
            // 2. Kullanıcıyı otomatik olarak yeni açtığı konuya sok (Şık olur)
            const result = await res.json();
            if(result.topicId) openTopic(result.topicId); 
            else location.reload(); // Alternatif: sayfayı yenile
        } else {
            const err = await res.json();
            alert(err.error || "Konu açılamadı.");
        }
    } catch (err) {
        alert("Bağlantı hatası!");
    } finally {
        toggleLoader(false);
    }
}

async function submitReply(parentId) {
    const input = document.getElementById(`input-${parentId}`);
    const content = input.value.trim();
    if (!content) return;
    if (!currentUser) return alert("Giriş yapmalısın!");

    toggleLoader(true);
    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${currentUser.token}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ 
                content: content, 
                parentId: parentId // Hangi mesaja yanıt veriliyorsa onun ID'si
            })
        });

        if (res.ok) {
            input.value = '';
            // Konuyu tekrar yükle ki yeni yanıtı görelim
            if (selectedTopicId) openTopic(selectedTopicId);
        }
    } catch (e) {
        alert("Mesaj gönderilemedi.");
    } finally { 
        toggleLoader(false); 
    }
}

function showReplyBox(id) {
    document.getElementById(`reply-${id}`).classList.toggle('hidden');
}

async function castVote(entryId, type) {
    if (!currentUser) return alert("Oy vermek için giriş yapmalısın!");
    
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
            // Oylama başarılıysa:
            // 1. Orta alanı tazele (Puanın değiştiğini görsün)
            if (selectedTopicId) openTopic(selectedTopicId);
            // 2. Sağ taraftaki trend listesini tazele (Sıralama değişmiş olabilir)
            loadTrends();
        } else {
            const data = await res.json();
            alert(data.error || "Zaten oy verdin!");
        }
    } catch (e) { 
        alert("Oylama sırasında bir hata oluştu."); 
    }
}

// Başlat
updateNav();
loadEntries();

async function submitEntryToTopic() {
    const input = document.getElementById('main-entry-input');
    const content = input.value.trim();
    
    if (!content || !currentTopicId) return alert("İçerik boş olamaz!");
    if (!currentUser) return alert("Entry girmek için giriş yapmalısın!");

    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${currentUser.token}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ 
                content: content, 
                parentId: currentTopicId // Konunun ID'sini veriyoruz ki "ana entry" olsun
            })
        });

        if (res.ok) {
            input.value = '';
            // Konuyu tazele ki yeni entry'ni gör
            openTopic(currentTopicId, currentTopicTitle);
            // Sağ tarafı güncelle (Entry sayısı arttı, trend değişebilir)
            loadTrends();
        }
    } catch (e) { alert("Entry gönderilemedi."); }
}

// createTopic fonksiyonunun içine (başarılı olduğu kısma) şunu da ekle:
// res.ok olduğunda paneli tekrar kapatalım
if (res.ok) {
    // ... diğer kodların ...
    document.getElementById('new-topic-area').classList.add('hidden');
    // ...
}

// Sayfa ilk yüklendiğinde her şeyi kontrol altına alalım
window.addEventListener('DOMContentLoaded', () => {
    const newTopicArea = document.getElementById('new-topic-area');
    if (newTopicArea) {
        // ZORLA GİZLE: Eğer 'hidden' yoksa ekle
        newTopicArea.classList.add('hidden');
    }
});

// Sayfa yüklendiğinde yapılacaklar
window.onload = () => {
    updateNav();
    loadTrends();
    loadEntries();
    
    // Sayfa açılışında panelin kapalı olduğundan emin olalım
    const area = document.getElementById('new-topic-area');
    if (area) area.classList.add('hidden');
};

// Paneli açıp kapatan TEK fonksiyon
function toggleNewTopicArea() {
    const area = document.getElementById('new-topic-area');
    if (area) {
        area.classList.toggle('hidden');
        if (!area.classList.contains('hidden')) {
            document.getElementById('topic-title').focus();
        }
    }
}