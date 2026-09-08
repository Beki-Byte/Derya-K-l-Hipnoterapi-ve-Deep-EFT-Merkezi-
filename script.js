/* ==========================================
   FIREBASE MODULAR IMPORTS & INITIALISIERUNG
   ========================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    setDoc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBYSifQ5m7G_sdyN0JAkkC8SV6x9gY0-Oo",
    authDomain: "derya-kilic-website.firebaseapp.com",
    projectId: "derya-kilic-website",
    storageBucket: "derya-kilic-website.firebasestorage.app",
    messagingSenderId: "493728541181",
    appId: "1:493728541181:web:d361a4ca1c8dff5ed65194",
    measurementId: "G-DE18012D63"
};

// ABSICHERUNG: Falls Firebase fehlschlägt, stürzt nicht die ganze Website ab!
let app;
let db;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
} catch (e) {
    console.error("Firebase Initialisierungsfehler:", e);
}

/* ==========================================
   1. INITIALISIERUNG & COOKIE BANNER
   ========================================== */
document.addEventListener("DOMContentLoaded", () => {
    if (db) {
        renderComments();
        cleanExpiredHomework();
    }
    initCookieBanner();
});

function initCookieBanner() {
    const cookieOverlay = document.getElementById("cookieModalOverlay");
    const acceptBtn = document.getElementById("btnAcceptCookies");

    if (localStorage.getItem("cookies_accepted") === "true") {
        if (cookieOverlay) cookieOverlay.style.display = "none";
        return;
    }

    if (cookieOverlay) {
        cookieOverlay.style.display = "flex";
    } else {
        const banner = document.createElement("div");
        banner.className = "cookie-overlay-box";
        banner.id = "cookieBox";
        banner.innerHTML = `
            <div style="font-size:24px; margin-bottom:5px;">🍪</div>
            <p style="margin:0; font-size:0.88rem; color:#444;">
                Bu web sitesi deneyiminizi geliştirmek ve güvenli bir hizmet sunmak için çerezler kullanmaktadır.
            </p>
            <button onclick="acceptCookiesNow()" class="cookie-btn-accept">Kabul Et / Akzeptieren</button>
        `;
        document.body.appendChild(banner);
    }

    if (acceptBtn) {
        acceptBtn.addEventListener("click", acceptCookiesNow);
    }
}

window.acceptCookiesNow = function() {
    localStorage.setItem("cookies_accepted", "true");
    const box = document.getElementById("cookieBox");
    if (box) box.remove();
    const cookieOverlay = document.getElementById("cookieModalOverlay");
    if (cookieOverlay) cookieOverlay.style.display = "none";
};

/* ==========================================
   2. DANIŞAN & ÖDEV TEMİZLİK LOGİĞİ (FIREBASE)
   ========================================== */
async function getAppointments() {
    if (!db) return [];
    try {
        const querySnapshot = await getDocs(collection(db, "appointments"));
        return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    } catch (e) {
        console.error("Hata (getAppointments):", e);
        return [];
    }
}

async function cleanExpiredHomework() {
    if (!db) return;
    try {
        const clientsSnap = await getDocs(collection(db, "clients"));
        const appointments = await getAppointments();
        const now = new Date();

        for (const docSnap of clientsSnap.docs) {
            const client = docSnap.data();
            if (client.homeworkDate) {
                const hwDate = new Date(client.homeworkDate);
                const diffDays = (now - hwDate) / (1000 * 3600 * 24);
                const hasPassedApp = appointments.some(app => 
                    app.clientCode === client.code && 
                    new Date(app.date) <= now && 
                    app.status === 'approved'
                );

                if (diffDays >= 7 || hasPassedApp) {
                    await updateDoc(doc(db, "clients", docSnap.id), {
                        homework: "Henüz tanımlanmış ödeviniz bulunmuyor.",
                        homeworkDate: null
                    });
                }
            }
        }
    } catch (e) {
        console.error("Hata (cleanExpiredHomework):", e);
    }
}

/* ==========================================
   3. KALENDER SYSTEM & ANZEIGELOGIK
   ========================================== */
