javascript
const TelegramBot = require('node-telegram-bot-api');

// Configurazione
const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = '827798574'; // Chat ID di @dinobronzi82
const CHANNEL_ID = '@OpenMicsITA'; // Canale per eventi
const VERSION = '23.01';

if (!TOKEN) {
    console.error('❌ ERRORE: BOT_TOKEN non trovato!');
    process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// Database
let eventi = [];
const userStats = {};
const bannedUsers = [];
const goldMembers = [];
const superAdmins = [];
const userStates = {};

// Categorie eventi
const categorieEventi = new Map([
    ['S', { nome: 'Serata Stand-up', icona: '🎤' }],
    ['F', { nome: 'Festival', icona: '🎪' }],
    ['W', { nome: 'Corso/Workshop', icona: '📚' }],
    ['P', { nome: 'Podcast/Video', icona: '🎥' }]
]);

// Utility functions
const isAdmin = (chatId) => chatId.toString() === ADMIN_ID;
const isSuperAdmin = (chatId) => superAdmins.includes(chatId.toString());
const isGoldMember = (chatId) => goldMembers.includes(chatId.toString());
const hasAdminPowers = (chatId) => isAdmin(chatId) || isSuperAdmin(chatId);
const resetUserState = (chatId) => delete userStates[chatId];
const setUserState = (chatId, state, data = {}) => {
    userStates[chatId] = { state, data, lastActivity: new Date() };
};
const isBanned = (chatId) => bannedUsers.includes(chatId.toString());

// Funzione per inviare messaggi con gestione degli errori
async function sendMessage(chatId, text, options = {}) {
    try {
        await bot.sendMessage(chatId, text, options);
    } catch (error) {
        console.error(`Errore invio messaggio a ${chatId}: ${error.message}`);
    }
}

// 📺 FUNZIONE POSTING CANALE
async function postToChannel(evento) {
    try {
        const categoria = categorieEventi.get(evento.categoria);
        if (!categoria) {
            console.error(`Categoria non valida: ${evento.categoria}`);
            return false;
        }

        let messaggioCanale;
        if (evento.categoria === 'P') {
            messaggioCanale = `🎥 NUOVO CONTENUTO!

${categoria.icona} ${categoria.nome}
🎬 ${evento.titolo}
${evento.link ? `🔗 ${evento.link}` : ''}

Per inserire eventi: @OpenMicsITA`;
        } else {
            const tipo = evento.tipo === 'Gratuito' ? '🆓' : '💰';
            messaggioCanale = `🎭 NUOVO EVENTO COMEDY!

${categoria.icona} ${categoria.nome}
📅 ${evento.data} - ${evento.ora}
🎪 ${evento.titolo}
🏢 ${evento.nomeLocale}
${evento.indirizzoVia ? `📍 ${evento.indirizzoVia}` : ''}
📍 ${evento.cittaProvincia}
🎤 Posti disponibili: ${evento.postiComici}
${evento.organizzatoreInfo ? `👨‍🎤 Organizzatore: ${evento.organizzatoreInfo}` : ''}
${tipo} ${categoria.nome}

Per inserire eventi: @OpenMicsITA`;
        }

        if (evento.locandina) {
            await bot.sendPhoto(CHANNEL_ID, evento.locandina, { caption: messaggioCanale });
        } else {
            await bot.sendMessage(CHANNEL_ID, messaggioCanale);
        }

        console.log(`📺 Evento postato nel canale: ${evento.titolo}`);
        return true;
    } catch (error) {
        console.error(`❌ Errore posting canale: ${error.message}`);
        return false;
    }
}

// 🚫 Controllo Ban
function checkBan(chatId) {
    if (isBanned(chatId)) {
        sendMessage(chatId, '🚫 Sei stato escluso dall\'utilizzo del bot.\n\nPer informazioni: zibroncloud@gmail.com');
        return true;
    }
    return false;
}

// ⚠️ Controllo Limite Eventi Giornaliero
function checkDailyLimit(chatId) {
    const oggi = new Date().toDateString();

    let limiteEventi = 2; // Limite predefinito
    if (hasAdminPowers(chatId)) {
        limiteEventi = 15;
    } else if (isGoldMember(chatId)) {
        limiteEventi = 10;
    }

    userStats[chatId] = userStats[chatId] || {
        eventiCreati: 0,
        eventiOggi: 0,
        ultimaData: null,
        ultimoEvento: null,
        primoUso: new Date().toISOString(),
        ultimoUso: new Date().toISOString()
    };

    if (userStats[chatId].ultimaData !== oggi) {
        userStats[chatId].eventiOggi = 0;
        userStats[chatId].ultimaData = oggi;
    }

    if (userStats[chatId].eventiOggi >= limiteEventi) {
        sendMessage(chatId, `⚠️ Limite giornaliero raggiunto!\n\n🚫 Puoi creare massimo ${limiteEventi} eventi al giorno.\n⏰ Riprova domani.\n\n📧 Per necessità particolari: zibroncloud@gmail.com`);
        return false;
    }

    return true;
}

// Traccia l'attività dell'utente
function trackUserActivity(chatId, action) {
    const oggi = new Date().toDateString();

    userStats[chatId] = userStats[chatId] || {
        eventiCreati: 0,
        eventiOggi: 0,
        ultimaData: null,
        ultimoEvento: null,
        primoUso: new Date().toISOString(),
        ultimoUso: new Date().toISOString()
    };

    userStats[chatId].ultimoUso = new Date().toISOString();

    if (action === 'creaevento') {
        userStats[chatId].eventiCreati++;
        userStats[chatId].eventiOggi++;
        userStats[chatId].ultimoEvento = new Date().toISOString();
    }
}

// Pulisce gli eventi scaduti
function pulisciEventiScaduti() {
    const unaSettimanaFa = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
    const eventiPrima = eventi.length;

    eventi = eventi.filter(evento => {
        if (evento.categoria === 'P') return true;
        const dataEvento = parseDate(evento.data);
        return dataEvento >= unaSettimanaFa;
    });

    if (eventiPrima !== eventi.length) {
        console.log(`Rimossi ${eventiPrima - eventi.length} eventi scaduti`);
    }
}

// Funzione di utilità per parsare la data
function parseDate(dateString) {
    const [g, m, a] = dateString.split('/');
    return new Date(a, m - 1, g);
}

// Pulisce gli stati utente inattivi
function pulisciStatiInattivi() {
    const quindiMinutiFa = new Date(Date.now() - (15 * 60 * 1000));
    for (const chatId in userStates) {
        if (userStates.hasOwnProperty(chatId) && userStates[chatId]?.lastActivity < quindiMinutiFa) {
            delete userStates[chatId];
        }
    }
}

// Intervalli per pulizia
const EVENTI_CHECK_INTERVAL = 60 * 60 * 1000; // 1 ora
const STATI_CHECK_INTERVAL = 15 * 60 * 1000;  // 15 minuti

setInterval(pulisciEventiScaduti, EVENTI_CHECK_INTERVAL);
setInterval(pulisciStatiInattivi, STATI_CHECK_INTERVAL);

// 📊 COMANDI ADMIN
bot.onText(/\/stats/, (msg) => {
    const chatId = msg.chat.id;
    if (!hasAdminPowers(chatId)) return;

    const eventiAttivi = eventi.filter(e => e.categoria === 'P' || parseDate(e.data) >= new Date());
    const oggi = new Date().toDateString();
    const eventiOggi = eventi.filter(e => new Date(e.dataCreazione).toDateString() === oggi).length;

    const statsMessage = `📊 Stats Bot v.${VERSION}:
🎭 Eventi: ${eventi.length} (${eventiAttivi.length} attivi)
👥 Utenti: ${Object.keys(userStats).length}
🚫 Utenti bannati: ${bannedUsers.length}
🏆 GOLDMember: ${goldMembers.length}
🕺🏻 SUPERadmin: ${superAdmins.length}
📈 Oggi: ${eventiOggi} nuovi eventi`;

    sendMessage(chatId, statsMessage);
});

// 🚫 COMANDI BAN
bot.onText(/\/ban (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!hasAdminPowers(chatId)) return;

    const targetId = match[1].trim().toString();

    if (targetId === ADMIN_ID) {
        sendMessage(chatId, '🛡️ Non puoi bannare l\'admin principale!');
        return;
    }

    if (isSuperAdmin(targetId) && !isAdmin(chatId)) {
        sendMessage(chatId, '🛡️ Solo l\'admin principale può bannare altri SUPERadmin!');
        return;
    }

    if (bannedUsers.includes(targetId)) {
        sendMessage(chatId, `⚠️ Utente ${targetId} già bannato`);
        return;
    }

    bannedUsers.push(targetId);
    sendMessage(chatId, `🚫 Utente ${targetId} bannato con successo!\n\n📋 Totale ban: ${bannedUsers.length}`);
});

