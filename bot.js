const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// Configurazione
const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = '827798574'; // Chat ID di @dinobronzi82
const CHANNEL_ID = '@OpenMicsITA'; // Canale per eventi
const BACKUP_FILE = path.join(__dirname, 'comedy_backup.json');
const VERSION = '22.8.4';

if (!TOKEN) {
    console.error('❌ ERRORE: BOT_TOKEN non trovato!');
    process.exit(1);
}

const bot = new TelegramBot(TOKEN, {polling: true});

// Database
let eventi = [];
let userStats = {};
let bannedUsers = []; // Lista utenti bannati
let goldMembers = []; // Lista GOLDMember 🏆
let superAdmins = []; // Lista SUPERadmin 🕺🏻
const userStates = {};

// Categorie eventi
const categorieEventi = {
    'S': { nome: 'Serata Stand-up', icona: '🎤' },
    'F': { nome: 'Festival', icona: '🎪' },
    'W': { nome: 'Corso/Workshop', icona: '📚' }
};

// 🗄️ SISTEMA BACKUP
function salvaBackup() {
    try {
        const backup = { 
            eventi, 
            userStats, 
            bannedUsers,
            goldMembers,
            superAdmins, 
            timestamp: new Date().toISOString(), 
            version: VERSION 
        };
        fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2));
        console.log('✅ Backup salvato:', new Date().toLocaleString());
        return true;
    } catch (error) {
        console.error('❌ Errore backup:', error);
        return false;
    }
}

function caricaBackup() {
    try {
        if (fs.existsSync(BACKUP_FILE)) {
            const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
            eventi = backup.eventi || [];
            userStats = backup.userStats || {};
            bannedUsers = backup.bannedUsers || [];
            goldMembers = backup.goldMembers || [];
            superAdmins = backup.superAdmins || [];
            console.log(`✅ Backup caricato: ${eventi.length} eventi, ${Object.keys(userStats).length} utenti, ${bannedUsers.length} ban, ${goldMembers.length} gold, ${superAdmins.length} super`);
            return true;
        }
        console.log('📝 Nessun backup trovato');
        return false;
    } catch (error) {
        console.error('❌ Errore caricamento:', error);
        eventi = [];
        userStats = {};
        bannedUsers = [];
        goldMembers = [];
        superAdmins = [];
        return false;
    }
}

// Utility functions
const isAdmin = (chatId) => chatId.toString() === ADMIN_ID;
const isSuperAdmin = (chatId) => superAdmins.includes(chatId.toString());
const isGoldMember = (chatId) => goldMembers.includes(chatId.toString());
const hasAdminPowers = (chatId) => isAdmin(chatId) || isSuperAdmin(chatId);
const resetUserState = (chatId) => delete userStates[chatId];
const setUserState = (chatId, state, data = {}) => {
    userStates[chatId] = { state, data, lastActivity: new Date() };
};

// 📺 FUNZIONE POSTING CANALE
async function postToChannel(evento) {
    try {
        const categoria = categorieEventi[evento.categoria];
        const tipo = evento.tipo === 'Gratuito' ? '🆓' : '💰';
        
        const messaggioCanale = `🎭 NUOVO EVENTO COMEDY!

${categoria.icona} ${categoria.nome}
📅 ${evento.data} - ${evento.ora}
🎪 ${evento.titolo}
🏢 ${evento.nomeLocale}
${evento.indirizzoVia ? `📍 ${evento.indirizzoVia}` : ''}
📍 ${evento.cittaProvincia}
🎤 Posti disponibili: ${evento.postiComici}
${evento.organizzatoreInfo ? `👨‍🎤 Organizzatore: ${evento.organizzatoreInfo}` : ''}
${tipo} ${categoria.nome}

@OpenMicsBot per più info!`;

        if (evento.locandina) {
            await bot.sendPhoto(CHANNEL_ID, evento.locandina, { 
                caption: messaggioCanale
            });
        } else {
            await bot.sendMessage(CHANNEL_ID, messaggioCanale);
        }
        
        console.log(`📺 Evento postato nel canale: ${evento.titolo}`);
        return true;
    } catch (error) {
        console.error(`❌ Errore posting canale: ${error.message}`);
        // NON bloccare la creazione evento se canale fallisce
        return false;
    }
}

