const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// Configurazione
const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = '827798574'; // Chat ID di @dinobronzi82
const CHANNEL_ID = '@OpenMicsITA'; // Canale per eventi
const VERSION = '22.8.6';

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
    'W': { nome: 'Corso/Workshop', icona: '📚' },
    'P': { nome: 'Podcast e Video', icona: '🎥' }
};

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
        
        let messaggioCanale;
        if (evento.categoria === 'P') {
            messaggioCanale = `🎭 NUOVO PODCAST/VIDEO!

${categoria.icona} ${categoria.nome}
🎪 ${evento.titolo}
🔗 Link: ${evento.link}

@OpenMicsBot per più info!`;
        } else {
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

@OpenMicsBot per più info!`;
        }

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
    
    let limiteEventi;
    if (hasAdminPowers(chatId)) {
        limiteEventi = 15;
    } else if (isGoldMember(chatId)) {
        limiteEventi = 10;
    } else {
        limiteEventi = 2;
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
        if (!evento.data) return true; // Non pulire podcast senza data
        const [g, m, a] = evento.data.split('/');
        return new Date(a, m - 1, g) >= unaSettimanaFa;
    });
    if (eventiPrima !== eventi.length) {
        console.log(`Rimossi ${eventiPrima - eventi.length} eventi scaduti`);
    }
}

function pulisciStatiInattivi() {
    const quindiciMinutiFa = new Date(Date.now() - (15 * 60 * 1000));
    Object.keys(userStates).forEach(chatId => {
        if (userStates[chatId]?.lastActivity < quindiciMinutiFa) {
            delete userStates[chatId];
        }
    });
}

// Avvio e caricamento
setInterval(pulisciEventiScaduti, 60 * 60 * 1000);
setInterval(pulisciStatiInattivi, 15 * 60 * 1000);

// 🔐 COMANDI ADMIN (nascosti)
bot.onText(/\/stats/, (msg) => {
    const chatId = msg.chat.id;
    if (!hasAdminPowers(chatId)) return;
    
    const eventiAttivi = eventi.filter(e => {
        if (!e.data) return true; // Podcast sempre attivi
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
📈 Oggi: ${eventiOggi.length} nuovi eventi`);
});

// 🚫 COMANDI BAN (solo admin e super admin)
bot.onText(/\/ban (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!hasAdminPowers(chatId)) return;
    
    const targetId = match[1].trim().toString();
    
    if (targetId === ADMIN_ID) {
        bot.sendMessage(chatId, '🛡️ Non puoi bannare l\'admin principale!');
        return;
    }
    
    if (isSuperAdmin(targetId) && !isAdmin(chatId)) {
        bot.sendMessage(chatId, '🛡️ Solo l\'admin principale può bannare altri SUPERadmin!');
        return;
    }
    
    if (bannedUsers.includes(targetId)) {
        bot.sendMessage(chatId, `⚠️ Utente ${targetId} già bannato`);
        return;
    }
    
    bannedUsers.push(targetId);
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
    bot.sendMessage(chatId, `✅ Utente ${targetId} rimosso da GOLDMember!\n\n📋 Totale GOLD: ${goldMembers.length}`);
});

// 🕺🏻 COMANDI SUPERADMIN (solo admin principale)
bot.onText(/\/addsuper (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    
    const targetId = match[1].trim().toString();
    
    if (superAdmins.includes(targetId)) {
        bot.sendMessage(chatId, `⚠️ Utente ${targetId} già SUPERadmin 🕺🏻`);
        return;
    }
    
    superAdmins.push(targetId);
    bot.sendMessage(chatId, `🕺🏻 Utente ${targetId} promosso a SUPERadmin!\n\n📋 Totale SUPER: ${superAdmins.length}`);
});