bot.onText(/\/unban (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!hasAdminPowers(chatId)) return;

    const targetId = match[1].trim().toString();
    const index = bannedUsers.indexOf(targetId);

    if (index === -1) {
        sendMessage(chatId, `⚠️ Utente ${targetId} non è bannato`);
        return;
    }

    bannedUsers.splice(index, 1);
    sendMessage(chatId, `✅ Utente ${targetId} sbannato con successo!\n\n📋 Totale ban: ${bannedUsers.length}`);
});

bot.onText(/\/banlist/, (msg) => {
    const chatId = msg.chat.id;
    if (!hasAdminPowers(chatId)) return;

    if (bannedUsers.length === 0) {
        sendMessage(chatId, '📋 Nessun utente bannato');
        return;
    }

    const lista = bannedUsers.map((id, i) => `${i + 1}. ${id}`).join('\n');
    sendMessage(chatId, `🚫 Utenti bannati (${bannedUsers.length}):\n\n${lista}`);
});

// 🏆 COMANDI GOLDMEMBER
bot.onText(/\/gold (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!hasAdminPowers(chatId)) return;

    const targetId = match[1].trim().toString();

    if (goldMembers.includes(targetId)) {
        sendMessage(chatId, `⚠️ Utente ${targetId} già GOLDMember 🏆`);
        return;
    }

    goldMembers.push(targetId);
    sendMessage(chatId, `🏆 Utente ${targetId} promosso a GOLDMember!\n\n📋 Totale GOLD: ${goldMembers.length}`);
});