// 🚫 Controllo Ban
function checkBan(chatId) {
    const chatIdStr = chatId.toString();
    if (bannedUsers.includes(chatIdStr)) {
        bot.sendMessage(chatId, '🚫 Sei stato escluso dall\'utilizzo del bot.\n\nPer informazioni: zibroncloud@gmail.com');
        return true;
    }
    return false;
}

// ⚠️ Controllo Limite Eventi Giornaliero
function checkDailyLimit(chatId) {
    const oggi = new Date().toDateString();
    
    // Determinare limite in base al livello utente
    let limiteEventi;
    if (hasAdminPowers(chatId)) {
        limiteEventi = 15; // Admin e SuperAdmin
    } else if (isGoldMember(chatId)) {
        limiteEventi = 10; // GOLDMember 🏆
    } else {
        limiteEventi = 2; // Utenti normali
    }
    
    if (!userStats[chatId]) {
        userStats[chatId] = {
            eventiCreati: 0,
            eventiOggi: 0,
            ultimaData: oggi,
            ultimoEvento: null,
            primoUso: new Date().toISOString(),
            ultimoUso: new Date().toISOString()
        };
    }
    
    // Reset contatore se è un nuovo giorno
    if (userStats[chatId].ultimaData !== oggi) {
        userStats[chatId].eventiOggi = 0;
        userStats[chatId].ultimaData = oggi;
    }
    
    if (userStats[chatId].eventiOggi >= limiteEventi) {
        bot.sendMessage(chatId, `⚠️ Limite giornaliero raggiunto!\n\n🚫 Puoi creare massimo ${limiteEventi} eventi al giorno.\n⏰ Riprova domani.\n\n📧 Per necessità particolari: zibroncloud@gmail.com`);
        return false;
    }
    
    return true;
}

function trackUserActivity(chatId, action) {
    const oggi = new Date().toDateString();
    
    if (!userStats[chatId]) {
        userStats[chatId] = {
            eventiCreati: 0,
            eventiOggi: 0,
            ultimaData: oggi,
            ultimoEvento: null,
            primoUso: new Date().toISOString(),
            ultimoUso: new Date().toISOString()
        };
    }
    
    userStats[chatId].ultimoUso = new Date().toISOString();
    
    if (action === 'crea_evento') {
        userStats[chatId].eventiCreati++;
        userStats[chatId].eventiOggi++;
        userStats[chatId].ultimoEvento = new Date().toISOString();
    }
}

function pulisciEventiScaduti() {
    const unaSettimanaFa = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
    const eventiPrima = eventi.length;
    eventi = eventi.filter(evento => {
        const [g, m, a] = evento.data.split('/');
        return new Date(a, m - 1, g) >= unaSettimanaFa;
    });
    if (eventiPrima !== eventi.length) {
        console.log(`Rimossi ${eventiPrima - eventi.length} eventi scaduti`);
        salvaBackup();
    }
}

function pulisciStatiInattivi() {
    const quindiMinutiFa = new Date(Date.now() - (15 * 60 * 1000));
    Object.keys(userStates).forEach(chatId => {
        if (userStates[chatId]?.lastActivity < quindiMinutiFa) {
            delete userStates[chatId];
        }
    });
}

// Avvio e caricamento
caricaBackup();
setInterval(salvaBackup, 30 * 60 * 1000);
setInterval(pulisciEventiScaduti, 60 * 60 * 1000);
setInterval(pulisciStatiInattivi, 15 * 60 * 1000);

