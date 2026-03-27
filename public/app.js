let currentUser = JSON.parse(localStorage.getItem("user")) || null;

// Spinner Kontrolü
const toggleLoader = (show) => {
    document.getElementById('loading').classList.toggle('hidden', !show);
};

// Navigasyonu Güncelle
function updateNav() {
    const nav = document.getElementById('auth-buttons');
    if (currentUser) {
        nav.innerHTML = `
            <span class="mr-4 font-medium">Selam, ${currentUser.username}</span>
            <button onclick="logout()" class="text-red-500 text-sm">Çıkış</button>
        `;
        document.getElementById('new-topic-area').classList.remove('hidden');
    } else {
        nav.innerHTML = `
            <button onclick="showAuthModal('login')" class="mr-4 text-blue-600">Giriş</button>
            <button onclick="showAuthModal('register')" class="bg-blue-600 text-white px-4 py-1 rounded">Kayıt Ol</button>
        `;
    }
}

async function handleAuth(action, username, password) {
    toggleLoader(true);
    try {
        const res = await fetch('/api/auth', {
            method: 'POST',
            body: JSON.stringify({ action, username, password })
        });
        const data = await res.json();
        
        if (data.token) {
            localStorage.setItem("user", JSON.stringify(data));
            currentUser = data;
            location.reload(); // Basitlik için sayfayı yeniliyoruz
        } else {
            alert(data.error || data.message);
        }
    } catch (err) {
        alert("Bir hata oluştu.");
    } finally {
        toggleLoader(false);
    }
}

updateNav();

async function loadEntries() {
    toggleLoader(true);
    const res = await fetch('/api/posts');
    const data = await res.json();
    toggleLoader(false);

    const feed = document.getElementById('feed');
    feed.innerHTML = '';

    // Veriyi ağaç yapısına çevir (Dallanma mantığı)
    const entryMap = {};
    data.forEach(item => {
        item.children = [];
        entryMap[item._id] = item;
    });

    const roots = [];
    data.forEach(item => {
        if (item.parentId && entryMap[item.parentId]) {
            entryMap[item.parentId].children.push(item);
        } else {
            roots.push(item);
        }
    });

    // Ekrana bas
    feed.innerHTML = roots.map(renderEntry).join('');
}

function renderEntry(entry) {
    return `
        <div class="bg-white p-4 rounded-lg shadow-sm border mb-4">
            <div class="flex justify-between text-xs text-gray-500 mb-2">
                <span class="font-bold text-blue-500">@${entry.username}</span>
                <span>${new Date(entry.createdAt).toLocaleString('tr-TR')}</span>
            </div>
            <p class="text-gray-800">${entry.content}</p>
            
            <div class="mt-3 flex items-center space-x-4 text-sm text-gray-500">
                <button class="hover:text-blue-600">▲ ${entry.upvotes || 0}</button>
                <button class="hover:text-red-600">▼ ${entry.downvotes || 0}</button>
                <button onclick="showReplyBox('${entry._id}')" class="text-blue-500 hover:underline">Yanıtla</button>
            </div>
            
            <div id="reply-${entry._id}" class="hidden mt-4 pl-4 border-l-2 border-blue-100">
                <textarea id="input-${entry._id}" class="w-full p-2 border rounded text-sm" placeholder="Yanıtını yaz..."></textarea>
                <button onclick="submitReply('${entry._id}')" class="bg-blue-600 text-white px-3 py-1 rounded mt-2 text-xs">Gönder</button>
            </div>

            ${entry.children.length > 0 ? `
                <div class="thread-line mt-4">
                    ${entry.children.map(renderEntry).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

async function submitReply(parentId) {
    const content = document.getElementById(`input-${parentId}`).value;
    if (!content) return;

    toggleLoader(true);
    await fetch('/api/posts', {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${currentUser.token}`,
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ content, parentId })
    });
    loadEntries();
}

function showReplyBox(id) {
    const box = document.getElementById(`reply-${id}`);
    box.classList.toggle('hidden');
}

// Sayfa açıldığında verileri çek
loadEntries();

async function castVote(entryId, type) {
    if (!currentUser) return alert("Önce giriş yapmalısın!");

    // OPTIMISTIC UI: Backend'i beklemeden sayıyı görsel olarak artır
    const voteBtn = document.getElementById(`vote-${type}-${entryId}`);
    const originalText = voteBtn.innerText;
    const currentCount = parseInt(originalText.split(' ')[1]);
    voteBtn.innerText = `${type === 'up' ? '▲' : '▼'} ${currentCount + 1}`;
    voteBtn.classList.add('text-blue-600', 'font-bold');

    try {
        const res = await fetch('/api/votes', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${currentUser.token}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ entryId, type })
        });

        if (!res.ok) throw new Error("Hata");
    } catch (err) {
        // Hata olursa eski haline geri döndür
        voteBtn.innerText = originalText;
        voteBtn.classList.remove('text-blue-600', 'font-bold');
        alert("Oy verilirken bir hata oluştu (belki zaten oy verdin).");
    }
}