bot.onText(/\/ungold (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!hasAdminPowers(chatId)) return;

    const targetId = match[1].trim().toString();
    const index = goldMembers.indexOf(targetId);

    if (index === -1) {
        sendMessage(chatId, `⚠️ Utente ${targetId} non è GOLDMember`);
        return;
    }

    goldMembers.splice(index, 1);
    sendMessage(chatId, `✅ Utente ${targetId} rimosso da GOLDMember!\n\n📋 Totale GOLD: ${goldMembers.length}`);
});

// 🕺🏻 COMANDI SUPERADMIN
bot.onText(/\/addsuper (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    const targetId = match[1].trim().toString();

    if (superAdmins.includes(targetId)) {
        sendMessage(chatId, `⚠️ Utente ${targetId} già SUPERadmin 🕺🏻`);
        return;
    }

    superAdmins.push(targetId);
    sendMessage(chatId, `🕺🏻 Utente ${targetId} promosso a SUPERadmin!\n\n📋 Totale SUPER: ${superAdmins.length}`);
});

bot.onText(/\/removesuper (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    const targetId = match[1].trim().toString();
    const index = superAdmins.indexOf(targetId);

    if (index === -1) {
        sendMessage(chatId, `⚠️ Utente ${targetId} non è SUPERadmin`);
        return;
    }

    superAdmins.splice(index, 1);
    sendMessage(chatId, `✅ Utente ${targetId} rimosso da SUPERadmin!\n\n📋 Totale SUPER: ${superAdmins.length}`);
});