async function initCalendar(elementId, currentUserCode = null) {
    const calendarEl = document.getElementById(elementId);
    if (!calendarEl) return;

    calendarEl.innerHTML = "";

    const appointments = await getAppointments();
    const isMaster = currentUserCode === '28SENDK29' || currentUserCode === 'master';

    const events = appointments
        .filter(app => app.status === 'approved')
        .map(app => {
            const isMine = app.clientCode && currentUserCode && app.clientCode.toLowerCase() === currentUserCode.toLowerCase();
            let title = 'DOLU / Besetzt';
            let color = '#c0392b';

            if (isMaster) {
                title = `${app.name} (${app.service})`;
                color = '#8c725d';
            } else if (isMine) {
                title = `Randevunuz: ${app.service}`;
                color = '#27ae60';
            }

            return {
                id: app.id.toString(),
                title: title,
                start: `${app.date}T${app.time}`,
                color: color,
                extendedProps: app
            };
        });

    if (typeof FullCalendar !== 'undefined') {
        const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'tr',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek'
            },
            events: events,
            dateClick: function(info) {
                const dateInput = document.getElementById('selectedDate');
                if (dateInput) dateInput.value = info.dateStr;
            },
            eventClick: async function(info) {
                const app = info.event.extendedProps;
                const isMine = app.clientCode && currentUserCode && app.clientCode.toLowerCase() === currentUserCode.toLowerCase();

                if (isMaster) {
                    const confirmCancel = confirm(
                        `📅 RANDEVU DETAYLARI:\n\n` +
                        `Danışan: ${app.name}\n` +
                        `Telefon: ${app.phone}\n` +
                        `E-Posta: ${app.email}\n` +
                        `Tarih: ${app.date} Saat: ${app.time}\n` +
                        `Hizmet: ${app.service}\n\n` +
                        `Bu randevuyu iptal etmek / silmek istiyor musunuz?`
                    );
                    if (confirmCancel) {
                        await deleteAppointment(app.id);
                        initCalendar(elementId, currentUserCode);
                    }
                } else if (isMine) {
                    const confirmCancel = confirm(
                        `🟢 SİZİN RANDEVUNUZ:\n\n` +
                        `Tarih: ${app.date}\n` +
                        `Saat: ${app.time}\n` +
                        `Hizmet: ${app.service}\n\n` +
                        `Randevunuzu iptal etmek istiyor musunuz?`
                    );
                    if (confirmCancel) {
                        await deleteAppointment(app.id);
                        initCalendar(elementId, currentUserCode);
                    }
                } else {
                    alert("🔒 Bu randevu doludur.");
                }
            }
        });
        calendar.render();
    }
}

async function deleteAppointment(id) {
    if (!db) return;
    try {
        await deleteDoc(doc(db, "appointments", id));
        alert("✅ Randevu başarıyla iptal edildi.");
    } catch (e) {
        console.error("Hata (deleteAppointment):", e);
    }
}

window.handleBookingSubmit = async function(event) {
    event.preventDefault();
    if (!db) {
        alert("Datenbank ist nicht verfügbar.");
        return;
    }

    const currentCode = localStorage.getItem("currentPortalUser") || "";
    const name = document.getElementById("clientName").value.trim();
    const email = document.getElementById("clientEmail").value.trim();
    const phone = document.getElementById("clientPhone").value.trim();
    const date = document.getElementById("selectedDate").value;
    const time = document.getElementById("selectedTime").value;
    const service = document.getElementById("serviceType").value;

    const appointments = await getAppointments();
    const isConflict = appointments.some(app => app.date === date && app.time === time && app.status === 'approved');

    if (isConflict) {
        alert("⚠️ Bu randevu doludur. Lütfen başka bir saat veya tarih seçiniz.");
        return;
    }

    const newAppointment = {
        clientCode: currentCode,
        name,
        email,
        phone,
        date,
        time,
        service,
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "appointments"), newAppointment);

        const mailSubject = encodeURIComponent(`Yeni Randevu Talebi: ${name}`);
        const mailBody = encodeURIComponent(
            `Merhaba Derya Hanım,\n\nYeni bir randevu talebi oluşturuldu:\n\n` +
            `Danışan: ${name}\n` +
            `E-Posta: ${email}\n` +
            `Telefon: ${phone}\n` +
            `Tarih: ${date}\n` +
            `Saat: ${time}\n` +
            `Hizmet: ${service}\n\n` +
            `Talebi onaylamak için Yönetim Paneline giriş yapabilirsiniz.`
        );

        window.location.href = `mailto:goldensunderya@hotmail.com?subject=${mailSubject}&body=${mailBody}`;

        alert("✅ Randevu talebiniz başarıyla alındı! Derya Hanım onayladıktan sonra randevunuz takvimde kesinleşecektir.");
        document.getElementById("appointmentForm").reset();
        
        initCalendar('clientCalendar', currentCode);
    } catch (e) {
        console.error("Hata (handleBookingSubmit):", e);
        alert("⚠️ Bir hata oluştu. Lütfen tekrar deneyiniz.");
    }
};