bot.onText(/\/removesuper (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    
    const targetId = match[1].trim().toString();
    const index = superAdmins.indexOf(targetId);
    
    if (index === -1) {
        bot.sendMessage(chatId, `⚠️ Utente ${targetId} non è SUPERadmin`);
        return;
    }
    
    superAdmins.splice(index, 1);
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

🎪 Categorie: 🎤 Serata • 🎪 Festival • 📚 Workshop • 🎥 Podcast/Video
📸 Nuova funzione: Locandine eventi!
📺 Tutti gli eventi su: t.me/OpenMicsITA
🚀 Sempre online 24/7!

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
🎥 Podcast e Video - Podcast/video (solo titolo e link)

📺 Novità v.22.8:
• Eventi pubblicati automaticamente su t.me/OpenMicsITA
• Locandine (memorizzate su Telegram)
• Limite eventi giornaliero: 2 normali, 10 GOLDMember 🏆, 15 admin
• Sistema antispam e ban migliorato
• ID organizzatore visibile nelle ricerche
• "Quando?" unito per eventi: data + ora in un messaggio (GG/MM/AAAA HH:MM)
• Date eventi: solo da oggi ai prossimi 77 giorni

⚡ Note:
• Eventi eliminati dopo 1 settimana (tranne podcast/video)
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
        return;
    }
    
    setUserState(chatId, 'crea_categoria');
    trackUserActivity(chatId, 'inizio_creazione');

    bot.sendMessage(chatId, 'Che tipo di evento organizzi?', {
        reply_markup: {
            inline_keyboard: [
                [{text: '🎤 Serata Stand-up', callback_data: 'categoria_S'}],
                [{text: '🎪 Festival', callback_data: 'categoria_F'}],
                [{text: '📚 Corso/Workshop', callback_data: 'categoria_W'}],
                [{text: '🎥 Podcast e Video', callback_data: 'categoria_P'}]
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
        if (!a.data || !b.data) return new Date(b.dataCreazione) - new Date(a.dataCreazione);
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
        if (evento.categoria === 'P') {
            messaggio += `${i + 1}. 🎪 ${evento.titolo}\n🔗 ${evento.link}\n${categoria.icona} ${categoria.nome}\n\n`;
        } else {
            messaggio += `${i + 1}. ${evento.data} - ${evento.ora} ${fotoIcon}\n🎪 ${evento.titolo}\n🏢 ${evento.nomeLocale}\n${evento.indirizzoVia ? `📍 ${evento.indirizzoVia}` : ''}\n📍 ${evento.cittaProvincia}\n${categoria.icona} ${categoria.nome}\n\n`;
        }
    });

    const oggi = new Date().toDateString();
    const eventiOggi = userStats[chatId]?.eventiOggi || 0;
    
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
        if (evento.categoria === 'P') {
            messaggio += `${i + 1}. 🎪 ${evento.titolo}\n🔗 ${evento.link}\n${categoria.icona} ${categoria.nome}\n\n`;
        } else {
            messaggio += `${i + 1}. ${evento.data} - ${evento.ora} ${fotoIcon}\n🎪 ${evento.titolo}\n🏢 ${evento.nomeLocale}\n${evento.indirizzoVia ? `📍 ${evento.indirizzoVia}` : ''}\n📍 ${evento.cittaProvincia}\n${tipo} ${categoria.icona}\n\n`;
        }
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
            if (categoria === 'P') {
                setUserState(chatId, 'crea_titolo_podcast', userStates[chatId].data);
                bot.sendMessage(chatId, 'Titolo podcast/video:');
            } else {
                setUserState(chatId, 'crea_quando', userStates[chatId].data);
                bot.sendMessage(chatId, 'Quando? (GG/MM/AAAA HH:MM):\n\nEs: 25/12/2024 21:30\n\n⚠️ Solo da oggi ai prossimi 77 giorni');
            }
        }
    } else if (data === 'tipo_gratuito' || data === 'tipo_pagamento') {
        if (userStates[chatId]?.data) {
            const evento = userStates[chatId].data;
            evento.tipo = data === 'tipo_gratuito' ? 'Gratuito' : 'A pagamento';
            setUserState(chatId, 'crea_locandina', evento);
            
            bot.sendMessage(chatId, '📸 Vuoi aggiungere una locandina?\n\n📷 Invia una foto oppure scrivi "skip" per saltare', {
                reply_markup: {
                    inline_keyboard: [
                        [{text: '⏭️ Salta locandina', callback_data: 'skip_locandina'}]
                    ]
                }
            });
        }
    } else if (data === 'skip_locandina') {
        if (userStates[chatId]?.data) {
            const evento = userStates[chatId].data;
            evento.locandina = null;
            
            evento.id = Date.now() + Math.random();
            evento.dataCreazione = new Date();
            evento.creatoDa = chatId;

            eventi.push(evento);
            trackUserActivity(chatId, 'crea_evento');

            await postToChannel(evento);

            const categoria = categorieEventi[evento.categoria];
            bot.sendMessage(chatId, `🎉 Evento creato con successo!

${categoria.icona} ${categoria.nome}
📅 ${evento.data} - ${evento.ora}
🎪 ${evento.titolo}
🏢 ${evento.nomeLocale}
${evento.indirizzoVia ? `📍 ${evento.indirizzoVia}` : ''}
📍 ${evento.cittaProvincia}
🎤 Posti: ${evento.postiComici}
${evento.tipo === 'Gratuito' ? '🆓' : '💰'} ${evento.tipo}

📺 Pubblicato su @OpenMicsITA!`);
            resetUserState(chatId);
        }
    } else if (data.startsWith('cancella_num_')) {
        const num = parseInt(data.split('_')[2]);
        const mieiEventi = eventi.filter(e => e.creatoDa === chatId);
        const evento = mieiEventi[num - 1];

        if (evento) {
            const index = eventi.findIndex(e => e.id === evento.id);
            if (index !== -1) {
                eventi.splice(index, 1);
            }
            bot.sendMessage(chatId, `✅ Evento cancellato!\n📅 ${evento.data || ''} - ${evento.nomeLocale || evento.titolo}`);
            resetUserState(chatId);
        }
    } else if (data === 'mantieni_evento') {
        resetUserState(chatId);
        bot.sendMessage(chatId, '✅ Evento mantenuto.');
    }

    bot.answerCallbackQuery(query.id);
});