// 📱 COMANDI PUBBLICI
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    if (checkBan(chatId)) return;

    resetUserState(chatId);
    trackUserActivity(chatId, 'start');

    const startMessage = `🎭 Bot Standup Comedy v.${VERSION} 🎤
da @dinobronzi82 - Eventi comedy in Italia!

🎯 Comandi:
/cerca - Cerca eventi per provincia
/crea - Crea nuovo evento
/mieieventi - I tuoi eventi
/modificaevento - Modifica data evento
/cancellaevento - Cancella evento
/ultimi - Ultimi 20 eventi
/donazioni - Sostieni il progetto
/help - Guida completa

🎪 Categorie: 🎤 Serata • 🎪 Festival • 📚 Workshop • 🎥 Podcast/Video
📸 Nuova funzione: Locandine eventi!
📺 Tutti gli eventi su: t.me/OpenMicsITA
🚀 Sempre online 24/7!

📧 Per problemi, complimenti e suggerimenti:
zibroncloud@gmail.com 😉`;

    sendMessage(chatId, startMessage);
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    if (checkBan(chatId)) return;

    resetUserState(chatId);

    const helpMessage = `🎭 Guida Bot Comedy v.${VERSION}

🔍 Ricerca eventi:
• Sigla provincia: MI, RM, TO
• Nome città: Milano, Roma, Torino
• Zone Milano/Roma: Milano Nord, Roma Centro

🎪 Categorie:
🎤 Serata Stand-up - Serate comedy
🎪 Festival - Festival e rassegne
📚 Corso/Workshop - Corsi e workshop
🎥 Podcast/Video - Contenuti digitali

📺 Novità v.23.01:
• Nuova categoria Podcast/Video!
• Tutti gli eventi pubblicati su t.me/OpenMicsITA
• Locandine eventi
• Limite eventi: 2 normali, 10 GOLD 🏆, 15 admin
• Date eventi: solo da oggi ai prossimi 60 giorni

⚡ Note:
• Eventi eliminati dopo 1 settimana (tranne Podcast/Video)
• Roma/Milano divise in zone
• /annulla per interrompere operazioni
• Tutti gli eventi su: t.me/OpenMicsITA

📧 Per problemi, complimenti e suggerimenti:
zibroncloud@gmail.com 😉`;

    sendMessage(chatId, helpMessage);
});

bot.onText(/\/cerca/, (msg) => {
    const chatId = msg.chat.id;
    if (checkBan(chatId)) return;

    setUserState(chatId, 'cerca');
    sendMessage(chatId, 'Scrivi provincia/città per cercare eventi:\n\nEs: MI, Milano, Roma Nord, TO\n\n/annulla per uscire');
});

bot.onText(/\/crea/, (msg) => {
    const chatId = msg.chat.id;
    if (checkBan(chatId)) return;

    if (!checkDailyLimit(chatId)) {
        return;
    }

    setUserState(chatId, 'creacategoria');
    trackUserActivity(chatId, 'iniziocreazione');

    sendMessage(chatId, 'Che tipo di contenuto vuoi pubblicare?', {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🎤 Serata Stand-up', callback_data: 'categoriaS' }],
                [{ text: '🎪 Festival', callback_data: 'categoriaF' }],
                [{ text: '📚 Corso/Workshop', callback_data: 'categoriaW' }],
                [{ text: '🎥 Podcast/Video', callback_data: 'categoriaP' }]
            ]
        }
    });
});

bot.onText(/\/mieieventi/, (msg) => {
    const chatId = msg.chat.id;
    if (checkBan(chatId)) return;

    resetUserState(chatId);
    pulisciEventiScaduti();

    const mieiEventi = eventi.filter(e => e.creatoDa === chatId).sort((a, b) => {
        if (a.categoria === 'P' || b.categoria === 'P') return 0;
        return parseDate(a.data) - parseDate(b.data);
    });

    if (mieiEventi.length === 0) {
        sendMessage(chatId, '❌ Nessun contenuto creato. Usa /crea per iniziare!');
        return;
    }

    let messaggio = `🎭 I tuoi contenuti (${mieiEventi.length}):\n\n`;
    mieiEventi.forEach((evento, i) => {
        const categoria = categorieEventi.get(evento.categoria);
        const fotoIcon = evento.locandina ? '📸' : '';

        if (evento.categoria === 'P') {
            messaggio += `${i + 1}. ${fotoIcon}\n🎬 ${evento.titolo}\n${categoria.icona} ${categoria.nome}\n\n`;
        } else {
            messaggio += `${i + 1}. ${evento.data} - ${evento.ora} ${fotoIcon}\n🎪 ${evento.titolo}\n🏢 ${evento.nomeLocale}\n📍 ${evento.cittaProvincia}\n${categoria.icona} ${categoria.nome}\n\n`;
        }
    });

    const oggi = new Date().toDateString();
    const eventiOggi = userStats[chatId]?.eventiOggi || 0;

    let limiteEventi = 2;
    if (hasAdminPowers(chatId)) {
        limiteEventi = 15;
    } else if (isGoldMember(chatId)) {
        limiteEventi = 10;
    }

    messaggio += `📊 Contenuti creati oggi: ${eventiOggi}/${limiteEventi}`;

    sendMessage(chatId, messaggio);
});