/* ==========================================
   4. PORTAL LOGIN SYSTEM
   ========================================== */
window.handlePortalLogin = async function(event) {
    if (event) event.preventDefault();

    const input = document.getElementById('accessCode');
    const errorMsg = document.getElementById('loginError');
    const loginSection = document.getElementById('loginSection');
    const masterDashboard = document.getElementById('masterDashboard');
    const clientDashboard = document.getElementById('clientDashboard');

    if (!input) return;
    const code = input.value.trim();

    if (!code) {
        if (errorMsg) {
            errorMsg.innerText = "Lütfen bir kod giriniz.";
            errorMsg.style.display = "block";
        }
        return;
    }

    localStorage.setItem("currentPortalUser", code.toLowerCase());

    // 1. MASTER-LOGIN (Spezielle Master-Codes für deine Mutter)
    if (code.toLowerCase() === 'master' || code.toUpperCase() === '28SENDK29') {
        if (loginSection) loginSection.style.display = 'none';
        if (masterDashboard) masterDashboard.style.display = 'block';
        if (clientDashboard) clientDashboard.style.display = 'none';
        if (errorMsg) errorMsg.style.display = 'none';
        
        loadMasterDashboard();
        return;
    }

    // 2. KLIENTEN-LOGIN (Strikte Prüfung in Firestore)
    if (!db) {
        if (errorMsg) {
            errorMsg.innerText = "Verbindung zur Datenbank fehlgeschlagen.";
            errorMsg.style.display = 'block';
        }
        return;
    }

    try {
        const docRef = doc(db, "clients", code.toUpperCase());
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            if (loginSection) loginSection.style.display = 'none';
            if (masterDashboard) masterDashboard.style.display = 'none';
            if (clientDashboard) clientDashboard.style.display = 'block';
            if (errorMsg) errorMsg.style.display = 'none';

            loadClientDashboard(code.toUpperCase());
        } else {
            if (errorMsg) {
                errorMsg.innerText = "❌ Geçersiz giriş kodu! Lütfen geçerli bir kod giriniz.";
                errorMsg.style.display = 'block';
            }
        }
    } catch (e) {
        console.error("Hata (handlePortalLogin):", e);
    }
};

/* ==========================================
   5. MASTER DASHBOARD (DERYA KILIÇ)
   ========================================== */
function loadMasterDashboard() {
    renderPendingAppointments();
    initCalendar('masterCalendar', '28SENDK29');
    populateClientSelect();
    renderMasterComments();
}

async function renderPendingAppointments() {
    const listEl = document.getElementById("pendingAppointmentsList");
    if (!listEl) return;

    const appointments = (await getAppointments()).filter(app => app.status === 'pending');

    if (appointments.length === 0) {
        listEl.innerHTML = "<p class='no-data'>Bekleyen randevu talebi bulunmuyor.</p>";
        return;
    }

    listEl.innerHTML = appointments.map(app => `
        <div class="pending-item" style="padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
            <div class="pending-info">
                <strong>${app.name}</strong> (${app.service})<br>
                📅 ${app.date} - ⏰ ${app.time}<br>
                📞 ${app.phone} | ✉️ ${app.email}
            </div>
            <div class="pending-actions">
                <button onclick="approveAppointment('${app.id}')" class="btn-approve" style="background:#27ae60; color:#fff; border:none; padding: 6px 12px; border-radius:4px; cursor:pointer; margin-right: 5px;">Onayla</button>
                <button onclick="rejectAppointment('${app.id}')" class="btn-reject" style="background:#c0392b; color:#fff; border:none; padding: 6px 12px; border-radius:4px; cursor:pointer;">Reddet</button>
            </div>
        </div>
    `).join("");
}

