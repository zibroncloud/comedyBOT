# 🎭 Comedy Bot Telegram v.22.4

Bot Telegram per la gestione e ricerca di eventi di Stand-up Comedy in Italia.

## 🎯 Funzionalità

- **🎪 Creazione eventi** con categorie (Serata, Festival, Workshop)
- **🔍 Ricerca eventi** per provincia/città
- **📅 Gestione completa** (modifica, cancellazione)
- **🎤 Informazioni dettagliate** (titolo, locale, indirizzo, organizzatore)
- **💰 Tipologia eventi** (Gratuiti/A pagamento)
- **🗺️ Zone speciali** per Milano e Roma (Nord/Centro/Sud)

## 🚀 Comandi Bot

- `/start` - Messaggio di benvenuto
- `/crea` - Crea nuovo evento
- `/cerca` - Cerca eventi per zona
- `/miei_eventi` - Visualizza i tuoi eventi
- `/ultimi` - Ultimi 20 eventi inseriti
- `/modifica_evento` - Modifica data evento
- `/cancella_evento` - Cancella evento
- `/donazioni` - Supporta il progetto
- `/help` - Guida completa

## 🛠️ Setup Locale

### Prerequisiti
- Node.js 18.x o superiore
- Account Telegram Bot (token da @BotFather)

### Installazione
```bash
# Clona il repository
git clone https://github.com/TUO-USERNAME/comedy-bot-telegram.git
cd comedy-bot-telegram

# Installa dipendenze
npm install

# Configura variabile ambiente
export BOT_TOKEN="il_tuo_token_qui"

# Avvia il bot
npm start
```

## 🌐 Deploy su Render

1. **Fork questo repository** su GitHub
2. **Crea account** su [render.com](https://render.com)
3. **Nuovo Web Service** collegato al tuo repository
4. **Configura variabili ambiente:**
   - `BOT_TOKEN`: Il token del tuo bot Telegram

### Configurazione Render
```
Build Command: npm install
Start Command: npm start
Environment: Node
```

## 📁 Struttura Progetto

```
comedy-bot-telegram/
├── bot.js              # File principale del bot
├── package.json        # Dipendenze e script
├── .gitignore         # File da ignorare in Git
└── README.md          # Questa documentazione
```

## 🔧 Variabili Ambiente

| Variabile | Descrizione | Richiesta |
|-----------|-------------|-----------|
| `BOT_TOKEN` | Token del bot Telegram | ✅ Sì |

## 📊 Categorie Eventi

- **🎤 Serata Stand-up (S)** - Serate di comicità
- **🎪 Festival (F)** - Festival e rassegne
- **📚 Corso/Workshop (W)** - Corsi e workshop

## 🗺️ Zone Supportate

- **Roma**: Nord, Centro, Sud
- **Milano**: Nord, Centro, Sud
- **Tutte le province italiane**

## 📝 Formato Eventi

Ogni evento include:
- Data e ora
- Titolo della serata
- Nome del locale
- Indirizzo (opzionale)
- Città e provincia
- Posti comici disponibili
- Organizzatore/MC (opzionale)
- Tipo: Gratuito/A pagamento
- Categoria

## 🤝 Contributi

Questo bot è stato sviluppato per la community italiana della stand-up comedy.

### Autore
- **Idea originale**: @dinobronzi82
- **Sviluppo**: Bot Comedy Community

## 📞 Supporto

Per supporto o donazioni:
- Revolut: https://revolut.me/r/ZDIdqlisIP
- Telegram: @dinobronzi82

## 📜 Licenza

MIT License - Libero per uso personale e commerciale.

---

🎭 **Fai ridere l'Italia con il Comedy Bot!** 🎤