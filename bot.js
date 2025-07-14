const TelegramBot = require('node-telegram-bot-api');

// Configurazione bot - Token da variabile ambiente
const TOKEN = process.env.BOT_TOKEN;

if (!TOKEN) {
    console.error('❌ ERRORE: BOT_TOKEN non trovato nelle variabili ambiente!');
    process.exit(1);
}

const bot = new TelegramBot(TOKEN, {polling: true});

// Database eventi in memoria
let eventi = [];

// Stati utente per la gestione dei flussi
const userStates = {};

// Categorie eventi
const categorieEventi = {
    'S': { nome: 'Serata Stand-up', icona: '🎤' },
    'F': { nome: 'Festival', icona: '🎪' },
    'W': { nome: 'Corso/Workshop', icona: '📚' }
};

// Funzione per pulire stati utente inattivi
function pulisciStatiInattivi() {
    const ora = new Date();
    const quindiMinutiFa = new Date(ora.getTime() - (15 * 60 * 1000));

    Object.keys(userStates).forEach(chatId => {
        messaggio += `${index + 1}. ${evento.data} - ${evento.ora}\n`;
        messaggio += `🎪 ${evento.titolo}\n`;
        messaggio += `🏢 ${evento.nomeLocale}\n`;
        messaggio += `📍 ${evento.indirizzoVia || 'Indirizzo non specificato'}\n`;
        messaggio += `🗺️ ${evento.cittaProvincia}\n`;
        messaggio += `🎤 Posti comici: ${evento.postiComici}\n`;
        messaggio += `👤 ${evento.organizzatoreInfo || 'Organizzatore non specificato'}\n`;
        messaggio += `${tipoIcon} ${evento.tipo}\n`;
        messaggio += `${categoriaInfo.icona} ${categoriaInfo.nome}\n\n`;
    });

    messaggio += `📊 Totale eventi: ${eventiTrovati.length}`;

    bot.sendMessage(chatId, messaggio);
}

// Gestione errori
bot.on('error', (error) => {
    console.error('❌ Errore bot:', error);
});

// Gestione polling errors
bot.on('polling_error', (error) => {
    console.error('❌ Errore polling:', error);
});

// Avvio bot
console.log('🎭 Bot Standup Comedy v.22.4 avviato!');
console.log('🚀 Bot online 24/7 - Deploy di successo!');

// Esporta per uso in altri file
module.exports = bot;if (userStates[chatId] && userStates[chatId].lastActivity < quindiMinutiFa) {
            delete userStates[chatId];
        }
    });
}

// Funzione per pulire eventi scaduti
function pulisciEventiScaduti() {
    const ora = new Date();
    const unaSettimanaFa = new Date(ora.getTime() - (7 * 24 * 60 * 60 * 1000));

    const eventiPrima = eventi.length;
    eventi = eventi.filter(evento => {
        const parti = evento.data.split('/');
        const dataEvento = new Date(parti[2], parti[1] - 1, parti[0]);
        return dataEvento >= unaSettimanaFa;
    });

    if (eventiPrima !== eventi.length) {
        console.log(`Rimossi ${eventiPrima - eventi.length} eventi scaduti`);
    }
}

// Pulizia automatica ogni ora
setInterval(pulisciEventiScaduti, 60 * 60 * 1000);
setInterval(pulisciStatiInattivi, 15 * 60 * 1000);

// Funzione per resettare stato utente
function resetUserState(chatId) {
    delete userStates[chatId];
}

// Funzione per impostare stato utente
function setUserState(chatId, state, data = {}) {
    userStates[chatId] = {
        state: state,
        data: data,
        lastActivity: new Date()
    };
}

// Comando /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    resetUserState(chatId);

    const welcomeMessage = `
🎭 Benvenuto nel Bot Standup Comedy! 🎤 v.22.4
da un'idea di @dinobronzi82
Organizza e trova eventi di standup comedy in tutta Italia!

🎯 Comandi disponibili:
/cerca - Cerca eventi per provincia
/crea - Crea un nuovo evento
/miei_eventi - Vedi i tuoi eventi
/modifica_evento - Modifica data evento
/cancella_evento - Cancella un evento
/ultimi - Ultimi 20 eventi inseriti
/annulla - Annulla operazione corrente
/donazioni - Sostieni il progetto
/help - Mostra questo messaggio

🎪 Categorie eventi:
🎤 Serata Stand-up (S)
🎪 Festival (F)
📚 Corso/Workshop (W)

🚀 Trova il tuo palco o scopri nuovi talenti!

⚠️ Bot sempre online 24/7!
`;

    bot.sendMessage(chatId, welcomeMessage);
});