window.approveAppointment = async function(id) {
    if (!db) return;
    try {
        const appointments = await getAppointments();
        const appToApprove = appointments.find(a => a.id === id);

        if (!appToApprove) return;

        const hasConflict = appointments.some(app => 
            app.id !== id && 
            app.date === appToApprove.date && 
            app.time === appToApprove.time && 
            app.status === 'approved'
        );

        if (hasConflict) {
            alert(`⚠️ Dikkat! ${appToApprove.date} tarihinde ve saat ${appToApprove.time} için zaten onaylanmış başka bir randevu var.`);
            return;
        }

        await updateDoc(doc(db, "appointments", id), { status: 'approved' });
        renderPendingAppointments();
        initCalendar('masterCalendar', '28SENDK29');
        alert("✅ Randevu onaylandı.");
    } catch (e) {
        console.error("Hata (approveAppointment):", e);
    }
};

window.rejectAppointment = async function(id) {
    await deleteAppointment(id);
    renderPendingAppointments();
};

window.addNewClient = async function(e) {
    e.preventDefault();
    if (!db) return;

    const code = document.getElementById("newClientCode").value.trim().toUpperCase();
    const name = document.getElementById("newClientName").value.trim();

    if (!code || !name) return;

    try {
        await setDoc(doc(db, "clients", code), {
            code,
            name,
            homework: "Henüz tanımlanmış ödeviniz bulunmuyor.",
            homeworkDate: null,
            payment: "0 €",
            privateNotes: ""
        });

        alert(`✅ Yeni Danışan Eklendi! Kod: ${code}`);
        document.getElementById("newClientCode").value = "";
        document.getElementById("newClientName").value = "";
        populateClientSelect();
    } catch (e) {
        console.error("Hata (addNewClient):", e);
    }
};

window.deleteClientAccount = async function() {
    if (!db) return;
    const select = document.getElementById("clientSelect");
    const code = select?.value;

    if (!code) return;

    if (confirm(`⚠️ ${code} kodlu danışan hesabını silmek istediğinize emin misiniz?`)) {
        try {
            await deleteDoc(doc(db, "clients", code));
            alert("✅ Danışan hesabı başarıyla silindi.");
            populateClientSelect();
        } catch (e) {
            console.error("Hata (deleteClientAccount):", e);
        }
    }
};

async function populateClientSelect() {
    const select = document.getElementById("clientSelect");
    if (!select || !db) return;

    try {
        const querySnapshot = await getDocs(collection(db, "clients"));
        if (querySnapshot.empty) {
            select.innerHTML = "<option value=''>Kayıtlı Danışan Yok</option>";
            return;
        }

        select.innerHTML = querySnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return `<option value="${docSnap.id}">${data.name} (${docSnap.id})</option>`;
        }).join("");

        loadClientData();
    } catch (e) {
        console.error("Hata (populateClientSelect):", e);
    }
}

window.loadClientData = async function() {
    const select = document.getElementById("clientSelect");
    const code = select?.value;
    if (!code || !db) return;

    try {
        const docSnap = await getDoc(doc(db, "clients", code));
        if (docSnap.exists()) {
            const client = docSnap.data();
            const hw = document.getElementById("clientHomework");
            const pay = document.getElementById("clientPayment");
            const notes = document.getElementById("clientPrivateNotes");

            if (hw) hw.value = client.homework || "";
            if (pay) pay.value = client.payment || "";
            if (notes) notes.value = client.privateNotes || "";
        }
    } catch (e) {
        console.error("Hata (loadClientData):", e);
    }
};

