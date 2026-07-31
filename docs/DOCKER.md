# GambaKing im Docker-Container — neben einer bestehenden Website

Ziel: deine bisherige Seite bleibt auf `https://deine-domain.ddns.net/`,
das Casino kommt daneben auf `https://deine-domain.ddns.net/gamba/`.
Beides läuft als eigener Container, Traefik verteilt die Anfragen und
kümmert sich um das Let's-Encrypt-Zertifikat.

```
                    ┌───────────────────────────────┐
  Internet  :443 ──▶│  Traefik  (Router + TLS)      │
                    └───────┬───────────────┬───────┘
                            │               │
              PathPrefix(/gamba)     alles andere
                            │               │
                    ┌───────▼──────┐  ┌─────▼─────────┐
                    │  gambaking   │  │ deine bisher. │
                    │  :3000       │  │ Website       │
                    └──────┬───────┘  └───────────────┘
                           │
                    Volume gambaking-data  (Konten, Chips, Feed)
```

---

## 1. Was in diesem Repo dazugekommen ist

| Datei | Zweck |
|---|---|
| `Dockerfile` | Image auf Basis `node:22-alpine`, läuft als Benutzer `node`, mit Healthcheck |
| `docker-compose.yml` | der Casino-Container mit allen Traefik-Labels |
| `docker-compose.local.yml` | zum Ausprobieren ohne Traefik (`localhost:8080/gamba/`) |
| `.env.example` | Domain, Unterpfad, Admin-PIN — als `.env` kopieren |
| `.dockerignore` | hält `data/`, `.git` und Screenshots aus dem Image |

Im Server sind drei Dinge dazugekommen, die den Betrieb hinter einem Proxy
erst möglich machen:

* **`BASE_PATH`** — der Server weiß, dass er unter `/gamba` hängt. Er
  beantwortet sowohl `/gamba/api/state` als auch `/api/state` und leitet
  `/gamba` auf `/gamba/` weiter (ohne den Schrägstrich würde der Browser die
  CSS- und JS-Dateien auf der Domain-Wurzel suchen und deine Hauptseite
  bekäme die Anfragen).
* **`TRUST_PROXY=1`** — die Brute-Force-Bremse beim Login liest die echte
  Besucher-IP aus `X-Forwarded-For`. Ohne das säßen alle Besucher hinter
  derselben Proxy-IP und acht Fehlversuche eines Einzelnen würden alle
  aussperren.
* **`DATA_DIR`** — die Spielstände liegen unter `/data`, also im Volume und
  nicht im Image. Ein Rebuild kostet keine Konten mehr. Beim `docker stop`
  wird vorher noch gespeichert.

---

## 2. Schnelltest ohne Traefik

Erst prüfen, ob der Container an sich läuft:

```bash
docker compose -f docker-compose.local.yml up --build
```

Dann `http://localhost:8080/gamba/` aufrufen. Konto anlegen, ein Spiel
starten, Seite neu laden — die Chips müssen bleiben. Danach mit `Strg+C`
beenden.

---

## 3. Traefik, falls noch keiner läuft

Wenn du schon einen Traefik betreibst, überspring diesen Schritt und merk
dir nur zwei Dinge: **wie dein externes Netz heißt** (unten `proxy`) und
**wie dein certresolver heißt** (unten `letsencrypt`).

Netz einmalig anlegen:

```bash
docker network create proxy
```

`~/traefik/docker-compose.yml`:

```yaml
services:
  traefik:
    image: traefik:v3.3
    container_name: traefik
    restart: unless-stopped
    command:
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --providers.docker.network=proxy
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      # http → https für alles
      - --entrypoints.web.http.redirections.entrypoint.to=websecure
      - --entrypoints.web.http.redirections.entrypoint.scheme=https
      - --certificatesresolvers.letsencrypt.acme.email=du@example.com
      - --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json
      - --certificatesresolvers.letsencrypt.acme.httpchallenge=true
      - --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./letsencrypt:/letsencrypt
    networks:
      - proxy

networks:
  proxy:
    external: true
```

```bash
cd ~/traefik && docker compose up -d
```

> **Du hast schon ein Let's-Encrypt-Zertifikat von certbot?**
> Dann kannst du es weiterverwenden, statt Traefik ein neues holen zu lassen —
> siehe Abschnitt 7. Einfacher ist es aber, Traefik das Zertifikat selbst
> verwalten zu lassen: dann erneuert es sich automatisch und niemand muss an
> Dateirechte denken.

---

## 4. Deine bestehende Website an Traefik hängen

Der entscheidende Punkt: **die Hauptseite braucht die niedrigere Priorität.**
Traefik nimmt sonst bei zwei passenden Regeln die längere — das klappt hier
zwar meistens, aber mit expliziten Prioritäten gibt es keine Überraschungen.

```yaml
services:
  website:
    image: nginx:alpine          # oder was auch immer deine Seite ist
    container_name: website
    restart: unless-stopped
    volumes:
      - ./html:/usr/share/nginx/html:ro
    networks:
      - proxy
    labels:
      traefik.enable: "true"
      traefik.docker.network: proxy
      traefik.http.routers.website.rule: "Host(`deine-domain.ddns.net`)"
      traefik.http.routers.website.entrypoints: websecure
      traefik.http.routers.website.tls: "true"
      traefik.http.routers.website.tls.certresolver: letsencrypt
      traefik.http.routers.website.priority: "10"      # niedriger als /gamba
      traefik.http.services.website.loadbalancer.server.port: "80"

networks:
  proxy:
    external: true
```

