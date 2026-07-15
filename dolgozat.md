** 1. A dolgozat célja **
A 2. házi feladatban egy kisebb fejlesztési feladatot kellett elvégzni 2 külön plugin-nel, és ki kellett tapasztalni, hogy melyik eszközzel milyen volt a munka. Majd ezek alapján el kellett dönteni, hogy melyiket használnám hosszú távon fejlesztésre, és ezt megindokolni a tapasztalt előnyök és hátrányok alapján.

** 2. harness/superpowers
* Setup és tanulási görbe *
A Superpowers repo-ja (github.com/obra/superpowers) alapján könnyen és gyorsan be lehetett üzemelni.
A fejlesztési folyamat számomra ezzel a plugin-nel jól átlátható és könnyen követhető volt.

* Steering *
A tapasztalatom szerint nem nagyon kellett terelni a folyamat során a Claude Code-ot, javítani sem kellett manuálisan.

* Tervezési fázis *
Készített egy tervet az implementáció előtt, amihez tartotta magát. A feladatot 8, dokumentált task-ra bontotta, ami követhetőbbé tette a folyamatot.

* Kód minősége *
Jó minőségű kód készült, elsőre működött is. Teszteket végzett, de mentett teszt dokumentumokat nem találtam. Az edge case-eket (pl. ismeretlen település, null-koordináta) megfelelően kezelte.

* Kontroll *
A tapasztalataim alapján elegendő volt az, hogy elfogadjam a javaslatait a folyamat során.

* Gyorsaság *
Kicsit lassabb volt a BMAD-nél a tapasztalatom szerint.

** 3. harness/bmad
* Setup és tanulási görbe *
A BMAD repo-ja (github.com/bmad-code-org/BMAD-METHOD) alapján könnyen és gyorsan be lehetett üzemelni, bár számomra picit nehezebben, mint a Superpowers-t.
A fejlesztési folyamat számomra ezzel a plugin-nel átlátható és követhető volt.

* Steering *
A tapasztalatom szerint nem nagyon kellett terelni a folyamat során a Claude Code-ot, javítani sem kellett manuálisan. A review-k során talált hibát, de azt javította is teljesen automatikusan. Erről szólt, de teendőm nem volt vele.

* Tervezési fázis *
Nem készült tervezési dokumentum.

* Kód minősége *
Jó minőségű kód készült, elsőre működött. Teszteket végzett, de mentett teszt dokumentumokat nem találtam. Az edge case-eket (pl. ismeretlen település, null-koordináta) megfelelően kezelte.

* Kontroll *
A tapasztalataim alapján elegendő volt az, hogy elfogadjam a javaslatait a folyamat során.

* Gyorsaság *
Kicsit gyorsabb volt a Superpowers-nél a tapasztalatom szerint.

** 3. Összegzés: **
Hosszú távú fejlesztésre én a Superpowers plugint használnám. Bár kicsit idő-, és talán token igényesebb, mint a BMAD, de számomra jobban átláthatók voltak a folyamat lépései, és a tervezés fázisra is nagyobb hangsúlyt fektetett ezzel a Claude Code agent. A generált tervezési és egyéb dokumentumoknak köszönhetően jobban visszakövethető a fejlesztési folyamat.