window.saveClientData = async function() {
    const select = document.getElementById("clientSelect");
    const code = select?.value;
    if (!code || !db) return;

    const hw = document.getElementById("clientHomework");
    const pay = document.getElementById("clientPayment");
    const notes = document.getElementById("clientPrivateNotes");

    try {
        await updateDoc(doc(db, "clients", code), {
            homework: hw ? hw.value : "",
            homeworkDate: new Date().toISOString(),
            payment: pay ? pay.value : "",
            privateNotes: notes ? notes.value : ""
        });
        alert("✅ Danışan bilgileri güncellendi!");
    } catch (e) {
        console.error("Hata (saveClientData):", e);
    }
};

/* ==========================================
   6. CLIENT DASHBOARD LOGIK
   ========================================== */
async function loadClientDashboard(code) {
    await cleanExpiredHomework();

    const welcomeTitle = document.getElementById("clientWelcomeTitle");
    const homeworkEl = document.getElementById("displayHomework");
    const paymentEl = document.getElementById("displayPayment");
    const nameInput = document.getElementById("clientName");

    if (db) {
        try {
            const docSnap = await getDoc(doc(db, "clients", code));
            if (docSnap.exists()) {
                const client = docSnap.data();
                if (welcomeTitle) welcomeTitle.innerText = `Hoş Geldiniz, ${client.name}`;
                if (homeworkEl) homeworkEl.innerText = client.homework || "Henüz tanımlanmış ödeviniz bulunmuyor.";
                if (paymentEl) paymentEl.innerText = client.payment || "0 €";
                if (nameInput) nameInput.value = client.name;
            } else {
                if (welcomeTitle) welcomeTitle.innerText = `Hoş Geldiniz (${code})`;
            }
        } catch (e) {
            console.error("Hata (loadClientDashboard):", e);
        }
    }

    initCalendar('clientCalendar', code);
}

/* ==========================================
   7. YORUM YÖNETİMİ
   ========================================== */
