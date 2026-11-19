# ⛵ Ostrvo Trgovaca

Online igra za 2 do 8 igrača u browseru: gradi sela i gradove na ostrvu od šestouglova, trguj sirovinama i prvi stigni do 10 poena.

## Šta igra ima
- Sobe sa linkom za prijatelje (2–4 igrača obična tabla, 5–6 i 7–8 veća tabla)
- Kockice, sirovine, lopov na 7 i odbacivanje karata
- Putevi, sela, gradovi, luke (4:1, 3:1, 2:1)
- Razvojne karte: Vitez, Bod pobede, Graditelji puteva, Obilje, Monopol
- Trgovina sa igračima i bankom
- Najduži put i najveća vojska
- Ćaskanje i dnevnik poteza; posle osvežavanja stranice vraćaš se u igru

## Pokretanje na svom računaru
1. Instaliraj [Node.js](https://nodejs.org) (LTS verzija).
2. U ovom folderu pokreni `npm install`, pa `npm start`.
3. Otvori http://localhost:3000

## Postavljanje na internet (Render, besplatno)
Repozitorijum ima `render.yaml`. Na render.com izaberi **New → Blueprint**, poveži ovaj GitHub repozitorijum i potvrdi. Posle par minuta dobijaš link koji šalješ prijateljima.

## Trajno čuvanje naloga (baza podataka)
Besplatni Render server briše fajlove kad se ugasi. Zato igra, ako postoji promenljiva **DATABASE_URL**, čuva profile igrača, statistiku, obaveštenje i partije u Postgres bazi (npr. besplatna baza na [neon.tech](https://neon.tech)).
Na Renderu: servis → **Environment** → **Add Environment Variable** → ključ `DATABASE_URL`, vrednost = adresa baze sa Neona. Adresu baze nikad ne stavljaj u kod.
Bez te promenljive igra čuva u lokalne fajlove u folderu `data/`.

## Za programere
- `game.js` sva pravila igre
- `store.js` čuvanje u bazi (DATABASE_URL) ili u fajlovima
- `server.js` Express + Socket.IO server sa sobama
- `public/` interfejs (HTML, CSS, JS, SVG tabla)
- `npm test` pušta botove da odigraju 100 partija i proverava pravila