// Comando /help
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    resetUserState(chatId);

    const helpMessage = `
🎭 Guida Bot Standup Comedy v.22.4

Comandi principali:
• /cerca - Trova eventi per provincia
• /crea - Aggiungi un nuovo evento
• /miei_eventi - Vedi i tuoi eventi
• /modifica_evento - Modifica data di un evento
• /cancella_evento - Cancella un evento
• /ultimi - Ultimi 20 eventi inseriti
• /annulla - Annulla operazione corrente
• /donazioni - Sostieni il progetto

Come cercare eventi:
• Scrivi la sigla provincia (es: MI, RM, TO, ROMA)
• Scrivi il nome città (es: Milano, Roma)
• Per Roma e Milano puoi specificare la zona (es: "Milano Nord")

Categorie eventi:
🎤 Serata Stand-up (S) - Serate di comicità
🎪 Festival (F) - Festival e rassegne
📚 Corso/Workshop (W) - Corsi e workshop

Note:
• Gli eventi vengono eliminati automaticamente 1 settimana dopo la data
• Roma e Milano sono divise in 3 zone: Nord, Centro, Sud
• Puoi usare /annulla per interrompere qualsiasi operazione
`;

    bot.sendMessage(chatId, helpMessage);
});

// Comando /annulla
bot.onText(/\/annulla/, (msg) => {
    const chatId = msg.chat.id;
    resetUserState(chatId);
    bot.sendMessage(chatId, '✅ Operazione annullata. Puoi usare i comandi normalmente.');
});

// Comando /donazioni
bot.onText(/\/donazioni|\/caffè|\/caffe/, (msg) => {
    const chatId = msg.chat.id;
    resetUserState(chatId);

    const donationMessage = `
☕ Mi paghi un caffè?

💰 Sostieni il progetto con 2 € su Revolut!
https://revolut.me/r/ZDIdqlisIP

Grazie per il supporto! 🙏
Ogni donazione aiuta a mantenere il bot attivo e migliorare il servizio.

🎭 Continua a fare ridere l'Italia!
`;

    bot.sendMessage(chatId, donationMessage);
});

// Comando /cerca
bot.onText(/\/cerca/, (msg) => {
    const chatId = msg.chat.id;
    setUserState(chatId, 'cerca');
    bot.sendMessage(chatId, 'Scrivi la provincia o città dove vuoi cercare eventi di standup:\n\nEsempi: MI, Milano, Roma Nord, TO, Torino, ROMA\n\nUsa /annulla per annullare.');
});

// Comando /crea
bot.onText(/\/crea/, (msg) => {
    const chatId = msg.chat.id;
    setUserState(chatId, 'crea_categoria');

    const keyboardCategoria = {
        reply_markup: {
            inline_keyboard: [
                [{text: '🎤 Serata Stand-up', callback_data: 'categoria_S'}],
                [{text: '🎪 Festival', callback_data: 'categoria_F'}],
                [{text: '📚 Corso/Workshop', callback_data: 'categoria_W'}]
            ]
        }
    };

    bot.sendMessage(chatId, 'Iniziamo! Che tipo di evento stai organizzando?\n\nUsa /annulla per annullare.', keyboardCategoria);
});

