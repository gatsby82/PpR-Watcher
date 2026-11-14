# P+R Watcher

Budapesti P+R parkolók szabad helyeinek valós idejű figyelése.

Két változat van a repóban:

- **Flutter app** – a repó gyökerében (ez a leírás)
- **Webes Angular app** – az [`angular/`](angular/) mappában, GitHub Pagesre telepítve, iPhone-on kezdőképernyőre tehető

Figyelt parkolók (alapértelmezés):

| Azonosító | Parkoló | Kapacitás |
|---|---|---|
| P061 | KÖKI Terminál P+R parkolóház | 330 |
| P051 | Kőbánya-Kispest P+R | 206 |

## Működés

Az app 10 másodpercenként lekérdezi a Budapest Közút Közútfigyelő háttér-API-ját
(ugyanazt, amit a https://kozutfigyelo.budapestkozut.hu oldal használ):

```
POST https://kozutfigyelo-back.budapestkozut.hu/api/ikszr/get
Content-Type: application/json

{"objectType": "parking-facilities", "externalId": "P061"}
```

A válaszban a `data.instance.free_capacity` a szabad, a `capacity` az összes hely.

- Kártyánként: szabad / összes hely, telítettségi sáv, változás az előző lekérdezéshez képest
- Színek: zöld, narancs (< 25% szabad), piros (tele)
- Háttérben szünetel a lekérdezés, előtérbe hozva azonnal frissít
- Lehúzással kézi frissítés

Új parkoló felvétele: bővítsd a `watchedIds` listát a `lib/main.dart` elején.

## Futtatás

```
flutter pub get
flutter run
```

Megjegyzés: Flutter Web alatt a böngésző CORS-szabályai blokkolhatják az API-hívást;
Androidon, iOS-en és asztali platformokon nincs ilyen korlát.
