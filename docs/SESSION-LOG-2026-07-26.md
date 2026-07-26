# GurmeGo — Oturum Günlüğü (2026-07-26 ve sonrası)

**Amaç:** Bu doküman, oturumun tamamını (ne yapıldı, nerede kalındı, sırada ne var) tek yerde
tutar — `docs/STATE.md` 50 satır tavanlı bir özet olduğu için burada tam ayrıntı var. Kullanıcı
talebi (2026-07-26): "her adımdan sonra bu dokümanı güncelle, sorun çıksa da çıkmasa da". Bu
dosya her anlamlı adımdan sonra güncellenir — en yeni durum en üstte "ŞU AN NEREDEYİZ" bölümünde.

---

## ŞU AN NEREDEYİZ (en son güncelleme: Plan 4b/4c tasarımı, round 2 PIVOT sonrası düzeltme)

**Aktif iş:** Plan 4b (backend) + Plan 4c (frontend) tasarım dokümanları, idea-red-team'in 2.
PIVOT verdiğinden sonra 3. kez düzeltiliyor. Kullanıcı "artık bana sormadan devam et" dedi
(2026-07-26) — bundan sonraki adımlar onay beklemeden yürütülecek, yalnızca bu dosya güncellenecek.

**Sıradaki somut adım:** Backend tasarımına şu düzeltmeleri işlemekteyim:
1. Bölüm 2.5 (yeni): `@UserLocation()` decorator + header parse + sort-varsayılanının şemadan
   servise taşınması (round 1'de vardı, round 2 yeniden yazımında sehven silindi).
2. Bölüm 2: CSV `status` boş hücre normalizasyonu (`z.preprocess`).
3. Bölüm 4: Version snapshot'ın PostGIS konumu içermesi için raw-SQL "tam satır" okuma.
4. Bölüm 6: `open_now`'a zaman dilimi + malformed-veri koruması.
5. B10: `/districts/nearest` projeksiyonunun `cityId`+`slug` de seçmesi (önceden bozuk bulundu).
6. B8: `AdminQueueMutationResultSchema`'nın da `REPORT|EDIT` kabul etmesi.

Frontend tasarımına işlenecekler:
1. C6 (kategori hızlı rota "doğrudan yol tarifi"): `venue-detail.tsx`'teki mevcut isim+ilçe
   text-search deep-link deseni (`directionsUrl`) paylaşılan bir helper'a çıkarılıp
   `CategoryQuickRoute`'ta tekrar kullanılacak — koordinat/yeni şema alanı GEREKMİYOR, çünkü
   `[district]/page.tsx` zaten hangi ilçede olduğunu biliyor, listedeki ilk mekanın adını
   kullanmak yeterli.
2. Header client-tarafı implementasyonunun backend'in yeni Bölüm 2.5'iyle senkron olduğunu
   doğrulamak (aynı header adı/formatı).

**Bu düzeltmeler bitince:** 3. bir idea-red-team turu çalıştırılacak (`codex exec`, stdin pipe,
büyük prompt — geçmiş derste görüldüğü gibi `-c model_reasoning_effort=high` ile 400-580s
sürebiliyor). GO/HAZIR-eşdeğeri bir sonuç alınırsa `writing-plans` (Plan 4b, sonra Plan 4c) →
`plan-red-team` (Codex, HAZIR olana kadar tekrar) → `subagent-driven-development` ile yürütme →
final review (Superpowers + bağımsız Codex) — bu adımların HİÇBİRİNDE kullanıcıya onay
sorulmayacak (yeni talimat), yalnızca bu dosya her adımdan sonra güncellenecek.

---

## TAM KRONOLOJİ (bu oturumda yapılanlar, sırayla)

### 1. Oturum başlangıcı — worktree karışıklığı (ÇÖZÜLDÜ)
Bir önceki oturum session limitine çarpıp Plan 3 Task 7'nin ortasında yarım kesilmişti; root
`docs/STATE.md` hiç güncellenmemiş kalmıştı ("Plan 1 hiç başlamadı" diyordu). Bu oturum açılınca
bu bayat bilgiye güvenilip **yanlışlıkla `master`'da ikinci, gereksiz bir worktree açılıp zaten
bitmiş Task 0/1 tekrar yürütüldü**. Gerçek ilerlemenin `.claude/worktrees/mvp-backend-foundation`
(branch `worktree-mvp-backend-foundation`) adlı kilitli native worktree'de olduğu keşfedildi.
Yanlış worktree silindi, root STATE.md worktree'ye işaret edecek şekilde güncellendi, ders
STATE.md'ye kalıcı olarak yazıldı ("worktree'de ilerleme varsa root'a en azından işaretçi bırak").

### 2. Plan 3 (Admin panel) Task 7 tamamlandı
Kritik bir auth guard bug'ı (Fastify altında `JwtAuthMiddleware`'in `RolesGuard`'a hiç görünmemesi
— tüm admin API'si her zaman 403 dönüyordu) gerçek HTTP + gerçek Supabase JWT ile doğrulandı.
Final review (Superpowers/Codex-routed + bağımsız 2. Codex geçişi) **4 fix/re-review turu**
gerektirdi — her turda bir önceki fix'in kendisi yeni bir regresyon yarattı. 5. turda TEMİZ.
Ders (STATE.md'ye yazıldı): review loop'unu "muhtemelen temizdir" varsayımıyla erken kesme.

### 3. Plan 4a (packages/shared build fix) — tam döngü
- Brainstorming → tasarım → **idea-red-team 6 tur** (1-2: gereksiz kurumsal CI/CD koreografisi
  → kapsam yalnızca build fix'e indirildi; 3-6: `tsup`→düz`tsc`, smoke test yarış durumu,
  `prepare` script, `pnpm exec turbo` gibi mekanik detaylar).
- writing-plans → **plan-red-team 3 tur** (DB önkoşulu, curl timeout/exact-200, gerçek port
  uyuşmazlığı [54321/54322 örnek vs 54421/54422 gerçek], remote'suz repoda push varsayımı).
- subagent-driven-development ile 3 task yürütüldü, hepsi review'dan geçti.
- Final review: Superpowers + bağımsız Codex, ikisi de TEMİZ.
- **Plan 4a TAMAMLANDI.** Commit: `7f8bbc4` (ci: add real process-boot smoke test...).

### 4. Kapsamlı A-Z denetim (`docs/AUDIT-2026-07-26.md`)
Kullanıcı talebiyle: iki bağımsız Codex tam-kaynak denetimi (apps/api+packages/shared ayrı,
apps/web+apps/admin ayrı, TÜM production kaynak kodu inline verilerek — "kesif yapma, verilen
icerikle sinirla" talimatiyla, cunku ajanik kesif modu iki kez timeout'a ugradi) + kendi
spec-kapsam taramam (prd.md/api-spec.md karşı kod envanteri).

**Sonuç: "Pilot için hazır değil."** Backend: 1 CRITICAL + 16 HIGH. Frontend: 9 HIGH + 18
MEDIUM/LOW. En kritik bulgu: **API/admin üzerinden hiçbir mekan PUBLISHED yapılamıyor** (status
alanı create/update şemalarında yok). Diğer önemliler: konum koordinatı URL'ye yazılıyor (NFR-04
riski, gerçek hosting'e çıkılınca), kuyruk onayı içerik uygulamıyor, admin update versiyon
geçmişi tutmuyor, re-verify cron'u hiç bağlı değil, cursor pagination kırık.

Denetim raporu commit: `9d6bead`.

### 5. Plan 4b (backend) + Plan 4c (frontend) tasarımı — devam eden iş

**Kullanıcı kararı:** Denetimdeki TÜM bulgular tek bir "yeni plan" ile düzeltilsin (kullanıcının
kelimeleri: "bana sunduğun hataların tamamını yeni bir plan oluşturarak düzenle"). Brainstorming
sırasında backend/frontend'in bağımsız alt sistemler olduğu tespit edilip iki ayrı plana
(4b backend + 4c frontend) bölünmesi önerildi, kullanıcı onayladı.

**Brainstorming'de alınan 5 ürün kararı:**
1. Backend/frontend iki ayrı plan (4b + 4c).
2. A3 (REPORT onayı anlamı): "Onay = rapor haklı, ekip dışarıda düzeltti" — onay artık
   `verifiedAt`'i KENDİ BAŞINA güncellemez, asıl güncelleme ayrı bir admin-update adımında olur.
3. A1 (yayınlama): `status` alanı create/update şemasına eklensin (ayrı publish endpoint değil).
4. B3 (re-verify cron): 4b'ye dahil edilsin, gerçek cron bağlansın (pilot süresi 90 günlük eşiği
   hiç tetiklemeyecek olsa da, doğru altyapı olması için).
5. A2 (konum/NFR-04): REST semantiğini bozmadan `X-User-Location` header'ına taşınsın (GET
   query param yerine).

**İdea-red-team round 1: PIVOT.** Codex'in bulduğu, kodda doğrulanmış 7 gerçek mimari sorun:
CSV'nin ayrı şeması (status eklemenin CSV'yi etkilemediği), repository'nin transaction-farkında
olmaması (A4'ün `$transaction` deseni gerçek mimariyle uyumsuzdu), `findBySlug`'ın konum
döndürmemesi, `open_now`'ın gerçek veri şekliyle (`mon_fri`/`sat_sun`) uyuşmaması,
`z.coerce.boolean()` tuzağı, cron test/implementasyon isim tutarsızlığı, `trustProxy: true`'nun
"zararsız" olmaması.

**Bu turda alınan 2 ek kullanıcı kararı:**
1. CSV importa opsiyonel `status` kolonu eklensin, **varsayılan PUBLISHED** (kürasyon ekibi CSV'ye
   koymadan önce zaten doğruluyor).
2. Cursor pagination bu pilot ölçeğinde (30-45 mekan, tek sayfaya sığar) ertelensin, `limit`
   varsayılanı yükseltilsin.

**Tasarımlar round 2'ye revize edildi** (commit `3525640`) — 7 bulgunun hepsi işlendi + kullanıcı
kararları.

**İdea-red-team round 2: yine PIVOT** (ama bu kez "4/7 tam, 3/7 kısmi düzeltme", yaklaşım artık
temelde doğru, ayrıntı eksikleri var). Yeni/kısmi bulgular (hepsi kodda doğrulandı):
- Konum header'ının backend implementasyonu (round 1'de tasarlanan `@UserLocation()` decorator'ı)
  round 2 yeniden yazımında SEHVEN dokümandan düşmüştü.
- CSV boş `status` hücresi `""` üretir, Zod `.optional()` bunu "verilmedi" saymaz — normalizasyon
  gerekiyor.
- `/districts/nearest` projeksiyonu ÖNCEDEN BOZUK (yalnızca `{id,name}` seçiyor, şema `cityId`+
  `slug` da istiyor) — bu plandan bağımsız, pre-existing bir bug, ama bu plan bu alanı zaten
  düzenlediği için burada da düzeltilecek.
- Version snapshot/revert, PostGIS konumunu hiç kapsamıyor (Prisma'nın normal `venue` read'i bu
  kolonu okuyamıyor — ADR 002).
- `open_now`'da zaman dilimi garantisi yok, malformed `openingHours` tüm sorguyu düşürebilir.
- `AdminQueueMutationResultSchema` hâlâ yalnızca `REPORT` literal.
- (Frontend tarafı) `CategoryQuickRoute`'un "en yakın mekana git" önerisi mevcut veri
  sözleşmesiyle uyumsuzdu (VenueListItem'da koordinat/ilçe yok) — çözüm: koordinat eklemek
  yerine, zaten var olan isim+ilçe text-search deep-link desenini (venue-detail.tsx'teki
  `directionsUrl`) paylaşılan bir helper'a çıkarıp tekrar kullanmak (ilçe zaten sayfa seviyesinde
  biliniyor, yeni veri gerekmiyor).

**Şu an bu round 2 bulgularını iki tasarım dokümanına işliyorum** (yukarıdaki "ŞU AN
NEREDEYİZ" bölümündeki 6+2 madde).

---

## TÜM AKTİF/TAMAMLANMIŞ PLANLARIN DURUMU (özet tablo)

| Plan | Konu | Durum | Not |
|---|---|---|---|
| 1 | Backend + Data Foundation | ✅ 24/24 | final review temiz |
| 2 | Web/PWA consumer client | ✅ 12/12 | final review temiz |
| 3 | Admin panel | ✅ 7/7 | final review 4 tur sonrası temiz |
| 4a | packages/shared build fix | ✅ 3/3 | final review temiz, 6 idea-red-team + 3 plan-red-team turu |
| 4b | Backend kritik düzeltmeler (audit'ten) | 🔄 Tasarım aşaması | idea-red-team round 3 bekliyor |
| 4c | Frontend kritik düzeltmeler (audit'ten) | 🔄 Tasarım aşaması | Plan 4b'ye bağımlı, sırada |

**Hiçbir plan `master`'a merge edilmedi** — kullanıcı kararı: hepsi bitince tek seferde review
edilip merge edilecek. Bu, oturum boyunca değişmedi.

## ÖNCELİKLİ TAKİP MADDELERİ (Plan 4b/4c dışında kalan, ayrıca ele alınacak)

1. **Supabase Auth↔Prisma `User` senkronizasyonu yok** (trigger eksik) — kayıt olan kullanıcı ilk
   favoriyi eklerken FK hatası alabilir. Pilot açılmadan önce düzeltilmeli. **Plan 4b/4c'de YOK,
   ayrı ele alınacak.**
2. **Pilot karar metrikleri hiçbir yerde ölçülmüyor** (Maps'e gitme/kaydetme/paylaşma, 4. hafta
   dönüş — `prd.md §5`). Analytics/event-capture kodu hiç yok. Ayrı bir plan gerektirir.
3. Railway/Vercel/Supabase gerçek provisioning — hesap açılınca ayrı oturumda (Plan 4a'dan
   idea-red-team ile bilinçli çıkarılmıştı).
4. KVKK metinleri + pilot launch checklist (orijinal "Plan 4b" — şimdi audit-fix planları 4b/4c
   olduğu için bu muhtemelen "Plan 4d" olacak, henüz brainstorm edilmedi).
5. `apps/api/.env.example`'daki bayat Supabase port varsayılanları (54321/54322 vs gerçek
   54421/54422) — küçük, düşük öncelik.

## KALICI DERSLER (bu oturumda öğrenilen, tekrarlanmaması gereken hatalar)

1. Worktree'de ilerleme varsa root `docs/STATE.md`'ye en azından bir işaretçi bırak — tam
   detayı tekrarlama, ama "buraya bak" de.
2. Review/red-team loop'unu "muhtemelen temizdir" varsayımıyla erken kesme — Codex gerçekten
   TEMİZ/HAZIR diyene kadar devam et. Aynı dosya/mantık birden fazla kez düzeltiliyorsa bu
   regresyon riskinin arttığının işaretidir, azaldığının değil.
3. `codex exec`'e büyük içerik (diff veya kaynak kod) verirken: (a) stdin'den pipe et (`- < dosya`),
   asla komut satırı argümanı olarak embed etme ("Argument list too long" / hang riski); (b)
   ajanik keşif moduna bırakma (büyük kod tabanında kendi başına dosya okumaya çalışırsa timeout
   riski yüksek) — ilgili kaynağı doğrudan prompt'a inline et, "ek keşif yapma" talimatı ver;
   (c) `--sandbox read-only` bayrağı bu ortamda çalışmıyor gibi görünüyor (süresiz "düşünme"ye
   takılıp hiç yanıt üretmedi) — kullanma.
4. Bir tasarımı büyük ölçüde yeniden yazarken önceki round'da doğru olan bir bölümü (bu oturumda:
   konum header'ının backend implementasyonu) sehven silmemek için, revizyon sonrası yeni
   dokümanı eski dokümanla bölüm bölüm karşılaştır.
5. Bir "düzeltme" tasarımı yazmadan önce, iddia edilen mevcut davranışı (örn. "CSV zaten aynı
   şemayı kullanıyor", "bu alan zaten var") gerçekten kodda doğrula — varsayımla yazma. Bu
   oturumda idea-red-team bunu iki kez (CSV şeması, transaction mimarisi) yakaladı ve her ikisi
   de gerçekten yanlıştı.
6. PostGIS `Unsupported(...)` kolonları (ADR 002) Prisma Client API'nin normal `findUnique`/
   `findFirst`/model-read çağrılarında GÖRÜNMEZ — bu kolonu içeren her okuma (detay, snapshot,
   versiyon) `$queryRaw` ile `ST_Y`/`ST_X` kullanmak zorunda. Bunu unutmak bu oturumda 3 ayrı
   yerde (findBySlug, version snapshot, ilk A4 tasarımı) aynı hataya yol açtı.

---

## KULLANICI TALİMATI (2026-07-26, bu dosyanın yazılma nedeni)

> "Önce tüm herşeyi unutmamak için döküman haline getir... Tüm bunları yaptıktan sonra eğer sorun
> oluştuysa o sorun veya sorunları çöz eğer oluşmadıysa ve herşey tamamıyla okeyse öncelikli
> takip maddelerini sırasıyla yap plan yaz ve harekete geç planları bana sormana gerek yok
> şimdilik direkt harekete geçebilirsin ama ne yaptığını unutma ben sana sorduğumda anlat ve
> sorun çıksa da çıkmasa da yaptığın her işlemden sonra bir sonrakine geçmeden hatırlamamızı
> sağlayan dökümanı revize et."

**Yorumum:** Bundan sonra plan onayı için kullanıcıya sormayacağım — zorunlu red-team/review
geçitleri (idea-red-team, plan-red-team, final review + cross-model-review) hâlâ ÇALIŞACAK
(bunlar CLAUDE.md'nin değişmez kuralları, "kullanıcı onayı" değil "kalite geçidi"), ama her
geçit sonrası kullanıcıya durup sormak yerine sonucu bu dosyaya yazıp devam edeceğim. Yalnızca
gerçek, geri dönüşü zor kararlar (ör. `master`'a merge, gerçek hesap açma/harcama) için durup
soracağım — bunlar zaten önceden "kullanıcı onayıyla" olarak işaretlenmiş kalıcı kurallar.