// 📸 GESTIONE FOTO
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    
    if (checkBan(chatId)) return;
    
    const userState = userStates[chatId];
    
    if (userState?.state === 'crea_locandina') {
        const photo = msg.photo[msg.photo.length - 1];
        
        userState.data.locandina = photo.file_id;
        
        const evento = userState.data;
        evento.id = Date.now() + Math.random();
        evento.dataCreazione = new Date();
        evento.creatoDa = chatId;

        eventi.push(evento);
        trackUserActivity(chatId, 'crea_evento');

        await postToChannel(evento);

        const categoria = categorieEventi[evento.categoria];
        bot.sendMessage(chatId, `🎉 Evento creato con locandina!

${categoria.icona} ${categoria.nome}
📅 ${evento.data} - ${evento.ora}
🎪 ${evento.titolo}
🏢 ${evento.nomeLocale}
${evento.indirizzoVia ? `📍 ${evento.indirizzoVia}` : ''}
📍 ${evento.cittaProvincia}
🎤 Posti: ${evento.postiComici}
${evento.tipo === 'Gratuito' ? '🆓' : '💰'} ${evento.tipo}
📸 Locandina caricata!

📺 Pubblicato su @OpenMicsITA!`);
        resetUserState(chatId);
    } else {
        bot.sendMessage(chatId, '📸 Foto ricevuta!\n\nPer caricare locandine eventi, usa /crea');
    }
});