bot.onText(/\/ultimi/, (msg) => {
    const chatId = msg.chat.id;
    if (checkBan(chatId)) return;

    resetUserState(chatId);
    pulisciEventiScaduti();

    if (eventi.length === 0) {
        sendMessage(chatId, '🎭 Nessun contenuto. Pubblica il primo!');
        return;
    }

    const ultimi = eventi.sort((a, b) => new Date(b.dataCreazione) - new Date(a.dataCreazione)).slice(0, 20);

    let messaggio = `🆕 Ultimi ${ultimi.length} contenuti:\n\n`;
    ultimi.forEach((evento, i) => {
        const categoria = categorieEventi.get(evento.categoria);
        const fotoIcon = evento.locandina ? '📸' : '';

        if (evento.categoria === 'P') {
            messaggio += `${i + 1}. ${fotoIcon}\n🎬 ${evento.titolo}\n${categoria.icona}\n\n`;
        } else {
            const tipo = evento.tipo === 'Gratuito' ? '🆓' : '💰';
            messaggio += `${i + 1}. ${evento.data} - ${evento.ora} ${fotoIcon}\n🎪 ${evento.titolo}\n🏢 ${evento.nomeLocale}\n📍 ${evento.cittaProvincia}\n${tipo} ${categoria.icona}\n\n`;
        }
    });

    sendMessage(chatId, messaggio);
});

bot.onText(/\/modificaevento/, (msg) => {
    const chatId = msg.chat.id;
    if (checkBan(chatId)) return;

    const mieiEventi = eventi.filter(e => e.creatoDa === chatId && e.categoria !== 'P');

    if (mieiEventi.length === 0) {
        resetUserState(chatId);
        sendMessage(chatId, '❌ Nessun evento da modificare. Usa /crea!');
        return;
    }

    setUserState(chatId, 'modificaselezione');
    sendMessage(chatId, 'Numero evento da modificare (1,2,3...):\n\nUsa /mieieventi per la lista');
});

bot.onText(/\/cancellaevento/, (msg) => {
    const chatId = msg.chat.id;
    if (checkBan(chatId)) return;

    const mieiEventi = eventi.filter(e => e.creatoDa === chatId);

    if (mieiEventi.length === 0) {
        resetUserState(chatId);
        sendMessage(chatId, '❌ Nessun contenuto da cancellare. Usa /crea!');
        return;
    }

    setUserState(chatId, 'cancellaselezione');
    sendMessage(chatId, 'Numero contenuto da cancellare (1,2,3...):\n\nUsa /mieieventi per la lista');
});

bot.onText(/\/donazioni|\/caffè|\/caffe/, (msg) => {
    const chatId = msg.chat.id;
    if (checkBan(chatId)) return;

    resetUserState(chatId);
    sendMessage(chatId, `☕ Sostieni il progetto!\n\n💰 Revolut: https://revolut.me/r/ZDIdqlisIP\n\nGrazie! 🙏 Ogni donazione aiuta a migliorare il bot.\n\n🎭 Continua a far ridere l'Italia!`);
});

bot.onText(/\/annulla/, (msg) => {
    const chatId = msg.chat.id;
    if (checkBan(chatId)) return;

    resetUserState(chatId);
    sendMessage(chatId, '✅ Operazione annullata.');
});