// Salvataggio all'uscita
process.on('SIGINT', () => { salvaBackup(); process.exit(0); });
process.on('SIGTERM', () => { salvaBackup(); process.exit(0); });

// 🔐 COMANDI ADMIN (nascosti)
bot.onText(/\/backup/, (msg) => {
    const chatId = msg.chat.id;
    if (!hasAdminPowers(chatId)) return;
    
    const success = salvaBackup();
    bot.sendMessage(chatId, success ? 
        `✅ Backup salvato!\n📊 ${eventi.length} eventi, ${Object.keys(userStats).length} utenti, ${bannedUsers.length} ban, ${goldMembers.length} gold, ${superAdmins.length} super` : 
        '❌ Errore backup!');
});

bot.onText(/\/stats/, (msg) => {
    const chatId = msg.chat.id;
    if (!hasAdminPowers(chatId)) return;
    
    const eventiAttivi = eventi.filter(e => {
        const [g, m, a] = e.data.split('/');
        return new Date(a, m - 1, g) >= new Date();
    });
    
    const oggi = new Date().toDateString();
    const eventiOggi = eventi.filter(e => new Date(e.dataCreazione).toDateString() === oggi);
    
    bot.sendMessage(chatId, `📊 Stats Bot v.${VERSION}:
🎭 Eventi: ${eventi.length} (${eventiAttivi.length} attivi)
👥 Utenti: ${Object.keys(userStats).length}
🚫 Utenti bannati: ${bannedUsers.length}
🏆 GOLDMember: ${goldMembers.length}
🕺🏻 SUPERadmin: ${superAdmins.length}
📈 Oggi: ${eventiOggi.length} nuovi eventi
💾 Backup: ${new Date().toLocaleString()}`);
});

// 🚫 COMANDI BAN (solo admin e super admin)
bot.onText(/\/ban (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!hasAdminPowers(chatId)) return;
    
    const targetId = match[1].trim().toString();

    
    // Protezione: non si può bannare l'admin principale
    if (targetId === ADMIN_ID) {
        bot.sendMessage(chatId, '🛡️ Non puoi bannare l\'admin principale!');
        return;
    }
    
    // Super admin non possono bannare altri super admin (solo l'admin principale può)
    if (isSuperAdmin(targetId) && !isAdmin(chatId)) {
        bot.sendMessage(chatId, '🛡️ Solo l\'admin principale può bannare altri SUPERadmin!');
        return;
    }
    
    if (bannedUsers.includes(targetId)) {
        bot.sendMessage(chatId, `⚠️ Utente ${targetId} già bannato`);
        return;
    }
    
    bannedUsers.push(targetId);
    salvaBackup();
    bot.sendMessage(chatId, `🚫 Utente ${targetId} bannato con successo!\n\n📋 Totale ban: ${bannedUsers.length}`);
});

bot.onText(/\/unban (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!hasAdminPowers(chatId)) return;
    
    const targetId = match[1].trim().toString();
    const index = bannedUsers.indexOf(targetId);
    
    if (index === -1) {
        bot.sendMessage(chatId, `⚠️ Utente ${targetId} non è bannato`);
        return;
    }
    
    bannedUsers.splice(index, 1);
    salvaBackup();
    bot.sendMessage(chatId, `✅ Utente ${targetId} sbannato con successo!\n\n📋 Totale ban: ${bannedUsers.length}`);
});

bot.onText(/\/banlist/, (msg) => {
    const chatId = msg.chat.id;
    if (!hasAdminPowers(chatId)) return;
    
    if (bannedUsers.length === 0) {
        bot.sendMessage(chatId, '📋 Nessun utente bannato');
        return;
    }
    
    const lista = bannedUsers.map((id, i) => `${i + 1}. ${id}`).join('\n');
    bot.sendMessage(chatId, `🚫 Utenti bannati (${bannedUsers.length}):\n\n${lista}`);
});

