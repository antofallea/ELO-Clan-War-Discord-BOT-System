# ELO Clan War Discord Bot

Bot Discord per matchmaking player e clan, ELO, score con prova immagine, report, ScreenShare e gestione accessi tramite registrazione.

## Avvio

1. Copia `config.example.js` in `config.js` e completa gli ID richiesti.
2. Imposta il token in PowerShell: `$env:DISCORD_TOKEN = 'il-tuo-token'`.
3. Installa e avvia: `npm install`, poi `npm start`.
4. Nel server, come staff: `=access setup`, `=season start Nome`, `=queue config 5 2`, `=queuevoice create 10`.

Non pubblicare mai `config.js`, `.env` o `json.sqlite`: sono ignorati intenzionalmente.
