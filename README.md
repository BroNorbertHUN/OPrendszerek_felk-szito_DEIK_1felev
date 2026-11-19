# Linux ZH gyakorló

React + TypeScript frontend és Express API a Linux gyakorlati ZH feladatainak megoldásához. A feladatbank 50 kérdést tartalmaz; minden új feladatsor véletlenszerű 10 kérdést választ.

## Indítás Windows alatt

1. Nyiss terminált ebben a mappában.
2. Futtasd: `npm install`
3. Futtasd: `npm run dev`
4. Nyisd meg a Vite által kiírt címet, alapértelmezetten `http://localhost:5173`.

A frontend az 5173-as, a backend a 3001-es porton indul. A terminált hagyd nyitva, amíg dolgozol.

## Használat Linux virtuális gépből

A VM saját `localhost` címe a Linux virtuális gépre mutat, ezért a Windows gazdagépen futó API-t a VM-ből elérhető gazdagép címmel kell megadni. A backend a `3001`-es porton minden hálózati interfészen figyel.

- **VirtualBox NAT** esetén próbáld a `http://10.0.2.2:3001` címet.
- **Bridged, host-only vagy más hypervisor** esetén add meg a Windows gazdagép VM felőli IP-címét. A gazdagépen a `ipconfig` paranccsal keresd meg a VM hálózatához tartozó adapter IPv4 címét.

Ellenőrzés a VM termináljából: `curl http://10.0.2.2:3001/api/config`. Siker esetén JSON választ kapsz. Ha nem csatlakozik, ellenőrizd a VM hálózati módját és a Windows tűzfal 3001-es portszabályát.

A weboldal **A virtuális gépből elérhető API-cím** mezőjének alapértéke VirtualBox NAT esetén `http://10.0.2.2:3001`. Az inicializáló és ellenőrző parancsok automatikusan ezt fogják használni. Futtasd az inicializáló parancsot a VM-ben, oldd meg a feladatot, majd futtasd a feladat saját ellenőrző parancsát.

## Tartalom és végpontok

- `data/questions.json`: feladatdefiníciók; legalább 10 feladat szükséges.
- `sources/`: letölthető saját forrásfájlok.
- `solutions/`: összehasonlítási fájlok.
- `POST /api/sessions`: új, véletlenszerű 10 feladatos munkamenet.
- `GET /api/init-script/:sessionId`: a munkamenet forrásfájljait letöltő Bash script.
- `GET /api/sources/:sessionId/:questionId`: egy forrásfájl.
- `POST /api/verify/:sessionId/:questionId`: egy feladat `file` mezőként feltöltött megoldásának ellenőrzése.
- `POST /api/verify-batch/:sessionId`: csoportos ellenőrzés a `meg_*.txt` fájlokkal.
- `GET /api/sessions/:sessionId`: pontszám és feladatonkénti állapot.

Az API külső elérési címét a `PUBLIC_BASE_URL` környezeti változóval is be lehet állítani. A munkamenetek a backend memóriájában élnek; a szerver újraindítása új munkameneteket igényel.

## Fejlesztői ellenőrzés

- `npm run build` – TypeScript ellenőrzés és frontend build.
- `npm test` – kimenet-normalizálási tesztek.