// 🏆 COMANDI GOLDMEMBER (solo admin e super admin)
bot.onText(/\/gold (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!hasAdminPowers(chatId)) return;
    
    const targetId = match[1].trim().toString();
    
    if (goldMembers.includes(targetId)) {
        bot.sendMessage(chatId, `⚠️ Utente ${targetId} già GOLDMember 🏆`);
        return;
    }
    
    goldMembers.push(targetId);
    salvaBackup();
    bot.sendMessage(chatId, `🏆 Utente ${targetId} promosso a GOLDMember!\n\n📋 Totale GOLD: ${goldMembers.length}`);
});

bot.onText(/\/ungold (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!hasAdminPowers(chatId)) return;
    
    const targetId = match[1].trim().toString();
    const index = goldMembers.indexOf(targetId);
    
    if (index === -1) {
        bot.sendMessage(chatId, `⚠️ Utente ${targetId} non è GOLDMember`);
        return;
    }
    
    goldMembers.splice(index, 1);
    salvaBackup();
    bot.sendMessage(chatId, `✅ Utente ${targetId} rimosso da GOLDMember!\n\n📋 Totale GOLD: ${goldMembers.length}`);
});

// 🕺🏻 COMANDI SUPERADMIN (solo admin principale)
bot.onText(/\/addsuper (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return; // Solo l'admin principale può nominare SuperAdmin
    
    const targetId = match[1].trim().toString();
    
    if (superAdmins.includes(targetId)) {
        bot.sendMessage(chatId, `⚠️ Utente ${targetId} già SUPERadmin 🕺🏻`);
        return;
    }
    
    superAdmins.push(targetId);
    salvaBackup();
    bot.sendMessage(chatId, `🕺🏻 Utente ${targetId} promosso a SUPERadmin!\n\n📋 Totale SUPER: ${superAdmins.length}`);
});

bot.onText(/\/removesuper (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return; // Solo l'admin principale può rimuovere SuperAdmin
    
    const targetId = match[1].trim().toString();
    const index = superAdmins.indexOf(targetId);
    
    if (index === -1) {
        bot.sendMessage(chatId, `⚠️ Utente ${targetId} non è SUPERadmin`);
        return;
    }
    
    superAdmins.splice(index, 1);
    salvaBackup();
    bot.sendMessage(chatId, `✅ Utente ${targetId} rimosso da SUPERadmin!\n\n📋 Totale SUPER: ${superAdmins.length}`);
});

// 📱 COMANDI PUBBLICI
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    if (checkBan(chatId)) return;
    
    resetUserState(chatId);
    trackUserActivity(chatId, 'start');

    bot.sendMessage(chatId, `🎭 Bot Standup Comedy v.${VERSION} 🎤
da @dinobronzi82 - Eventi comedy in Italia!

🎯 Comandi:
/cerca - Cerca eventi per provincia
/crea - Crea nuovo evento
/miei_eventi - I tuoi eventi
/modifica_evento - Modifica data evento
/cancella_evento - Cancella evento
/ultimi - Ultimi 20 eventi
/donazioni - Sostieni il progetto
/help - Guida completa

🎪 Categorie: 🎤 Serata • 🎪 Festival • 📚 Workshop
📸 Nuova funzione: Locandine eventi!
📺 Tutti gli eventi su: t.me/OpenMicsITA
🚀 Sempre online 24/7 con backup automatico!

📧 Per problemi, complimenti e suggerimenti:
zibroncloud@gmail.com 😉`);
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    if (checkBan(chatId)) return;
    
    resetUserState(chatId);

    bot.sendMessage(chatId, `🎭 Guida Bot Comedy v.${VERSION}

🔍 Ricerca eventi:
• Sigla provincia: MI, RM, TO
• Nome città: Milano, Roma, Torino  
• Zone Milano/Roma: Milano Nord, Roma Centro

🎪 Categorie:
🎤 Serata Stand-up - Serate comedy
🎪 Festival - Festival e rassegne
📚 Corso/Workshop - Corsi e workshop

📺 Novità v.22.8:
• Tutti gli eventi pubblicati automaticamente su t.me/OpenMicsITA
• Locandine eventi (memorizzate su Telegram)
• Limite eventi giornaliero: 2 normali, 10 GOLDMember 🏆, 15 admin
• Sistema antispam e ban migliorato
• ID organizzatore visibile nelle ricerche
• Date eventi: solo da oggi ai prossimi 77 giorni

⚡ Note:
• Eventi eliminati dopo 1 settimana
• Roma/Milano divise in 3 zone
• /annulla per interrompere operazioni
• Tutti gli eventi su: t.me/OpenMicsITA
• Date valide: solo futuro, massimo 77 giorni

📧 Per problemi, complimenti e suggerimenti:
zibroncloud@gmail.com 😉`);
});

