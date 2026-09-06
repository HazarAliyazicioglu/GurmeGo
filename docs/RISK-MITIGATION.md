# GurmeGo — Risk & Çözüm Envanteri (Round 2 Red-team)

**Tarih:** 2026-07-16 · **Kaynak:** Codex (GPT-5.6 Sol, `model_reasoning_effort=high`) round 2 red-team,
web araması dahil (rakip kontrolü). İlgili: [docs/CHANGELOG.md](CHANGELOG.md) · [prd.md](prd.md)

> **Durum (2026-07-28):** Bu dosyanın kendi sonunda açık bıraktığı karar ("hangi çözümlerin
> uygulanacağına karar verilmedi") **round 3'te (2026-07-24) kapatıldı** — 8 perspektifli panel +
> Pilot Karar Sözleşmesi ile KOŞULLU-GO verdiğine ulaşıldı. Detay: `docs/CHANGELOG.md`'nin
> "2026-07-24 — Round 3" girdisi, `prd.md §1/§5`. Bu dosya artık yalnızca tarihsel kayıt olarak
> tutuluyor, aktif karar bekleyen bir madde içermiyor.

---

## Round 2 verdikti: NO-GO (round 1'e göre gelişme var)

Codex'in özeti: *"Revizyon, Round 1'deki 'bunu sürdüremezsiniz' problemini küçültmüş. Fakat 'insanlar
bunu neden düzenli kullansın?' problemini çözmemiş. Ürün artık daha yapılabilir, ama hâlâ yapılmaya
değer olduğu kanıtlanmış değil."*

### Round 1 eleştirilerinin durumu

| # | Round 1 eleştirisi | Durum |
|---|---|---|
| 1 | Küçük ekip 225 mekanı + tam menüyü sürdüremez | **KISMEN ÇÖZÜLDÜ** — tam menü kaldırıldı, ekip 2-3 kişiye çıktı, ama nihai mekan sayısı hâlâ yok |
| 2 | Kullanıcı katkısı MVP'de çalışmaz (cold-start döngüsü) | **KISMEN ÇÖZÜLDÜ** — çekirdek veri artık kullanıcıya bağımlı değil, ama yorum/puan/Gurme Puanı hâlâ MVP'de ve aynı cold-start sorununu taşıyor |
| 3 | "Butik" tanımı keyfi DB kuralı | **KISMEN ÇÖZÜLDÜ** — anlatım düzeldi ama "IG/TikTok'ta dolaşan" ölçülebilir değil; keyfilik DB'den küratör takdirine taşındı |
| 4 | Aynı kesişimde 4 rakip var | **ÇÖZÜLMEDİ** — tam fiyat/menü kaldırılınca veri derinliği rakiplere göre azaldı; "kategori rota" + "WhatsApp paylaşım" kolay kopyalanabilir, savunulabilir fark değil |
| 5 | Dağıtım kanalı/ilk kullanıcı belirsiz | **ÇÖZÜLMEDİ** — "restoran bağlantım var" bir varlık, kanal değil; sayı/dönüşüm oranı bilinmiyor |
| 6 | Semantic search/pgvector gereksiz karmaşıklık | **ÇÖZÜLDÜ** — MVP'den tamamen çıkarıldı |

**Yeni tespit (round 2, en temel risk):** Ürünün "Instagram'da gör → Maps'te doğrula → fiyatı ayrı
öğren" akışını tek yere topladığı iddiası **gerçekte doğru değil**: Instagram içeriği GurmeGo'ya
taşınmıyor, kesin fiyat yok (yalnızca ₺/₺₺/₺₺₺), yorum ve yol tarifi için yine Maps'e çıkılıyor. Yani
GurmeGo mevcut 3 adımı kısaltmak yerine **4. bir durak** ekleme riski taşıyor.

Gelir modeli de hâlâ tanımsız: "freemium tercih ediliyor" bir gelir modeli değil.

---

## Sorun → Çözüm (her biri için 3-5 seçenek)

### Sorun 1 — Operasyon kapasitesi: nihai mekan sayısı belirsiz

Küçük ekibin sürdürülebilirliği hesaplanamıyor çünkü hedef mekan sayısı yok.

1. **Küçük başla, ölçerek büyü:** MVP'yi tek ilçe (örn. Kadıköy) ve ~30-40 mekanla başlat; 2-3 haftalık
   pilotta kürasyon ekibinin gerçek zaman harcamasını ölç, sonra diğer ilçelere ölçeklen.
2. **Zaman bütçesinden tersine hesapla:** Ekibin haftalık ayırabileceği toplam saati netleştir (örn. 2
   kişi × 5 saat = 10 saat/hafta ≈ 40 saat/ay), mekan başına giriş+re-verify süresini ölç, mekan sayısı
   hedefini bu bütçeden türet — tahmin değil hesap.
3. **Re-verify yükünü azalt:** 90 günlük döngüyü ilk aşamada 180 güne çıkar (fiyat aralığı kaba
   olduğundan hızlı bayatlamaz) — bakım yükü yarıya iner.
4. **Yarı-otomatik "hâlâ açık mı" kontrolü:** Google Maps/Yemeksepeti üzerinden haftalık toplu kontrol
   eden basit bir script; yalnızca "kapandı" sinyalini otomatik yakala, geri kalanı elle.
5. **Adaptif kapsam:** Sayıyı MVP başlamadan sabitleme; "1. ay sonunda X mekan, gerçek harcanan saat Y"
   diye ölç, hedefi buna göre ayarla.

### Sorun 2 — UGC cold-start: yorum/puan/Gurme Puanı boş başlıyor

Kullanıcı katkısı Faz 2'ye alındı ama yorum/puanlama hâlâ MVP'de; kullanıcı tabanı olmadan boş kalacak.

1. **AK-01'i (c) ile başlat:** MVP'de Gurme Puanını yalnızca kürasyon ekibi versin (rol ağırlığı zaten
   destekliyor); kullanıcı puanlaması kullanıcı tabanı oluşunca (Faz 2) açılsın.
2. **Google puanını özet göster:** Mekan kartında "Google'da 4.3, 120 yorum" gibi tek bir rating+sayı
   (Places API'nin tam review metnini değil, yalnızca özet rakamı çekmek ToS açısından daha hafif ve
   haftalık cache'lenebilir) — güven sinyali baştan var olsun.
3. **Boş durum tasarımı:** Yorumu olmayan mekanlarda kürasyon notunu öne çıkar, "ilk sen yorum yap" CTA'sı
   ekle — boşluk hissini azalt.
4. **Launch öncesi seed tur:** Açılıştan önce 20-30 gerçek kişiden (arkadaş/aile/restoran bağlantıları)
   gerçek deneyime dayalı ilk yorumları topla.
5. **Radikal seçenek — yorumu tamamen Faz 2'ye ertele:** MVP'de yalnızca kürasyon editöryal notu +
   Gurme Puanı (ekip) olsun, kullanıcı review sistemi hiç açılmasın; cold-start sorunu tamamen ortadan
   kalkar.

### Sorun 3 — "Butik" tanımı ölçülebilir değil, küratör takdirine bağımlı

"IG/TikTok'ta dolaşan" ifadesi denetlenemez; B3 yalnızca "editöryal not girildi" diyor, kanıtlamıyor.

1. **Kanıt alanı ekle:** Mekan kaydına "kaynak linki" (hangi IG/TikTok gönderisinde/listede görüldü)
   alanı — soyut ifade yerine iz bırakan referans.
2. **İkili onay:** Bir kürasyon üyesi öneriyor, ikinci üyesi onaylıyor — tek kişi kararı olmaktan çıkar.
3. **Checklist somutlaştır:** "Butik" için 3-5 maddelik yarı-nicel checklist (bağımsız işletme,
   özgün konsept, doğrulanabilir sosyal medya varlığı vb.) — salt editöryal izlenim olmaktan çıkar.
4. **Kullanıcıya şeffaf göster:** Mekan sayfasında "neden butik" kısa açıklaması — tanım tartışmalı
   kalsa bile güven şeffaflıkla yönetilir.
5. **Şube sayısını objektif kaynağa bağla:** `branch_count`'u Google Maps/Yandex'teki aynı isimli şube
   aramasına dayandır (kürasyon ekibi hızlı doğrular) — tamamen sübjektif olmaktan çıkar.

### Sorun 4 — Rekabet: farklılaşma kolay kopyalanabilir, kanıtlanmamış

4 rakip zaten aynı kesişimi hedefliyor; kategori-rota ve WhatsApp paylaşım savunulabilir fark değil.

1. **Kürasyon sesine odaklan, feature'a değil:** Asıl fark data-dump liste değil, kişisel/otantik
   editöryal ton ("neden burayı seçtik") — rakiplerin kopyalayamayacağı şey içerik kalitesi, özellik değil.
2. **Niş derinleşme:** 3 ilçe yerine tek ilçede (örn. yalnızca Kadıköy) çok derin kürasyon — "İstanbul'un
   butik rehberi" değil "Kadıköy'ü gerçekten bilen tek kaynak" konumlan.
3. **Format farkı:** Liste/harita yerine düzenli editöryal ritim (haftalık "1 öneri" push/newsletter) —
   veri derinliğinden değil, editöryal disiplinden gelen fark.
4. **Rakipleri gerçekten test et:** MVP öncesi 4 rakip uygulamayı indirip Kadıköy'de 10 mekan ara,
   nerede eksik kaldıklarını somut belgele — "iddia" yerine "kanıtlanmış boşluk" bul.
5. **Restoran ilişkisini fark yap:** Rakiplerin sahip olmadığı doğrudan restoran bağlantısı üzerinden
   özel içerik/ilk elden bilgi/veri tazeliği avantajı çıkar — test edilebilir, taklit edilmesi zor bir fark.

### Sorun 5 — Dağıtım: restoran bağlantıları/WhatsApp/SEO kanıtlanmamış kanal

"Restoran bağlantım var" bir varlık, ölçülmüş bir kanal değil.

1. **Kod yazmadan kanalı test et:** Basit bir landing page + WhatsApp/Instagram ile restoran
   bağlantılarından gerçekte kaç kişiye ulaşılabildiğini, kaçının ilgi gösterdiğini kodsuz ölç.
2. **Somut sayı çıkar:** Kaç mekan, mekan başına kaç takipçi/müşteri erişimi — "150 hedef kullanıcı"
   varsayımını gerçek sayılarla doğrula veya düzelt.
3. **Mekan sahiplerini ortak yap:** İlk listelenen mekanlara "GurmeGo'da senin mekanın var, takipçilerine
   paylaş" teklifi — restoranın kendi kitlesi dağıtım motoru olsun.
4. **SEO'yu taahhüde çevir:** Hedef anahtar kelimelerde mevcut rakiplerin (Yemek.com, Menü Burada vb.)
   sıralamasını analiz et, gerçekçi bir zaman çizelgesi (3-6 ay, garanti yok) koy.
5. **Launch öncesi bekleme listesi:** Kod yazmadan önce "yakında geliyor" sayfası + email/WhatsApp
   bekleme listesiyle gerçek talep ölç — 150 kişi toplanamıyorsa erken sinyal alınmış olur.

### Sorun 6 — Gelir modeli tanımsız

"Freemium tercih ediliyor" bir gelir modeli değil; kim, ne için öder belli değil.

1. **Karar kriterini şimdiden yaz:** Faz 2 başında hangi metrik (örn. retention eşiği) gelir modeli
   kararını tetikleyecek, bunu şimdi netleştir.
2. **Tek somut hipotez seç:** Örn. "gelişmiş/mood filtreleri premium'da" — MVP'de hangi filtrelerin en
   çok kullanıldığını baştan logla, hipotezi MVP verisiyle doğrula.
3. **B2B'yi erkene çek:** `featured` alanı zaten mimaride var; restoran bağlantıları üzerinden küçük bir
   ücretli öne-çıkarma pilotu erken gelir sinyali verebilir.
4. **Bilinçli erteleme olarak çerçevele:** "Henüz düşünmedik" değil, "retention doğrulanmadan gelir
   modeline yatırım yapmıyoruz" — NFR-08'e hangi sinyalin tetikleyeceğini ekle.
5. **Minimal erken sinyal:** "Bizi destekle" tarzı bir bağış/topluluk denemesi — gerçek gelir modeli
   değil ama erken ödeme isteği sinyali toplar.

### Sorun 7 — Değer önerisi (en temel risk): ürün asıl vaadini yerine getirmiyor

Instagram içeriği alınmıyor, kesin fiyat yok, yorum/yol tarifi için Maps'e çıkılıyor — "tek yer" vaadi
fiilen çalışmıyor, ürün 4. bir durak olma riski taşıyor.

1. **Yol tarifini uygulama içinde tut:** Doğrudan Maps'e göndermek yerine uygulama içi basit harita +
   "başlat" butonu (son adımda deep-link olsa bile "çıkma" hissi azalır).
2. **Instagram/TikTok bağlantısını mekan kartına göm:** Mekanın kendi IG hesabına link + "nerede
   görüldü" referansı — kullanıcı "gördüğüm yer bu muydu" doğrulamasını GurmeGo içinde yapabilsin.
3. **Google puanını özet rakam olarak göster** (bkz. Sorun 2, madde 2) — "yorumlara bakmak için çık"
   adımını atlat, güven sinyali içeride kalsın.
4. **Vaadi küçült ve dürüstleştir:** "3-4 adımı 1'e indiriyoruz" yerine "keşif + karar aşamasını
   hızlandırıyoruz, gitme aşamasında zaten kullandığın Maps'e en hızlı köprüyüz" — abartılı iddiayı düzelt.
5. **Zaman kazancını ölçüp kanıtla:** MVP'den önce 10 kişilik testte "GurmeGo ile" vs "bugünkü yöntemle
   (IG+Maps)" mekan bulma süresini kronometreyle ölç. Kazandırmıyorsa ürün fikrinin kendisi sorgulanmalı
   — bu en ucuz ve en erken doğrulama adımı.

---

## Öncelik önerisi

Sorun 7 (değer önerisi) diğer her şeyin önkoşulu — çözülmeden diğer sorunlara yatırım yapmak anlamsız.
Önerilen sıra: **Sorun 7 → Sorun 5 (dağıtım testi) → Sorun 1 (kapasite) → geri kalanlar**, çünkü 7 ve 5
kod yazılmadan (landing page + kronometre testi + bekleme listesi) doğrulanabilir; kod yazmaya
başlamadan önce bu iki testin sonucu görülmeli.

---

## Kullanıcı Perspektifinden Değerlendirme

Codex red-team ürünün var olma hakkını sorguladı. Bu bölüm farklı bir soru soruyor: **ürün var olsa,
gerçek bir kullanıcı olarak onu kullanırken neyi eksik bulurdum, neyi fazla bulurdum?**

Persona: Kadıköy'de yaşayan, haftada 2-3 kez dışarıda yemek yiyen, Instagram'da mekan keşfeden,
arkadaşlarıyla plan yapan biri.

### Eksik olan, eklenmeyi hak eden (düşük maliyetli, AI gerektirmeyen)

1. **Sosyal kanıt / arkadaş sinyali.** WhatsApp paylaşımı tek yönlü (ben sana gönderiyorum). "Arkadaşın
   Ayşe burayı favoriledi" gibi bir sinyal yok. Basit bir "X kişi bu hafta favoriledi" sayacı bile (kişi
   ismi göstermeden, agregat) sosyal kanıt sağlar ve AI gerektirmez.
2. **Nitelik etiketleri (mood tag).** Semantic search çıkarıldı ama "sessiz/çalışmaya uygun",
   "romantik", "grupla gidilir" gibi ihtiyaçlar hâlâ var. Bunları AI'sız, editöryal olarak girilen sabit
   bir etiket listesi (tag) + yapısal filtre olarak çözmek mümkün — LLM'siz, MVP'ye uygun maliyette.
3. **Çoklu-durak mini rota.** FR-KA-06 tek kategoriye odaklı (yalnızca "tatlı" veya yalnızca "kahve").
   Kullanıcı sık sık "önce yemek, sonra tatlı" gibi 2 duraklı bir plan yapar. Basit bir "rotaya ekle"
   (birden fazla mekanı sıraya koy, tek deep-link ile hepsine rota) düşük maliyetli bir ekleme olabilir.
4. **Fotoğraf yükleme (kullanıcıdan).** MVP'de yorum var ama fotoğraf yükleme yok; Menülen zaten bunu
   sunuyor. Moderasyonlu basit bir fotoğraf ekleme (kullanıcı katkısı akışına bağlı değil, review'un
   parçası) rakip paritesi sağlar.
5. **Geri dönüş tetikleyicisi (retention).** Şu anki tasarımda kullanıcının haftalık geri gelmesi için
   hiçbir teşvik yok (bildirim, digest, yenilik özeti). "Bu hafta ilçende eklenen 3 mekan" gibi basit bir
   haftalık özet bildirimi (push, opsiyonel) retention'a doğrudan katkı sağlar ve mimaride zaten olan
   veriden (yeni yayınlanan Venue kayıtları) üretilebilir.

### Fazla / hâlâ karmaşık olan (MVP'den daha da sadeleştirilebilir)

1. **Gurme Puanı formülü hâlâ ağır.** Bayesian ağırlıklı ortalama + 3 rol seviyesi + AK-01 hâlâ açıkken
   bu karmaşıklığı MVP'de taşımak riskli. AK-01 çözülene kadar basit bir "yalnızca kürasyon ekibi 1-5
   puan verir, düz ortalama" ile başlamak ve formülü Faz 2'de (kullanıcı puanlaması açılınca)
   Bayesian'a yükseltmek daha güvenli — şema zaten esnek, bu bir uygulama sırası tercihi.
2. **VenueVersion tam snapshot/rollback sistemi.** Round 1'de Codex bunu "hemen çıkarılması gereken"
   listesine koymuştu, pivotta çıkarılmadı. MVP'de mekan sayısı azken hatalı bir güncellemeyi elle
   düzeltmek (kürasyon ekibi zaten küçük ve her değişikliği biliyor) tam versiyonlama altyapısından
   daha ucuz olabilir. Basit bir "son 1 halini sakla" (tam version tarihçesi değil) yeterli olabilir.
3. **Anomali raporu (rating-anomalies).** AK-01 çözülüp kullanıcı puanlaması Faz 2'de açılana kadar bu
   modülün MVP'de hiç kullanılan verisi yok — MVP'de inşa etmeye gerek yok, Faz 2'ye ertelenebilir.

### Sonuç

Round 2'nin bulduğu temel sorun (ürün asıl vaadini yerine getirmiyor) çözülmeden bu eklemelerin hiçbiri
öncelik değil — ama Sorun 7'nin çözümleri (uygulama içi harita, IG bağlantısı, Google puanı özeti)
uygulanırsa, yukarıdaki "sosyal kanıt" ve "mood tag" eklemeleri ürünü rakiplerden gerçekten ayırabilecek
ucuz, AI'sız katkılar olarak değerlendirilmeli.