Läuft deine Seite gar nicht in Docker, sondern direkt auf dem Server (z.B.
ein nginx auf Port 8000), dann bekommt sie in Traefik einen File-Provider
oder du hängst umgekehrt Traefik hinter deinen nginx — siehe Abschnitt 8.

---

## 5. Das Casino starten

```bash
git clone <dein-repo> gambaking
cd gambaking
cp .env.example .env
nano .env            # DOMAIN, CERT_RESOLVER und GAMBAKING_PIN eintragen
docker compose up -d --build
```

Kontrolle:

```bash
docker compose ps                 # Status muss "healthy" sein
docker compose logs -f gambaking  # zeigt Port, Unterpfad und Admin-PIN
curl -s https://deine-domain.ddns.net/gamba/api/health
# → {"ok":true,"players":0,"uptime":12}
```

Dann `https://deine-domain.ddns.net/gamba/` im Browser öffnen. Es kommt
sofort das Anmeldefenster: Name und Passwort wählen, fertig.

Die Admin-PIN steht in den Logs der ersten Sekunden. Ändere sie danach im
Admin-Panel (🛡️ oben rechts) — der Wert aus `.env` gilt nur für den
allerersten Start, danach lebt die PIN in der Datenbank.

---

## 6. Betrieb

```bash
# Update nach Code-Änderungen (Spielstände bleiben im Volume)
git pull && docker compose up -d --build

# Sicherung der Konten
docker run --rm -v gambaking_gambaking-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/gambaking-backup.tgz -C /data .

# Sicherung zurückspielen
docker compose down
docker run --rm -v gambaking_gambaking-data:/data -v "$PWD":/backup alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/gambaking-backup.tgz -C /data"
docker compose up -d

# Kurz reinschauen
docker compose exec gambaking cat /data/gambaking.json | head -40
```

Der Projektname steht fest in der Compose-Datei (`name: gambaking`), das
Volume heißt deshalb auf jedem Server gleich. Nachsehen kannst du mit
`docker volume ls | grep gambaking`.

---

## 7. Ein vorhandenes certbot-Zertifikat weiterverwenden

Nur nötig, wenn Traefik das Zertifikat nicht selbst holen soll. Traefik
bekommt dazu einen kleinen File-Provider:

`~/traefik/dynamic/certs.yml`:

```yaml
tls:
  certificates:
    - certFile: /certs/live/deine-domain.ddns.net/fullchain.pem
      keyFile:  /certs/live/deine-domain.ddns.net/privkey.pem
```

Im Traefik-Compose ergänzen:

```yaml
    command:
      - --providers.file.directory=/dynamic
      - --providers.file.watch=true
    volumes:
      - ./dynamic:/dynamic:ro
      - /etc/letsencrypt:/certs:ro
```

Bei den Routern dann `tls: "true"` behalten, aber die Zeile mit
`certresolver` weglassen. In `.env` bleibt `CERT_RESOLVER` einfach leer —
oder du löschst die entsprechende Label-Zeile aus `docker-compose.yml`.

Nach jeder certbot-Erneuerung Traefik neu laden:
`docker compose restart traefik` (oder ein `--deploy-hook` in certbot).

---

## 8. Wenn schon ein nginx/Apache vor allem steht

Traefik ist dann überflüssig. Der Casino-Container bekommt einen Port auf
`127.0.0.1` und dein bestehender Webserver reicht `/gamba` durch. In
`docker-compose.yml` die `labels:` und den `networks:`-Block weglassen und
stattdessen:

```yaml
    ports:
      - "127.0.0.1:3000:3000"
```

nginx-Konfiguration:

```nginx
location /gamba/ {
    proxy_pass         http://127.0.0.1:3000/gamba/;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
}
location = /gamba {
    return 301 /gamba/;
}
```

`BASE_PATH=/gamba` und `TRUST_PROXY=1` bleiben gesetzt, `proxy_pass` behält
den Pfad also bei. Das Casino braucht kein WebSocket und kein Buffering-Tuning.

---

## 9. Wenn etwas nicht geht

| Symptom | Ursache | Lösung |
|---|---|---|
| `/gamba` zeigt die alte Website | Router-Priorität | `priority: "100"` beim Casino, kleinerer Wert bei der Hauptseite |
| Seite lädt, aber ohne Design | Prefix wird gestrippt oder der Schrägstrich fehlt | kein `stripprefix`-Middleware verwenden, `BASE_PATH` muss gesetzt sein |
| „Server nicht erreichbar" im Spiel | `/gamba/api/...` kommt nicht an | `curl https://…/gamba/api/health` testen |
| Alle Konten nach `up --build` weg | Volume fehlt oder wurde umbenannt | `docker volume ls`, Volume `gambaking-data` muss auf `/data` liegen |
| „Zu viele Fehlversuche" für alle | `TRUST_PROXY` nicht gesetzt | `TRUST_PROXY: "1"` in `docker-compose.yml` |
| Container `unhealthy` | Server startet nicht | `docker compose logs gambaking` |
| 404 bei `/gamba/` | Router greift nicht | `docker compose logs traefik`, Netz `proxy` bei beiden Containern gleich? |

Das Casino spielt weiterhin ohne Echtgeld: es gibt keine Bezahlung, keine
Einzahlung und keine Auszahlung — nur Chips, die nichts wert sind.