async function getComments() {
    if (!db) return [];
    try {
        const q = query(collection(db, "comments"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    } catch (e) {
        console.error("Hata (getComments):", e);
        return [];
    }
}

async function renderComments() {
    const grid = document.getElementById("comments-grid");
    if (!grid) return;

    const comments = await getComments();
    grid.innerHTML = comments.map(c => `
        <div class="comment-card">
            <div class="comment-header">
                <strong>${escapeHTML(c.name)}</strong>
                <span class="stars">${"★".repeat(c.stars)}${"☆".repeat(5 - c.stars)}</span>
            </div>
            <p>${escapeHTML(c.text)}</p>
        </div>
    `).join("");
}

async function renderMasterComments() {
    const list = document.getElementById("masterCommentsList");
    if (!list) return;

    const comments = await getComments();
    list.innerHTML = comments.map(c => `
        <div class="master-comment-item" style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <strong>${escapeHTML(c.name)}</strong> (${"★".repeat(c.stars)})<br>
                <small>${escapeHTML(c.text)}</small>
            </div>
            <button onclick="deleteComment('${c.id}')" class="btn-delete-comment" style="background:#c0392b; color:#fff; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;"><i class="fas fa-trash"></i> Yorumu Sil</button>
        </div>
    `).join("");
}

window.deleteComment = async function(id) {
    if (!db) return;
    if (confirm("Bu yorumu silmek istediğinize emin misiniz?")) {
        try {
            await deleteDoc(doc(db, "comments", id));
            renderMasterComments();
            renderComments();
            alert("✅ Yorum silindi.");
        } catch (e) {
            console.error("Hata (deleteComment):", e);
        }
    }
};

window.addComment = async function(event) {
    event.preventDefault();
    if (!db) {
        alert("Veritabanı bağlantısı henüz kurulamadı.");
        return;
    }

    const nameInput = document.getElementById("commentName");
    const starsSelect = document.getElementById("commentStars");
    const textInput = document.getElementById("commentText");

    if (!nameInput || !starsSelect || !textInput) return;

    const name = nameInput.value.trim();
    const stars = parseInt(starsSelect.value, 10);
    const text = textInput.value.trim();

    if (!name || !text) {
        alert("Lütfen adınızı ve yorumunuzu giriniz.");
        return;
    }

    try {
        await addDoc(collection(db, "comments"), {
            name: name,
            stars: stars,
            text: text,
            createdAt: new Date().toISOString()
        });

        renderComments();
        nameInput.value = "";
        textInput.value = "";
        starsSelect.value = "5";

        alert("✅ Yorumunuz başarıyla gönderildi ve kaydedildi!");
    } catch (e) {
        console.error("Hata (addComment):", e);
        alert("⚠️ Yorum gönderilirken bir hata oluştu.");
    }
};

/* ==========================================
   8. INTELLIGENTER ASİSTAN CHAT (SMART KI LOGIK)
   ========================================== */
window.toggleAsistanChat = function() {
    const modal = document.getElementById("asistanModal") || document.getElementById("assistantModal");
    if (!modal) return;
    if (modal.style.display === "none" || modal.style.display === "") {
        modal.style.display = "flex";
    } else {
        modal.style.display = "none";
    }
};

window.handleAssistantSubmit = function(event) {
    event.preventDefault();
    const input = document.getElementById("asistanMsgInput") || document.getElementById("assistantInput");
    const chatBox = document.getElementById("asistanChatBody") || document.getElementById("assistantChatBox");
    
    if (!input || !chatBox) return;

    const text = input.value.trim();
    if (!text) return;

    // Nachricht des Nutzers anzeigen
    const userDiv = document.createElement("div");
    userDiv.className = "msg user-msg message";
    userDiv.style.cssText = "background: #8c6a56; color: white; padding: 8px 12px; border-radius: 8px; margin-bottom: 10px; text-align: right; margin-left: 20px; font-size: 14px;";
    userDiv.innerText = text;
    chatBox.appendChild(userDiv);

    input.value = "";
    chatBox.scrollTop = chatBox.scrollHeight;

    // KI-Antwort generieren und nach kurzer Verzögerung anzeigen
    setTimeout(() => {
        const botReply = generateAssistantReply(text);
        
        const botDiv = document.createElement("div");
        botDiv.className = "msg bot-msg message";
        botDiv.style.cssText = "background: #e8dfd8; color: #333; padding: 8px 12px; border-radius: 8px; margin-bottom: 10px; font-size: 14px; line-height: 1.4;";
        botDiv.innerText = botReply;
        chatBox.appendChild(botDiv);

        chatBox.scrollTop = chatBox.scrollHeight;
    }, 600);
};

window.sendAsistanMessage = function(event) {
    handleAssistantSubmit(event);
};

function generateAssistantReply(query) {
    const q = query.toLowerCase().trim();

    // A. HYPNOSE & ÄNGSTE
    if (q.includes("çıkama") || q.includes("cikama") || q.includes("kalır mıyım") || q.includes("kalir miyim")) {
        return "Kesinlikle hayır. Hipnoz derin bir gevşeme halidir ve uyku değildir. İstediğiniz an gözlerinizi açıp hipnozdan çıkabilirsiniz. Hipnozda takılı kalmak gibi bir durum tıbben ve psikolojik olarak mümkün değildir.";
    }

    if (q.includes("bilinç") || q.includes("bilinc") || q.includes("kayıp") || q.includes("kayip") || q.includes("kontrol")) {
        return "Hayır, ne Hipnozda ne de Deep EFT çalışmalarında bilincinizi veya kontrolünüzü kaybetmezsiniz. Tüm süreç boyunca ne konuştuğunuzun farkında olursunuz ve kontrol tamamen sizdedir.";
    }

    if (q.includes("sır") || q.includes("sir") || q.includes("istemediğim") || q.includes("istemedigim")) {
        return "Hipnoz esnasında istemediğiniz hiçbir şeyi söylemezsiniz veya yapmazsınız. Zihniniz ve etik değerleriniz sizi her zaman korur.";
    }

    if (q.includes("zarar") || q.includes("yan etki") || q.includes("tehlikeli")) {
        return "Hipnoz ve Deep EFT tamamen doğal ve güvenli yöntemlerdir. Hiçbir yan etkisi veya tehlikesi yoktur. Sadece derin bir zihinsel ve bedensel rahatlama sağlarsınız.";
    }

    // B. CODE VERGESSEN / UNUTTUM (NEU)
    if (q.includes("unuttum") || q.includes("kaybettim") || q.includes("şifre") || q.includes("sifre") || q.includes("hatırlamıyorum") || q.includes("hatirlamiyorum")) {
        return "Giriş kodunuzu unuttuysanız endişelenmeyin! Bize WhatsApp veya Instagram DM üzerinden adınız ve soyadınızla ulaşırsanız, kodunuzu size hemen tekrar iletebiliriz.";
    }

    // C. SEANS & METHODEN
    if (q.includes("hipnoz") || q.includes("hypnose")) {
        return "Hipnoterapi seans ücreti 170 €'dur. Hipnoz, bilinçaltınızdaki olumsuz inançları ve blokajları dönüştürmek için kullanılan son derece etkili ve güvenli bir yöntemdir.";
    }

    if (q.includes("eft") || q.includes("deep eft")) {
        return "Deep EFT seansları saatlik 65 €'dur. Bedenimizdeki enerji meridyenlerine hafif dokunuşlar yaparak geçmiş travmaları ve duygusal yükleri serbest bırakma yöntemidir.";
    }

    // D. ÜCRET & ÖDEME
    if (q.includes("ucret") || q.includes("fiyat") || q.includes("preis") || q.includes("kosten") || q.includes("ödeme") || q.includes("odeme") || q.includes("paypal")) {
        return "Hipnoterapi seans ücreti 170 €'dur. Deep EFT ve diğer seanslar ise saatlik 65 €'dur. Ödemelerinizi Ödeme sayfamız üzerinden PayPal ile gerçekleştirebilirsiniz.";
    }

    // E. CODE / PORTAL ALLGEMEIN
    if (q.includes("kod") || q.includes("giris") || q.includes("giriş") || q.includes("portal")) {
        return "Danışan portalı giriş kodunuz seansınız onaylandıktan sonra size özel olarak iletilir. Kodunuzu unuttuysanız veya ilk defa randevu alıyorsanız bize WhatsApp veya DM üzeri ulaşabilirsiniz.";
    }

    // F. RANDEVU
    if (q.includes("randevu") || q.includes("termin") || q.includes("seans")) {
        return "Randevu almak için Danışan Portalı üzerinden uygun tarih ve saati seçebilirsiniz. İlk defa randevu alıyorsanız bize WhatsApp veya DM üzeri ulaşabilirsiniz.";
    }

    // G. SELAMLAMA / TEŞEKKÜR
    if (q.includes("merhaba") || q.includes("selam") || q.includes("hallo")) {
        return "Merhaba! Derya Kılıç Sanal Asistanına hoş geldiniz. Terapi yöntemleri, randevu süreci veya aklınıza takılan sorular hakkında bana danışabilirsiniz. İlk defa randevu alıyorsanız bize WhatsApp veya DM üzeri ulaşabilirsiniz.";
    }

    if (q.includes("teşekkür") || q.includes("tesekkur") || q.includes("sağol") || q.includes("danke")) {
        return "Rica ederim! Aklınıza takılan başka bir soru olursa her zaman buradayım.";
    }

    // H. DEFAULT FALLBACK
    return "Size nasıl yardımcı olabilirim? Terapi seansları (Hipnoz/EFT), randevular, giriş kodları ve ücretlerimiz hakkında soru sorabilirsiniz. İlk defa randevu alıyorsanız bize WhatsApp veya DM üzeri ulaşabilirsiniz.";
}

function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

/* ==========================================
   LOGOUT FUNKTION (Gilt für Master & Klienten)
   ========================================== */
window.logoutPortal = function() {
    // 1. Alle Login-Informationen aus dem Browserspeicher löschen
    localStorage.removeItem("currentPortalUser");
    localStorage.removeItem("portalAccessCode");
    sessionStorage.removeItem("portalAccessCode");
    localStorage.removeItem("currentUserRole");

    // 2. Dashboards im Fenster direkt ausblenden
    const masterDash = document.getElementById("masterDashboard");
    const clientDash = document.getElementById("clientDashboard");
    const loginSec = document.getElementById("portalLoginSection") || document.getElementById("loginSection");

    if (masterDash) masterDash.style.display = "none";
    if (clientDash) clientDash.style.display = "none";
    if (loginSec) loginSec.style.display = "block";

    // 3. Zur Startseite umleiten
    window.location.href = "index.html";
};