bot.onText(/\/cerca/, (msg) => {
    const chatId = msg.chat.id;
    if (checkBan(chatId)) return;
    
    setUserState(chatId, 'cerca');
    bot.sendMessage(chatId, 'Scrivi provincia/città per cercare eventi:\n\nEs: MI, Milano, Roma Nord, TO\n\n/annulla per uscire');
});

bot.onText(/\/crea/, (msg) => {
    const chatId = msg.chat.id;
    if (checkBan(chatId)) return;
    
    if (!checkDailyLimit(chatId)) {
        return; // Limite giornaliero raggiunto
    }
    
    setUserState(chatId, 'crea_categoria');
    trackUserActivity(chatId, 'inizio_creazione');

    bot.sendMessage(chatId, 'Che tipo di evento organizzi?', {
        reply_markup: {
            inline_keyboard: [
                [{text: '🎤 Serata Stand-up', callback_data: 'categoria_S'}],
                [{text: '🎪 Festival', callback_data: 'categoria_F'}],
                [{text: '📚 Corso/Workshop', callback_data: 'categoria_W'}]
            ]
        }
    });
});

bot.onText(/\/miei_eventi/, (msg) => {
    const chatId = msg.chat.id;
    if (checkBan(chatId)) return;
    
    resetUserState(chatId);
    pulisciEventiScaduti();

    const mieiEventi = eventi.filter(e => e.creatoDa === chatId).sort((a, b) => {
        const [ga, ma, aa] = a.data.split('/');
        const [gb, mb, ab] = b.data.split('/');
        return new Date(aa, ma - 1, ga) - new Date(ab, mb - 1, gb);
    });

    if (mieiEventi.length === 0) {
        bot.sendMessage(chatId, '❌ Nessun evento creato. Usa /crea per iniziare!');
        return;
    }

    let messaggio = `🎭 I tuoi eventi (${mieiEventi.length}):\n\n`;
    mieiEventi.forEach((evento, i) => {
        const categoria = categorieEventi[evento.categoria];
        const fotoIcon = evento.locandina ? '📸' : '';
        messaggio += `${i + 1}. ${evento.data} - ${evento.ora} ${fotoIcon}\n🎪 ${evento.titolo}\n🏢 ${evento.nomeLocale}\n${evento.indirizzoVia ? `📍 ${evento.indirizzoVia}` : ''}\n📍 ${evento.cittaProvincia}\n${categoria.icona} ${categoria.nome}\n\n`;
    });

    const oggi = new Date().toDateString();
    const eventiOggi = userStats[chatId]?.eventiOggi || 0;
    
    // Determinare limite in base al livello utente
    let limiteEventi;
    if (hasAdminPowers(chatId)) {
        limiteEventi = 15;
    } else if (isGoldMember(chatId)) {
        limiteEventi = 10;
    } else {
        limiteEventi = 2;
    }
    
    messaggio += `📊 Eventi creati oggi: ${eventiOggi}/${limiteEventi}`;

    bot.sendMessage(chatId, messaggio);
});