// Comando /miei_eventi
bot.onText(/\/miei_eventi/, (msg) => {
    const chatId = msg.chat.id;
    resetUserState(chatId);

    pulisciEventiScaduti();

    const mieiEventi = eventi.filter(evento => evento.creatoDa === chatId);

    if (mieiEventi.length === 0) {
        bot.sendMessage(chatId, '❌ Non hai ancora creato nessun evento.\n\nUsa /crea per aggiungere il tuo primo evento!');
        return;
    }

    mieiEventi.sort((a, b) => {
        const parti_a = a.data.split('/');
        const parti_b = b.data.split('/');
        const dataA = new Date(parti_a[2], parti_a[1] - 1, parti_a[0]);
        const dataB = new Date(parti_b[2], parti_b[1] - 1, parti_b[0]);
        return dataA - dataB;
    });

    let messaggio = `🎭 I tuoi eventi:\n\n`;

    mieiEventi.forEach((evento, index) => {
        const tipoIcon = evento.tipo === 'Gratuito' ? '🆓' : '💰';
        const categoriaInfo = categorieEventi[evento.categoria] || { nome: 'Non specificata', icona: '❓' };

        messaggio += `${index + 1}. ${evento.data} - ${evento.ora}\n`;
        messaggio += `🎪 ${evento.titolo}\n`;
        messaggio += `🏢 ${evento.nomeLocale}\n`;
        messaggio += `📍 ${evento.indirizzoVia || 'Indirizzo non specificato'}\n`;
        messaggio += `🗺️ ${evento.cittaProvincia}\n`;
        messaggio += `🎤 Posti comici: ${evento.postiComici}\n`;
        messaggio += `👤 ${evento.organizzatoreInfo || 'Organizzatore non specificato'}\n`;
        messaggio += `${tipoIcon} ${evento.tipo}\n`;
        messaggio += `${categoriaInfo.icona} ${categoriaInfo.nome}\n\n`;
    });

    messaggio += `📊 Totale tuoi eventi: ${mieiEventi.length}`;

    bot.sendMessage(chatId, messaggio);
});

// Comando /ultimi
bot.onText(/\/ultimi/, (msg) => {
    const chatId = msg.chat.id;
    resetUserState(chatId);

    pulisciEventiScaduti();

    if (eventi.length === 0) {
        bot.sendMessage(chatId, '🎭 Non ci sono eventi al momento. Pubblica il primo!');
        return;
    }

    const ultimi20 = eventi
        .sort((a, b) => new Date(b.dataCreazione) - new Date(a.dataCreazione))
        .slice(0, 20);

    let messaggio = `🆕 Ultimi ${ultimi20.length} eventi inseriti:\n\n`;

    ultimi20.forEach((evento, index) => {
        const tipoIcon = evento.tipo === 'Gratuito' ? '🆓' : '💰';
        const categoriaInfo = categorieEventi[evento.categoria] || { nome: 'Non specificata', icona: '❓' };

        messaggio += `${index + 1}. ${evento.data} - ${evento.ora}\n`;
        messaggio += `🎪 ${evento.titolo}\n`;
        messaggio += `🏢 ${evento.nomeLocale}\n`;
        messaggio += `📍 ${evento.indirizzoVia || 'Indirizzo non specificato'}\n`;
        messaggio += `🗺️ ${evento.cittaProvincia}\n`;
        messaggio += `🎤 Posti comici: ${evento.postiComici}\n`;
        messaggio += `👤 ${evento.organizzatoreInfo || 'Organizzatore non specificato'}\n`;
        messaggio += `${tipoIcon} ${evento.tipo}\n`;
        messaggio += `${categoriaInfo.icona} ${categoriaInfo.nome}\n\n`;
    });

    messaggio += `📊 Mostrando gli ultimi ${ultimi20.length} eventi di ${eventi.length} totali`;

    bot.sendMessage(chatId, messaggio);
});

// Comando /modifica_evento
bot.onText(/\/modifica_evento/, (msg) => {
    const chatId = msg.chat.id;

    const mieiEventi = eventi.filter(evento => evento.creatoDa === chatId);

    if (mieiEventi.length === 0) {
        resetUserState(chatId);
        bot.sendMessage(chatId, '❌ Non hai eventi da modificare.\n\nUsa /crea per aggiungere un evento!');
        return;
    }

    setUserState(chatId, 'modifica_selezione');
    bot.sendMessage(chatId, 'Scrivi il numero dell\'evento da modificare (1, 2, 3...).\n\nUsa /miei_eventi per vedere la lista numerata.\nUsa /annulla per annullare.');
});

// Comando /cancella_evento
bot.onText(/\/cancella_evento/, (msg) => {
    const chatId = msg.chat.id;

    const mieiEventi = eventi.filter(evento => evento.creatoDa === chatId);

    if (mieiEventi.length === 0) {
        resetUserState(chatId);
        bot.sendMessage(chatId, '❌ Non hai eventi da cancellare.\n\nUsa /crea per aggiungere un evento!');
        return;
    }

    setUserState(chatId, 'cancella_selezione');
    bot.sendMessage(chatId, 'Scrivi il numero dell\'evento da cancellare (1, 2, 3...).\n\nUsa /miei_eventi per vedere la lista numerata.\nUsa /annulla per annullare.');
});