// 📝 GESTIONE MESSAGGI
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/') || msg.photo) return;
    if (checkBan(chatId)) return;

    const userState = userStates[chatId];
    
    if (!userState) {
        cercaEventi(chatId, text);
        return;
    }

    userState.lastActivity = new Date();

    switch (userState.state) {
        case 'cerca': {
            resetUserState(chatId);
            cercaEventi(chatId, text);
            break;
        }

        case 'crea_quando': {
            if (!/^\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}$/.test(text)) {
                bot.sendMessage(chatId, 'Formato non valido. Usa GG/MM/AAAA HH:MM');
                return;
            }
            
            const [dataPart, oraPart] = text.split(' ');
            const [g, m, a] = dataPart.split('/').map(Number);
            const dataEvento = new Date(a, m - 1, g);
            const oggi = new Date();
            oggi.setHours(0, 0, 0, 0);
            
            if (dataEvento < oggi) {
                bot.sendMessage(chatId, '⚠️ Non puoi creare eventi nel passato!\n\nInserisci una data da oggi in poi.');
                return;
            }
            
            const maxData = new Date();
            maxData.setDate(maxData.getDate() + 77);
            
            if (dataEvento > maxData) {
                const maxDataStr = `${maxData.getDate().toString().padStart(2, '0')}/${(maxData.getMonth() + 1).toString().padStart(2, '0')}/${maxData.getFullYear()}`;
                bot.sendMessage(chatId, `⚠️ Data troppo lontana!\n\nPuoi creare eventi fino al ${maxDataStr} (massimo 77 giorni da oggi)`);
                return;
            }
            
            userState.data.data = dataPart;
            userState.data.ora = oraPart;
            setUserState(chatId, 'crea_titolo', userState.data);
            bot.sendMessage(chatId, 'Titolo serata:\n\nEs: "Comedy Night", "Open Mic"');
            break;
        }

        case 'crea_titolo': {
            userState.data.titolo = text;
            setUserState(chatId, 'crea_dove', userState.data);
            bot.sendMessage(chatId, 'Dove? (Nome locale, indirizzo via (opzionale), città e provincia):\n\nEs: Bar Comedy, Via Example 123, Milano, MI\nO: Bar Comedy, Milano, MI');
            break;
        }

        case 'crea_dove': {
            const parti = text.split(',').map(p => p.trim());
            if (parti.length < 2) {
                bot.sendMessage(chatId, 'Formato non valido. Almeno nome locale e città/provincia.');
                return;
            }
            userState.data.nomeLocale = parti[0];
            if (parti.length === 2) {
                userState.data.indirizzoVia = '';
                userState.data.cittaProvincia = parti[1].toUpperCase();
            } else {
                userState.data.indirizzoVia = parti.slice(1, -1).join(', ').trim();
                userState.data.cittaProvincia = parti[parti.length - 1].toUpperCase();
            }
            setUserState(chatId, 'crea_posti', userState.data);
            bot.sendMessage(chatId, 'Posti comici disponibili (solo numero):');
            break;
        }

        case 'crea_posti': {
            if (!/^\d+$/.test(text)) {
                bot.sendMessage(chatId, 'Inserisci solo un numero');
                return;
            }
            userState.data.postiComici = parseInt(text);
            setUserState(chatId, 'crea_organizzatore', userState.data);
            bot.sendMessage(chatId, 'Organizzatore/MC ("skip" per saltare):');
            break;
        }

        case 'crea_organizzatore': {
            userState.data.organizzatoreInfo = text.toLowerCase() === 'skip' ? '' : text.trim();
            setUserState(chatId, 'crea_tipo', userState.data);
            
            bot.sendMessage(chatId, 'Evento gratuito o a pagamento?', {
                reply_markup: {
                    inline_keyboard: [
                        [{text: '🆓 Gratuito', callback_data: 'tipo_gratuito'}],
                        [{text: '💰 A pagamento', callback_data: 'tipo_pagamento'}]
                    ]
                }
            });
            break;
        }

        case 'crea_titolo_podcast': {
            userState.data.titolo = text;
            setUserState(chatId, 'crea_link', userState.data);
            bot.sendMessage(chatId, 'Link esterno (deve iniziare con http/https):');
            break;
        }

        case 'crea_link': {
            if (!/^https?:\/\//i.test(text)) {
                bot.sendMessage(chatId, 'Formato non valido. Inserisci un link valido con http o https.');
                return;
            }
            userState.data.link = text.trim();
            
            // Finalizza podcast
            const evento = userState.data;
            evento.id = Date.now() + Math.random();
            evento.dataCreazione = new Date();
            evento.creatoDa = chatId;

            eventi.push(evento);
            trackUserActivity(chatId, 'crea_evento');

            await postToChannel(evento);

            const categoria = categorieEventi[evento.categoria];
            bot.sendMessage(chatId, `🎉 Podcast/Video creato!

${categoria.icona} ${categoria.nome}
🎪 ${evento.titolo}
🔗 ${evento.link}

📺 Pubblicato su @OpenMicsITA!`);
            resetUserState(chatId);
            break;
        }

        case 'crea_locandina': {
            if (text.toLowerCase() === 'skip') {
                const evento = userState.data;
                evento.locandina = null;
                
                evento.id = Date.now() + Math.random();
                evento.dataCreazione = new Date();
                evento.creatoDa = chatId;

                eventi.push(evento);
                trackUserActivity(chatId, 'crea_evento');

                await postToChannel(evento);

                const categoria = categorieEventi[evento.categoria];
                bot.sendMessage(chatId, `🎉 Evento creato con successo!

${categoria.icona} ${categoria.nome}
📅 ${evento.data} - ${evento.ora}
🎪 ${evento.titolo}
🏢 ${evento.nomeLocale}
${evento.indirizzoVia ? `📍 ${evento.indirizzoVia}` : ''}
📍 ${evento.cittaProvincia}
🎤 Posti: ${evento.postiComici}
${evento.tipo === 'Gratuito' ? '🆓' : '💰'} ${evento.tipo}

📺 Pubblicato su @OpenMicsITA!`);
                resetUserState(chatId);
            } else {
                bot.sendMessage(chatId, '📸 Invia una foto per la locandina.\n\nOppure scrivi "skip" per saltare.');
            }
            break;
        }

        case 'modifica_selezione': {
            const mieiEventi = eventi.filter(e => e.creatoDa === chatId);
            const num = parseInt(text);
            
            if (isNaN(num) || num < 1 || num > mieiEventi.length) {
                bot.sendMessage(chatId, `❌ Numero non valido (1-${mieiEventi.length})`);
                return;
            }
            
            setUserState(chatId, 'modifica_data', {eventoId: mieiEventi[num - 1].id, numeroEvento: num});
            bot.sendMessage(chatId, `Modifica evento ${num}:\n${mieiEventi[num - 1].data || ''} - ${mieiEventi[num - 1].ora || ''}\n\nNuova data (GG/MM/AAAA):`);
            break;
        }

        case 'modifica_data': {
            if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
                bot.sendMessage(chatId, 'Formato non valido. Usa GG/MM/AAAA');
                return;
            }
            
            const [gg, mm, aa] = text.split('/').map(Number);
            const dataEventoMod = new Date(aa, mm - 1, gg);
            const oggiMod = new Date();
            oggiMod.setHours(0, 0, 0, 0);
            
            if (dataEventoMod < oggiMod) {
                bot.sendMessage(chatId, '⚠️ Non puoi modificare con una data nel passato!\n\nInserisci una data da oggi in poi.');
                return;
            }
            
            const maxDataMod = new Date();
            maxDataMod.setDate(maxDataMod.getDate() + 77);
            
            if (dataEventoMod > maxDataMod) {
                const maxDataModStr = `${maxDataMod.getDate().toString().padStart(2, '0')}/${(maxDataMod.getMonth() + 1).toString().padStart(2, '0')}/${maxDataMod.getFullYear()}`;
                bot.sendMessage(chatId, `⚠️ Data troppo lontana!\n\nPuoi modificare eventi fino al ${maxDataModStr} (massimo 77 giorni da oggi)`);
                return;
            }
            
            const index = eventi.findIndex(e => e.id === userState.data.eventoId);
            if (index !== -1) {
                const vecchiaData = eventi[index].data;
                eventi[index].data = text;
                bot.sendMessage(chatId, `✅ Data modificata!\n📅 ${vecchiaData} → ${text}`);
            }
            resetUserState(chatId);
            break;
        }

        case 'cancella_selezione': {
            const mieiEventiCanc = eventi.filter(e => e.creatoDa === chatId);
            const numCanc = parseInt(text);
            
            if (isNaN(numCanc) || numCanc < 1 || numCanc > mieiEventiCanc.length) {
                bot.sendMessage(chatId, `❌ Numero non valido (1-${mieiEventiCanc.length})`);
                return;
            }
            
            const evento = mieiEventiCanc[numCanc - 1];
            bot.sendMessage(chatId, `⚠️ Cancellare evento ${numCanc}?\n\n📅 ${evento.data || ''} - ${evento.ora || ''}\n🏢 ${evento.nomeLocale || evento.titolo}\n\n⚠️ Azione irreversibile!`, {
                reply_markup: {
                    inline_keyboard: [
                        [{text: '✅ Sì, cancella', callback_data: `cancella_num_${numCanc}`}],
                        [{text: '❌ No, mantieni', callback_data: 'mantieni_evento'}]
                    ]
                }
            });
            break;
        }
    }
});