bot.onText(/\/ultimi/, (msg) => {
    const chatId = msg.chat.id;
    if (checkBan(chatId)) return;
    
    resetUserState(chatId);
    pulisciEventiScaduti();

    if (eventi.length === 0) {
        bot.sendMessage(chatId, '🎭 Nessun evento. Pubblica il primo!');
        return;
    }

    const ultimi = eventi.sort((a, b) => new Date(b.dataCreazione) - new Date(a.dataCreazione)).slice(0, 20);
    
    let messaggio = `🆕 Ultimi ${ultimi.length} eventi:\n\n`;
    ultimi.forEach((evento, i) => {
        const categoria = categorieEventi[evento.categoria];
        const tipo = evento.tipo === 'Gratuito' ? '🆓' : '💰';
        const fotoIcon = evento.locandina ? '📸' : '';
        messaggio += `${i + 1}. ${evento.data} - ${evento.ora} ${fotoIcon}\n🎪 ${evento.titolo}\n🏢 ${evento.nomeLocale}\n${evento.indirizzoVia ? `📍 ${evento.indirizzoVia}` : ''}\n📍 ${evento.cittaProvincia}\n${tipo} ${categoria.icona}\n\n`;
    });

    bot.sendMessage(chatId, messaggio);
});

bot.onText(/\/modifica_evento/, (msg) => {
    const chatId = msg.chat.id;
    if (checkBan(chatId)) return;
    
    const mieiEventi = eventi.filter(e => e.creatoDa === chatId);

    if (mieiEventi.length === 0) {
        resetUserState(chatId);
        bot.sendMessage(chatId, '❌ Nessun evento da modificare. Usa /crea!');
        return;
    }

    setUserState(chatId, 'modifica_selezione');
    bot.sendMessage(chatId, 'Numero evento da modificare (1,2,3...):\n\nUsa /miei_eventi per la lista');
});

bot.onText(/\/cancella_evento/, (msg) => {
    const chatId = msg.chat.id;
    if (checkBan(chatId)) return;
    
    const mieiEventi = eventi.filter(e => e.creatoDa === chatId);

    if (mieiEventi.length === 0) {
        resetUserState(chatId);
        bot.sendMessage(chatId, '❌ Nessun evento da cancellare. Usa /crea!');
        return;
    }

    setUserState(chatId, 'cancella_selezione');
    bot.sendMessage(chatId, 'Numero evento da cancellare (1,2,3...):\n\nUsa /miei_eventi per la lista');
});

bot.onText(/\/donazioni|\/caffè|\/caffe/, (msg) => {
    const chatId = msg.chat.id;
    if (checkBan(chatId)) return;
    
    resetUserState(chatId);
    bot.sendMessage(chatId, `☕ Sostieni il progetto!\n\n💰 Revolut: https://revolut.me/r/ZDIdqlisIP\n\nGrazie! 🙏 Ogni donazione aiuta a migliorare il bot.\n\n🎭 Continua a far ridere l'Italia!`);
});

bot.onText(/\/annulla/, (msg) => {
    const chatId = msg.chat.id;
    if (checkBan(chatId)) return;
    
    resetUserState(chatId);
    bot.sendMessage(chatId, '✅ Operazione annullata.');
});

// 🎯 GESTIONE CALLBACK
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    if (checkBan(chatId)) {
        bot.answerCallbackQuery(query.id);
        return;
    }

    if (data.startsWith('categoria_')) {
        const categoria = data.split('_')[1];
        if (userStates[chatId]) {
            if (!userStates[chatId].data) userStates[chatId].data = {};
            userStates[chatId].data.categoria = categoria;
            setUserState(chatId, 'crea_data', userStates[chatId].data);
            bot.sendMessage(chatId, 'Data evento (GG/MM/AAAA):\n\nEs: 25/12/2024\n\n⚠️ Solo eventi