// 🎯 GESTIONE CALLBACK
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    try {
        if (checkBan(chatId)) {
            return bot.answerCallbackQuery(query.id);
        }

        if (data.startsWith('categoria')) {
            const categoria = data.split('')[1];
            const userState = userStates[chatId] || { data: {} };
            userState.data.categoria = categoria;

            if (categoria === 'P') {
                setUserState(chatId, 'creatitolopodcast', userState.data);
                return sendMessage(chatId, '🎬 Titolo Podcast/Video:\n\nEs: "Episodio 5 - Intervista a..."');
            } else {
                setUserState(chatId, 'creadata', userState.data);
                return sendMessage(chatId, 'Data evento (GG/MM/AAAA):\n\nEs: 25/12/2024\n\n⚠️ Solo eventi da oggi ai prossimi 60 giorni');
            }
        }

        if (data === 'tipogratuito' || data === 'tipopagamento') {
            const evento = userStates[chatId]?.data;
            if (!evento) return;

            evento.tipo = data === 'tipogratuito' ? 'Gratuito' : 'A pagamento';
            setUserState(chatId, 'crealocandina', evento);

            return sendMessage(chatId, '📸 Vuoi aggiungere una locandina?\n\n📷 Invia una foto oppure scrivi "skip" per saltare', {
                reply_markup: {
                    inline_keyboard: [[{ text: '⏭️ Salta locandina', callback_data: 'skiplocandina' }]]
                }
            });
        }

        if (data === 'skiplocandina') {
            const evento = userStates[chatId]?.data;
            if (!evento) return;

            evento.locandina = null;
            await finalizeEventCreation(chatId, evento);
            return;
        }

        if (data === 'skiplocandinapodcast') {
            const evento = userStates[chatId]?.data;
            if (!evento) return;

            evento.locandina = null;
            await finalizeEventCreation(chatId, evento);
            return;
        }

        if (data.startsWith('cancellanum')) {
            const num = parseInt(data.split('')[2]);
            const mieiEventi = eventi.filter(e => e.creatoDa === chatId);
            const evento = mieiEventi[num - 1];

            if (evento) {
                eventi = eventi.filter(e => e.id !== evento.id); // Rimuove l'evento dall'array
                const message = evento.categoria === 'P' ? `✅ Contenuto cancellato!\n🎬 ${evento.titolo}` : `✅ Evento cancellato!\n📅 ${evento.data} - ${evento.nomeLocale}`;
                resetUserState(chatId);
                return sendMessage(chatId, message);
            }
        }

        if (data === 'mantienievento') {
            resetUserState(chatId);
            return sendMessage(chatId, '✅ Contenuto mantenuto.');
        }
    } finally {
        bot.answerCallbackQuery(query.id); // Assicura che la query venga sempre rispost
    }
});

// Funzione per finalizzare la creazione dell'evento
async function finalizeEventCreation(chatId, evento) {
    evento.id = Date.now() + Math.random();
    evento.dataCreazione = new Date();
    evento.creatoDa = chatId;

    eventi.push(evento);
    trackUserActivity(chatId, 'creaevento');

    await postToChannel(evento);

    const categoria = categorieEventi.get(evento.categoria);
    let message;

    if (evento.categoria === 'P') {
        message = `🎉 Contenuto pubblicato!\n\n🎥 Podcast/Video\n🎬 ${evento.titolo}\n${evento.link ? `🔗 ${evento.link}` : ''}\n\n📺 Pubblicato su @OpenMicsITA!`;
    } else {
        message = `🎉 Evento creato con successo!\n\n${categoria.icona} ${categoria.nome}\n📅 ${evento.data} - ${evento.ora}\n🎪 ${evento.titolo}\n🏢 ${evento.nomeLocale}\n📍 ${evento.cittaProvincia}\n🎤 Posti: ${evento.postiComici}\n${evento.tipo === 'Gratuito' ? '🆓' : '💰'} ${evento.tipo}\n\n📺 Pubblicato su @OpenMicsITA!`;
    }

    sendMessage(chatId, message);
    resetUserState(chatId);
}