// 🔍 FUNZIONE RICERCA
function cercaEventi(chatId, query) {
    const q = query.toUpperCase();
    pulisciEventiScaduti();

    let trovati = [];
    
    if (q === 'ROMA' || q === 'MI') {
        trovati = eventi.filter(e => {
            if (!e.cittaProvincia) return false;
            if (q === 'ROMA') return e.cittaProvincia.includes('ROMA') || e.cittaProvincia === 'RM';
            if (q === 'MI') return e.cittaProvincia.includes('MILANO') || e.cittaProvincia === 'MI';
        });
    } else {
        trovati = eventi.filter(e => e.cittaProvincia && e.cittaProvincia.includes(q));
    }

    if (trovati.length === 0) {
        bot.sendMessage(chatId, `❌ Nessun evento per "${query}"\n\nProva: MI, Roma, Torino, Milano Nord`);
        return;
    }

    trovati.sort((a, b) => {
        if (!a.data || !b.data) return new Date(b.dataCreazione) - new Date(a.dataCreazione);
        const [ga, ma, aa] = a.data.split('/');
        const [gb, mb, ab] = b.data.split('/');
        return new Date(aa, ma - 1, ga) - new Date(ab, mb - 1, gb);
    });

    trovati.forEach((evento, i) => {
        const categoria = categorieEventi[evento.categoria];
        const tipo = evento.tipo === 'Gratuito' ? '🆓' : '💰';
        
        let messaggio;
        if (evento.categoria === 'P') {
            messaggio = `${i + 1}. 🎪 ${evento.titolo}
🔗 ${evento.link}
${categoria.icona} ${categoria.nome}
👤 ID: ${evento.creatoDa}`;
        } else {
            messaggio = `${i + 1}. ${evento.data} - ${evento.ora}
🎪 ${evento.titolo}
🏢 ${evento.nomeLocale}
📍 ${evento.cittaProvincia}
🎤 Posti: ${evento.postiComici}
${tipo} ${categoria.icona}
👤 ID: ${evento.creatoDa}`;
        }

        if (evento.locandina) {
            bot.sendPhoto(chatId, evento.locandina, { caption: messaggio });
        } else {
            bot.sendMessage(chatId, messaggio);
        }
    });

    setTimeout(() => {
        bot.sendMessage(chatId, `📊 Trovati ${trovati.length} eventi per "${query}"`);
    }, 1000);
}

// Gestione errori
bot.on('error', (error) => console.error('❌ Bot error:', error));
bot.on('polling_error', (error) => console.error('❌ Polling error:', error));

// Avvio
console.log(`🎭 Bot Comedy v.${VERSION} avviato!`);
console.log('🔐 Comandi admin nascosti');
console.log('📸 Sistema locandine attivo');
console.log('🚫 Sistema ban attivo');
console.log('🏆 Sistema GOLDMember attivo');
console.log('🕺🏻 Sistema SUPERadmin attivo');
console.log('📅 Controllo date eventi attivo (oggi + 77 giorni)');
console.log('📺 Canale t.me/OpenMicsITA collegato');

module.exports = bot;