// Gestione callback query
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (data === 'categoria_S' || data === 'categoria_F' || data === 'categoria_W') {
        if (userStates[chatId]) {
            const categoria = data.split('_')[1];
            if (!userStates[chatId].data) userStates[chatId].data = {};
            userStates[chatId].data.categoria = categoria;
            setUserState(chatId, 'crea_data', userStates[chatId].data);

            bot.sendMessage(chatId, 'Perfetto! Ora scrivi la data dell\'evento (formato: GG/MM/AAAA)\n\nEsempio: 25/12/2024');
        }

    } else if (data === 'tipo_gratuito') {
        if (userStates[chatId] && userStates[chatId].data) {
            userStates[chatId].data.tipo = 'Gratuito';

            const evento = userStates[chatId].data;
            evento.id = Date.now() + Math.random();
            evento.dataCreazione = new Date();
            evento.creatoDa = chatId;

            eventi.push(evento);

            const categoriaInfo = categorieEventi[evento.categoria] || { nome: 'Non specificata', icona: '❓' };
            const riepilogo = `
🎉 Evento creato con successo!

${categoriaInfo.icona} Categoria: ${categoriaInfo.nome}
📅 Data: ${evento.data}
🕐 Ora: ${evento.ora}
🎪 Titolo: ${evento.titolo}
🏢 Locale: ${evento.nomeLocale}
📍 Indirizzo: ${evento.indirizzoVia || 'Non specificato'}
🗺️ Città/Provincia: ${evento.cittaProvincia}
🎤 Posti comici: ${evento.postiComici}
👤 Organizzatore/MC: ${evento.organizzatoreInfo || 'Non specificato'}
🆓 Tipo: Gratuito

L'evento sarà visibile per una settimana dopo la data dell'evento.
`;

            resetUserState(chatId);
            bot.sendMessage(chatId, riepilogo);
        }

    } else if (data === 'tipo_pagamento') {
        if (userStates[chatId] && userStates[chatId].data) {
            userStates[chatId].data.tipo = 'A pagamento';

            const evento = userStates[chatId].data;
            evento.id = Date.now() + Math.random();
            evento.dataCreazione = new Date();
            evento.creatoDa = chatId;

            eventi.push(evento);

            const categoriaInfo = categorieEventi[evento.categoria] || { nome: 'Non specificata', icona: '❓' };
            const riepilogo = `
🎉 Evento creato con successo!

${categoriaInfo.icona} Categoria: ${categoriaInfo.nome}
📅 Data: ${evento.data}
🕐 Ora: ${evento.ora}
🎪 Titolo: ${evento.titolo}
🏢 Locale: ${evento.nomeLocale}
📍 Indirizzo: ${evento.indirizzoVia || 'Non specificato'}
🗺️ Città/Provincia: ${evento.cittaProvincia}
🎤 Posti comici: ${evento.postiComici}
👤 Organizzatore/MC: ${evento.organizzatoreInfo || 'Non specificato'}
💰 Tipo: A pagamento

L'evento sarà visibile per una settimana dopo la data dell'evento.
`;

            resetUserState(chatId);
            bot.sendMessage(chatId, riepilogo);
        }

    } else if (data.startsWith('cancella_num_')) {
        const numeroEvento = parseInt(data.split('_')[2]);
        const mieiEventi = eventi.filter(evento => evento.creatoDa === chatId);
        const evento = mieiEventi[numeroEvento - 1];

        if (evento) {
            const indiceGlobale = eventi.findIndex(e => e.id === evento.id);
            if (indiceGlobale !== -1) {
                eventi.splice(indiceGlobale, 1);
            }

            resetUserState(chatId);
            bot.sendMessage(chatId, `✅ Evento cancellato con successo!\n\n📅 Data: ${evento.data} - ${evento.ora}\n🏢 Locale: ${evento.nomeLocale}\n\n🗑️ L'evento è stato rimosso definitivamente.`);
        }

    } else if (data === 'mantieni_evento') {
        resetUserState(chatId);
        bot.sendMessage(chatId, '✅ Evento mantenuto\n\nL\'evento non è stato cancellato.');
    }

    bot.answerCallbackQuery(callbackQuery.id);
});

