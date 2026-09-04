/* ==========================================
   1. INITIALISIERUNG & COOKIE BANNER
   ========================================== */
document.addEventListener("DOMContentLoaded", () => {
    renderComments();
    cleanExpiredHomework();
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

function acceptCookiesNow() {
    localStorage.setItem("cookies_accepted", "true");
    const box = document.getElementById("cookieBox");
    if (box) box.remove();
    const cookieOverlay = document.getElementById("cookieModalOverlay");
    if (cookieOverlay) cookieOverlay.style.display = "none";
}

/* ==========================================
   2. DANIŞAN & ÖDEV TEMİZLİK LOGİĞİ
   ========================================== */
function getAppointments() {
    return JSON.parse(localStorage.getItem("app_appointments")) || [];
}

function saveAppointments(appointments) {
    localStorage.setItem("app_appointments", JSON.stringify(appointments));
}

function cleanExpiredHomework() {
    const clients = JSON.parse(localStorage.getItem("app_clients")) || {};
    const appointments = getAppointments();
    const now = new Date();

    Object.keys(clients).forEach(code => {
        const client = clients[code];
        if (client.homeworkDate) {
            const hwDate = new Date(client.homeworkDate);
            const diffDays = (now - hwDate) / (1000 * 3600 * 24);
            const hasPassedApp = appointments.some(app => app.clientCode === client.code && new Date(app.date) <= now && app.status === 'approved');

            if (diffDays >= 7 || hasPassedApp) {
                client.homework = "Henüz tanımlanmış ödeviniz bulunmuyor.";
                client.homeworkDate = null;
            }
        }
    });

    localStorage.setItem("app_clients", JSON.stringify(clients));
}

/* ==========================================
   3. KALENDER SYSTEM & ANZEIGELOGIK
   ========================================== */
function initCalendar(elementId, currentUserCode = null) {
    const calendarEl = document.getElementById(elementId);
    if (!calendarEl) return;

    calendarEl.innerHTML = "";

    const appointments = getAppointments();
    const isMaster = currentUserCode === 'derya' || currentUserCode === 'master';

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
            eventClick: function(info) {
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
                        deleteAppointment(app.id);
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
                        deleteAppointment(app.id);
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

function deleteAppointment(id) {
    let appointments = getAppointments();
    appointments = appointments.filter(app => app.id != id);
    saveAppointments(appointments);
    alert("✅ Randevu başarıyla iptal edildi.");
}

function handleBookingSubmit(event) {
    event.preventDefault();

    const currentCode = localStorage.getItem("currentPortalUser") || "";
    const name = document.getElementById("clientName").value.trim();
    const email = document.getElementById("clientEmail").value.trim();
    const phone = document.getElementById("clientPhone").value.trim();
    const date = document.getElementById("selectedDate").value;
    const time = document.getElementById("selectedTime").value;
    const service = document.getElementById("serviceType").value;

    const appointments = getAppointments();
    const isConflict = appointments.some(app => app.date === date && app.time === time && app.status === 'approved');

    if (isConflict) {
        alert("⚠️ Bu randevu doludur. Lütfen başka bir saat veya tarih seçiniz.");
        return;
    }

    const newAppointment = {
        id: Date.now(),
        clientCode: currentCode,
        name,
        email,
        phone,
        date,
        time,
        service,
        status: 'pending'
    };

    appointments.push(newAppointment);
    saveAppointments(appointments);

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
}

/* ==========================================
   4. PORTAL LOGIN SYSTEM
   ========================================== */
function handlePortalLogin(event) {
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

    if (code.toLowerCase() === 'derya' || code.toLowerCase() === 'master') {
        if (loginSection) loginSection.style.display = 'none';
        if (masterDashboard) masterDashboard.style.display = 'block';
        if (clientDashboard) clientDashboard.style.display = 'none';
        if (errorMsg) errorMsg.style.display = 'none';
        
        loadMasterDashboard();
        return;
    }

    const clients = JSON.parse(localStorage.getItem("app_clients")) || {};
    if (clients[code.toUpperCase()] || code.length >= 3) {
        if (loginSection) loginSection.style.display = 'none';
        if (masterDashboard) masterDashboard.style.display = 'none';
        if (clientDashboard) clientDashboard.style.display = 'block';
        if (errorMsg) errorMsg.style.display = 'none';

        loadClientDashboard(code.toUpperCase());
    } else {
        if (errorMsg) {
            errorMsg.innerText = "❌ Geçersiz giriş kodu!";
            errorMsg.style.display = 'block';
        }
    }
}

function logoutPortal() {
    localStorage.removeItem("currentPortalUser");
    document.getElementById('masterDashboard').style.display = 'none';
    document.getElementById('clientDashboard').style.display = 'none';
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('accessCode').value = '';
}

/* ==========================================
   5. MASTER DASHBOARD (DERYA KILIÇ)
   ========================================== */
function loadMasterDashboard() {
    renderPendingAppointments();
    initCalendar('masterCalendar', 'derya');
    populateClientSelect();
    renderMasterComments();
}

function renderPendingAppointments() {
    const listEl = document.getElementById("pendingAppointmentsList");
    if (!listEl) return;

    const appointments = getAppointments().filter(app => app.status === 'pending');

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
                <button onclick="approveAppointment(${app.id})" class="btn-approve" style="background:#27ae60; color:#fff; border:none; padding: 6px 12px; border-radius:4px; cursor:pointer; margin-right: 5px;">Onayla</button>
                <button onclick="rejectAppointment(${app.id})" class="btn-reject" style="background:#c0392b; color:#fff; border:none; padding: 6px 12px; border-radius:4px; cursor:pointer;">Reddet</button>
            </div>
        </div>
    `).join("");
}

function approveAppointment(id) {
    let appointments = getAppointments();
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

    appToApprove.status = 'approved';
    saveAppointments(appointments);
    renderPendingAppointments();
    initCalendar('masterCalendar', 'derya');
    alert("✅ Randevu onaylandı.");
}

function rejectAppointment(id) {
    deleteAppointment(id);
    renderPendingAppointments();
}

function addNewClient(e) {
    e.preventDefault();
    const code = document.getElementById("newClientCode").value.trim().toUpperCase();
    const name = document.getElementById("newClientName").value.trim();

    if (!code || !name) return;

    const clients = JSON.parse(localStorage.getItem("app_clients")) || {};
    clients[code] = {
        code,
        name,
        homework: "Henüz tanımlanmış ödeviniz bulunmuyor.",
        homeworkDate: null,
        payment: "0 €",
        privateNotes: ""
    };

    localStorage.setItem("app_clients", JSON.stringify(clients));
    alert(`✅ Yeni Danışan Eklendi! Kod: ${code}`);
    document.getElementById("newClientCode").value = "";
    document.getElementById("newClientName").value = "";
    populateClientSelect();
}

function deleteClientAccount() {
    const select = document.getElementById("clientSelect");
    const code = select.value;

    if (!code) return;

    if (confirm(`⚠️ ${code} kodlu danışan hesabını silmek istediğinize emin misiniz?`)) {
        const clients = JSON.parse(localStorage.getItem("app_clients")) || {};
        delete clients[code];
        localStorage.setItem("app_clients", JSON.stringify(clients));
        alert("✅ Danışan hesabı başarıyla silindi.");
        populateClientSelect();
    }
}

function populateClientSelect() {
    const select = document.getElementById("clientSelect");
    if (!select) return;

    const clients = JSON.parse(localStorage.getItem("app_clients")) || {};
    const keys = Object.keys(clients);

    if (keys.length === 0) {
        select.innerHTML = "<option value=''>Kayıtlı Danışan Yok</option>";
        return;
    }

    select.innerHTML = keys.map(k => `<option value="${k}">${clients[k].name} (${k})</option>`).join("");
    loadClientData();
}

function loadClientData() {
    const select = document.getElementById("clientSelect");
    const code = select.value;
    if (!code) return;

    const clients = JSON.parse(localStorage.getItem("app_clients")) || {};
    const client = clients[code];

    if (client) {
        const hw = document.getElementById("clientHomework");
        const pay = document.getElementById("clientPayment");
        const notes = document.getElementById("clientPrivateNotes");

        if (hw) hw.value = client.homework || "";
        if (pay) pay.value = client.payment || "";
        if (notes) notes.value = client.privateNotes || "";
    }
}

function saveClientData() {
    const select = document.getElementById("clientSelect");
    const code = select.value;
    if (!code) return;

    const clients = JSON.parse(localStorage.getItem("app_clients")) || {};
    if (clients[code]) {
        const hw = document.getElementById("clientHomework");
        const pay = document.getElementById("clientPayment");
        const notes = document.getElementById("clientPrivateNotes");

        clients[code].homework = hw ? hw.value : "";
        clients[code].homeworkDate = new Date().toISOString();
        clients[code].payment = pay ? pay.value : "";
        clients[code].privateNotes = notes ? notes.value : "";

        localStorage.setItem("app_clients", JSON.stringify(clients));
        alert("✅ Danışan bilgileri güncellendi!");
    }
}

/* ==========================================
   6. CLIENT DASHBOARD LOGIK
   ========================================== */
function loadClientDashboard(code) {
    cleanExpiredHomework();
    const clients = JSON.parse(localStorage.getItem("app_clients")) || {};
    const client = clients[code];

    const welcomeTitle = document.getElementById("clientWelcomeTitle");
    const homeworkEl = document.getElementById("displayHomework");
    const paymentEl = document.getElementById("displayPayment");
    const nameInput = document.getElementById("clientName");

    if (client) {
        if (welcomeTitle) welcomeTitle.innerText = `Hoş Geldiniz, ${client.name}`;
        if (homeworkEl) homeworkEl.innerText = client.homework || "Henüz tanımlanmış ödeviniz bulunmuyor.";
        if (paymentEl) paymentEl.innerText = client.payment || "0 €";
        if (nameInput) nameInput.value = client.name;
    } else {
        if (welcomeTitle) welcomeTitle.innerText = `Hoş Geldiniz (${code})`;
    }

    initCalendar('clientCalendar', code);
}

/* ==========================================
   7. YORUM YÖNETİMİ
   ========================================== */
function getComments() {
    return JSON.parse(localStorage.getItem("app_comments")) || [];
}

function renderComments() {
    const grid = document.getElementById("comments-grid");
    if (!grid) return;

    const comments = getComments();
    grid.innerHTML = comments.map(c => `
        <div class="comment-card">
            <div class="comment-header">
                <strong>${c.name}</strong>
                <span class="stars">${"★".repeat(c.stars)}${"☆".repeat(5 - c.stars)}</span>
            </div>
            <p>${c.text}</p>
        </div>
    `).join("");
}

function renderMasterComments() {
    const list = document.getElementById("masterCommentsList");
    if (!list) return;

    const comments = getComments();
    list.innerHTML = comments.map(c => `
        <div class="master-comment-item" style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <strong>${c.name}</strong> (${"★".repeat(c.stars)})<br>
                <small>${c.text}</small>
            </div>
            <button onclick="deleteComment(${c.id})" class="btn-delete-comment" style="background:#c0392b; color:#fff; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;"><i class="fas fa-trash"></i> Yorumu Sil</button>
        </div>
    `).join("");
}

function deleteComment(id) {
    if (confirm("Bu yorumu silmek istediğinize emin misiniz?")) {
        let comments = getComments();
        comments = comments.filter(c => c.id !== id);
        localStorage.setItem("app_comments", JSON.stringify(comments));
        renderMasterComments();
        renderComments();
        alert("✅ Yorum silindi.");
    }
}

/* ==========================================
   YENİ KOMUT: YORUM EKLEME (ADD COMMENT)
   ========================================== */
function addComment(event) {
    event.preventDefault();

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

    const newComment = {
        id: Date.now(),
        name: name,
        stars: stars,
        text: text
    };

    const comments = getComments();
    comments.unshift(newComment); // Fügt den neuen Kommentar oben an

    localStorage.setItem("app_comments", JSON.stringify(comments));

    // UI aktualisieren & Formular zurücksetzen
    renderComments();
    nameInput.value = "";
    textInput.value = "";
    starsSelect.value = "5";

    alert("✅ Yorumunuz başarıyla gönderildi ve kaydedildi!");
}

/* ==========================================
   8. INTELLIGENTER ASİSTAN CHAT (SMART KI LOGIK)
   ========================================== */
function toggleAsistanChat() {
    const modal = document.getElementById("asistanModal") || document.getElementById("assistantModal");
    if (!modal) return;
    if (modal.style.display === "none" || modal.style.display === "") {
        modal.style.display = "flex";
    } else {
        modal.style.display = "none";
    }
}

function handleAssistantSubmit(event) {
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
}

function sendAsistanMessage(event) {
    handleAssistantSubmit(event);
}

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