// 📸 GESTIONE FOTO
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;

    if (checkBan(chatId)) return;

    const userState = userStates[chatId];

    if (userState?.state === 'crealocandina' || userState?.state === 'crealocandinapodcast') {
        const photo = msg.photo[msg.photo.length - 1];
        const fileId = photo.file_id;
        userState.data.locandina = fileId;

        await finalizeEventCreation(chatId, userState.data);
    } else {
        sendMessage(chatId, '📸 Foto ricevuta!\n\nPer caricare contenuti, usa /crea');
    }
});

// 📝 GESTIONE MESSAGGI
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/') || msg.photo) return;
    if (checkBan(chatId)) return;

    const userState = userStates[chatId];
    const state = userState?.state;

    if (!state) {
        return cercaEventi(chatId, text);
    }

    userState.lastActivity = new Date();

    switch (state) {
        case 'cerca':
            resetUserState(chatId);
            cercaEventi(chatId, text);
            break;

        case 'creatitolopodcast':
            handleCreaTitoloPodcast(chatId, text, userState);
            break;

        case 'crealinkpodcast':
            handleCreaLinkPodcast(chatId, text, userState);
            break;

        case 'crealocandinapodcast':
            handleCreaLocandinaPodcast(chatId, text, userState);
            break;

        case 'creadata':
            handleCreaData(chatId, text, userState);
            break;

        case 'creaora':
            handleCreaOra(chatId, text, userState);
            break;

        case 'creatitolo':
            handleCreaTitolo(chatId, text, userState);
            break;

        case 'creanomelocale':
            handleCreaNomeLocale(chatId, text, userState);
            break;

        case 'creaindirizzovia':
            handleCreaIndirizzoVia(chatId, text, userState);
            break;

        case 'creacittaprovincia':
            handleCreaCittaProvincia(chatId, text, userState);
            break;

        case 'creaposti':
            handleCreaPosti(chatId, text, userState);
            break;

        case 'creaorganizzatore':
            handleCreaOrganizzatore(chatId, text, userState);
            break;

        case 'creatipo':
        case 'crealocandina':
            handleCreaLocandina(chatId, text, userState);
            break;

        case 'modificaselezione':
            handleModificaSelezione(chatId, text);
            break;

        case 'modificadata':
            handleModificaData(chatId, text, userState);
            break;

        case 'cancellaselezione':
            handleCancellaSelezione(chatId, text);
            break;
    }
});

// Funzioni di gestione dei singoli stati
async function handleCreaTitoloPodcast(chatId, text, userState) {
    userState.data.titolo = text;
    setUserState(chatId, 'crealinkpodcast', userState.data);
    sendMessage(chatId, '🔗 Link Podcast/Video (YouTube, Spotify, ecc.):\n\nOppure scrivi "skip" per saltare');
}

async function handleCreaLinkPodcast(chatId, text, userState) {
    userState.data.link = text.toLowerCase() === 'skip' ? '' : text.trim();
    setUserState(chatId, 'crealocandinapodcast', userState.data);

    sendMessage(chatId, '📸 Vuoi aggiungere un\'immagine?\n\n📷 Invia una foto oppure scrivi "skip" per saltare', {
        reply_markup: {
            inline_keyboard: [[{ text: '⏭️ Salta immagine', callback_data: 'skiplocandinapodcast' }]]
        }
    });
}

async function handleCreaLocandinaPodcast(chatId, text, userState) {
    if (text.toLowerCase() === 'skip') {
        const evento = userState.data;
        evento.locandina = null;
        await finalizeEventCreation(chatId, evento);
    } else {
        sendMessage(chatId, '📸 Per aggiungere un\'immagine, invia una foto.\n\nOppure scrivi "skip" per saltare.');
    }
}

async function handleCreaData(chatId, text, userState) {
    if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
        sendMessage(chatId, 'Formato non valido. Usa GG/MM/AAAA');
        return;
    }

    const [gg, mm, aa] = text.split('/').map(Number);
    const dataEvento = new Date(aa, mm - 1, gg);
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);

    if (dataEvento < oggi) {
        sendMessage(chatId, '⚠️ Non puoi creare eventi nel passato!\n\n📅 Inserisci una data da oggi in poi.');
        return;
    }

    const maxData = new Date();
    maxData.setDate(maxData.getDate()