// Gestione messaggi in base allo stato
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/')) return;

    const userState = userStates[chatId];

    if (!userState) {
        cercaEventi(chatId, text);
        return;
    }

    userState.lastActivity = new Date();

    switch (userState.state) {
        case 'cerca':
            resetUserState(chatId);
            cercaEventi(chatId, text);
            break;

        case 'crea_data':
            if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
                bot.sendMessage(chatId, 'Formato data non valido. Usa GG/MM/AAAA (es: 25/12/2024)');
                return;
            }
            if (!userState.data) userState.data = {};
            userState.data.data = text;
            setUserState(chatId, 'crea_ora', userState.data);
            bot.sendMessage(chatId, 'Perfetto! Ora scrivi l\'ora (formato: HH:MM)');
            break;

        case 'crea_ora':
            if (!/^\d{1,2}:\d{2}$/.test(text)) {
                bot.sendMessage(chatId, 'Formato ora non valido. Usa HH:MM (es: 21:30)');
                return;
            }
            userState.data.ora = text;
            setUserState(chatId, 'crea_titolo', userState.data);
            bot.sendMessage(chatId, 'Ottimo! Ora scrivi il titolo della serata (es: "Comedy Night", "Open Mic Giovedì", "Festival della Risata"):');
            break;

        case 'crea_titolo':
            userState.data.titolo = text;
            setUserState(chatId, 'crea_nome_locale', userState.data);
            bot.sendMessage(chatId, 'Perfetto! Ora scrivi il nome del locale/teatro dove si terrà l\'evento:');
            break;

        case 'crea_nome_locale':
            userState.data.nomeLocale = text;
            setUserState(chatId, 'crea_indirizzo_via', userState.data);
            bot.sendMessage(chatId, 'Ora scrivi l\'indirizzo/via del locale (facoltativo - scrivi "skip" per saltare):');
            break;

        case 'crea_indirizzo_via':
            if (text.toLowerCase() === 'skip' || text.trim() === '') {
                userState.data.indirizzoVia = '';
            } else {
                userState.data.indirizzoVia = text.trim();
            }
            setUserState(chatId, 'crea_citta_provincia', userState.data);
            bot.sendMessage(chatId, 'Ora scrivi città e provincia (es: Trieste, TS - Crotone, KR - ecc.)\n\nN.B. Per Milano e Roma puoi specificare anche la zona, tra Nord, Centro e Sud (es: Milano Nord, Roma Centro):');
            break;

        case 'crea_citta_provincia':
            userState.data.cittaProvincia = text.toUpperCase();
            setUserState(chatId, 'crea_posti', userState.data);
            bot.sendMessage(chatId, 'Quanti posti per comici sono disponibili? (scrivi solo il numero)');
            break;

        case 'crea_posti':
            if (!/^\d+$/.test(text)) {
                bot.sendMessage(chatId, 'Inserisci solo un numero (es: 10)');
                return;
            }
            userState.data.postiComici = parseInt(text);
            setUserState(chatId, 'crea_organizzatore', userState.data);
            bot.sendMessage(chatId, 'Chi è l\'organizzatore/MC/riferimento per info? (facoltativo - scrivi "skip" per saltare):');
            break;

        case 'crea_organizzatore':
            if (text.toLowerCase() === 'skip' || text.trim() === '') {
                userState.data.organizzatoreInfo = '';
            } else {
                userState.data.organizzatoreInfo = text.trim();
            }
            setUserState(chatId, 'crea_tipo', userState.data);

            const keyboardTipo = {
                reply_markup: {
                    inline_keyboard: [
                        [{text: '🆓 Gratuito', callback_data: 'tipo_gratuito'}],
                        [{text: '💰 A pagamento', callback_data: 'tipo_pagamento'}]
                    ]
                }
            };
            bot.sendMessage(chatId, 'L\'evento è gratuito o a pagamento?', keyboardTipo);
            break;

        case 'modifica_selezione':
            const mieiEventi = eventi.filter(evento => evento.creatoDa === chatId);
            const numeroEvento = parseInt(text);

            if (isNaN(numeroEvento) || numeroEvento < 1 || numeroEvento > mieiEventi.length) {
                bot.sendMessage(chatId, `❌ Numero non valido. Scegli un numero da 1 a ${mieiEventi.length}`);
                return;
            }

            const eventoMod = mieiEventi[numeroEvento - 1];
            setUserState(chatId, 'modifica_data', {eventoId: eventoMod.id, numeroEvento});

            bot.sendMessage(chatId, `Stai modificando l'evento N.${numeroEvento}:\n${eventoMod.data} - ${eventoMod.ora}\n\nScrivi la nuova data (formato: GG/MM/AAAA):`);
            break;

        case 'modifica_data':
            if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
                bot.sendMessage(chatId, 'Formato data non valido. Usa GG/MM/AAAA (es: 25/12/2024)');
                return;
            }

            const eventoIndex = eventi.findIndex(e => e.id === userState.data.eventoId);
            if (eventoIndex !== -1) {
                const vecchiaData = eventi[eventoIndex].data;
                eventi[eventoIndex].data = text;

                resetUserState(chatId);
                bot.sendMessage(chatId, `✅ Data modificata con successo!\n\n📅 Prima: ${vecchiaData}\n📅 Ora: ${text}\n\n🏢 Evento: ${eventi[eventoIndex].nomeLocale}`);
            }
            break;

        case 'cancella_selezione':
            const mieiEventiCanc = eventi.filter(evento => evento.creatoDa === chatId);
            const numeroEventoCanc = parseInt(text);

            if (isNaN(numeroEventoCanc) || numeroEventoCanc < 1 || numeroEventoCanc > mieiEventiCanc.length) {
                bot.sendMessage(chatId, `❌ Numero non valido. Scegli un numero da 1 a ${mieiEventiCanc.length}`);
                return;
            }

            const eventoCanc = mieiEventiCanc[numeroEventoCanc - 1];

            const keyboard = {
                reply_markup: {
                    inline_keyboard: [
                        [{text: '✅ Sì, cancella', callback_data: `cancella_num_${numeroEventoCanc}`}],
                        [{text: '❌ No, mantieni', callback_data: 'mantieni_evento'}]
                    ]
                }
            };

            bot.sendMessage(chatId, `⚠️ Conferma cancellazione\n\nSei sicuro di voler cancellare l'evento N.${numeroEventoCanc}?\n\n📅 Data: ${eventoCanc.data} - ${eventoCanc.ora}\n🏢 Locale: ${eventoCanc.nomeLocale}\n\n⚠️ Attenzione: Questa azione non può essere annullata!`, keyboard);
            break;
    }
});

function cercaEventi(chatId, query) {
    const queryUpper = query.toUpperCase();
    let eventiTrovati = [];

    pulisciEventiScaduti();

    if (queryUpper === 'ROMA' || queryUpper === 'MI') {
        eventiTrovati = eventi.filter(evento => {
            if (queryUpper === 'ROMA') {
                return evento.cittaProvincia === 'ROMA' || evento.cittaProvincia === 'RM' ||
                    evento.cittaProvincia.includes('ROMA') ||
                    ['ROMA NORD', 'ROMA CENTRO', 'ROMA SUD'].some(zona => evento.cittaProvincia.includes(zona));
            } else if (queryUpper === 'MI') {
                return evento.cittaProvincia === 'MI' ||
                    evento.cittaProvincia.includes('MILANO') ||
                    ['MILANO NORD', 'MILANO CENTRO', 'MILANO SUD'].some(zona => evento.cittaProvincia.includes(zona));
            }
            return false;
        });
    } else {
        eventiTrovati = eventi.filter(evento => {
            return evento.cittaProvincia.includes(queryUpper) ||
                evento.cittaProvincia === queryUpper;
        });
    }

    if (eventiTrovati.length === 0) {
        bot.sendMessage(chatId, `❌ Nessun evento trovato per "${query}".\n\nProva con:\n• Sigla provincia (es: MI, RM, TO, ROMA)\n• Nome città (es: Milano, Roma)\n• Zona specifica (es: Milano Nord, Roma Centro)`);
        return;
    }

    eventiTrovati.sort((a, b) => {
        const parti_a = a.data.split('/');
        const parti_b = b.data.split('/');
        const dataA = new Date(parti_a[2], parti_a[1] - 1, parti_a[0]);
        const dataB = new Date(parti_b[2], parti_b[1] - 1, parti_b[0]);
        return dataA - dataB;
    });

    let messaggio = `🎭 Eventi trovati per "${query}":\n\n`;

    eventiTrovati.forEach((evento, index) => {
        const tipoIcon = evento.tipo === 'Gratuito' ? '🆓' : '💰';
        const categoriaInfo = categorieEventi[evento.categoria] || { nome: 'Non specificata', icona: '❓' };

        