# GurmeGo — Tam Proje Denetimi (2026-09-14)

Bu dosya, projenin dört uygulamasının (backend, web, admin panel, mobil uygulama) ve genel
altyapısının satır satır incelenmesi sonucu ortaya çıkan **tüm bulguları** içerir. Amaç: hiçbir
şeyi kaçırmadan, en küçük detaya kadar "burada şu sorun var, şöyle düzeltilebilir" demek.

**Nasıl okunur:**
- Her bulgu aynı kalıpta yazıldı: *Nerede / Sorun ne / Neden önemli / Önerilen çözüm / Diğer
  seçenekler / Önem derecesi.*
- Önem dereceleri üç seviye: **Kritik** (yakın zamanda mutlaka bakılmalı), **Orta** (önemli ama
  acil değil), **Düşük** (küçük, zamanı gelince).
- Teknik terimler kullanıldığında yanına parantez içinde sade bir açıklama eklendi.
- Daha önce (bu konuşmanın önceki bölümünde) tespit edilip **zaten çözülmüş** konular (CI sorunu,
  kullanıcı tablosu senkronu, CSV formül açığı) bu dosyada tekrar yok — onlar `docs/REVIEW-PLAN.md`
  dosyasında kayıtlı.
- Bu dosya sadece **tespit ve öneri** içeriyor, hiçbir kod değiştirilmedi. Hangi maddelerin ne
  zaman ele alınacağına siz karar vereceksiniz.

---

## Uygulama durumu (2026-09-21 güncel)

**Kritik: 11/11 kapandı.** Son ikisi (Next.js ve Fastify güvenlik yükseltmesi) 2026-09-21'de PR #1 ve #2 ile
birleşti. Prod bağımlılıklarında `pnpm audit`: 3 critical / 50 high → **0 critical / 0 high** (kalan 6 moderate).

Bu rapordaki bir bulgu **yanlış** çıktı: "`@fastify/static` kullanılmıyor" (Genel §1.3). `@nestjs/swagger` 11, Swagger
UI için onu peer olarak ister; kaldırılmadı, 10.x'e çıkarıldı. Yan kazanç: Next 15+ çıplak `fetch()`'i artık
cache'lemediği için web §2 "`/[district]` süresiz cache" bilinen borcu da kapandı (yerine bilinçli TTL geldi).

Yükseltme sırasında raporun öngörmediği bir regresyon bulundu ve düzeltildi: Fastify 5'in `@fastify/cors`
varsayılanı `PUT/DELETE` preflight'ını düşürüyordu (web favori silme, admin rol atama kırılırdı).

**Orta paket A (backend §1.2/§1.3) tamamlandı (2026-09-21, PR #4 + #5):** admin rate-limit, güvenlik başlıkları, CSV satır sınırı, liste indeksi
(**ölçüldü**, 50k satırda 7.7→0.07 ms; `(status, category)` indeksi ölçüldü ve eklenmedi), rol/CSV/mekan audit log (ADR 006), `req.ip` fallback'i,
rol ucu zod pipe, bayat test yorumu. Bu rapordaki *favori toplam sınırı* Kritik'te zaten yapılmıştı; *`@fastify/static` kullanılmıyor* bulgusu yanlıştı.

**Sıradaki:** kalan Orta bulgular — web → admin → mobil → altyapı (sırayla, paket paket).

---

## Önce en can alıcı 5 şey (hızlı bakış)

Aşağıdaki 5 madde, tüm rapordaki 50'den fazla bulgu arasında en çok dikkat gerektirenler. Detayları
ilgili bölümlerde var, burada sadece bir harita:

1. **Web ve admin panelin kullandığı Next.js sürümünde, internet üzerinden otomatik taranan
   türden iki ciddi güvenlik açığı var** (bkz. Genel/Altyapı §3). Ürün henüz canlıda olmadığı için
   şu an aciliyet yok, ama canlıya çıkmadan önce mutlaka kapatılmalı.
2. **Backend'in kullandığı web sunucusu altyapısında da (Fastify) benzer ciddiyette açıklar var**
   (bkz. Genel/Altyapı §4).
3. **Projenin kendi kılavuz dosyası (CLAUDE.md) "henüz kod yok" diyor** — oysa aylardır kod var.
   Bu, her yeni oturumda (benim gibi) yanlış bir başlangıç noktası veriyor (bkz. Genel/Altyapı §1).
4. **Mobil uygulamada, bir ilçedeki mekan sayısı ilk sayfayı geçtiği anda geri kalan mekanlar hiç
   görünmüyor** (sayfalama/"daha fazla yükle" hiç yok) — uygulamanın temel amacını zedeliyor
   (bkz. Mobil Uygulama §2).
5. **Web sitesindeki hiçbir mekan sayfasının kendine özel başlığı yok** — Google'da hepsi aynı
   genel başlıkla görünüyor, bu SEO açısından hedeflenen organik trafiği baştan engelliyor
   (bkz. Web Sitesi §1).

---

## İçindekiler

1. [Backend (apps/api)](#1-backend-appsapi)
2. [Web Sitesi (apps/web)](#2-web-sitesi-appsweb)
3. [Admin Panel (apps/admin)](#3-admin-panel-appsadmin)
4. [Mobil Uygulama (apps/mobile)](#4-mobil-uygulama-appsmobile)
5. [Genel / Altyapı / Vizyon Uyumu](#5-genel--altyapı--vizyon-uyumu)
6. [Özet tablo ve öneri](#6-özet-tablo-ve-öneri)

---

## 1. Backend (apps/api)

**Genel not (olumlu):** Tüm veritabanı sorguları güvenli şekilde yazılmış — klasik bir güvenlik
açığı türü olan "SQL enjeksiyonu" hiçbir yerde bulunamadı. Kimin hangi işlemi yapabileceği kontrolü
(yetkilendirme) genel olarak tutarlı.

### 1.1 Kritik

#### Favori ekleme uçlarının hiç sınırı yok
**Nerede:** `apps/api/src/favorites/` — liste oluşturma, listeye mekan ekleme/çıkarma uçları.
**Sorun ne:** Giriş yapmış herhangi biri, saniyede yüzlerce boş favori listesi oluşturabilir —
ne bir hız sınırı (belirli sürede kaç istek yapılabileceği kısıtı) ne de "en fazla şu kadar liste"
gibi bir üst sınır var.
**Neden önemli:** Hesap açabilen herkes bu uçları kötüye kullanıp veritabanını gereksiz kayıtla
doldurabilir; bu da hem depolamayı hem gerçek kullanıcılar için hızı etkiler.
**Önerilen çözüm:** Bu üç uca da, projede zaten var olan hız sınırlama mekanizmasını uygulamak;
ayrıca kullanıcı başına maksimum liste sayısı (örn. 20) ve liste başına maksimum mekan sayısı
(örn. 200) gibi basit üst sınırlar koymak.
**Diğer seçenek:** Supabase tarafında hesap başına genel bir günlük işlem sınırı da düşünülebilir,
ama bu daha basit ve aynı işi görür.

### 1.2 Orta

#### Admin işlemlerinde de hiç hız sınırı yok
**Nerede:** `apps/api/src/admin/**` — mekan ekleme/düzenleme/geri alma, CSV yükleme, onay/red,
rol atama.
**Sorun ne:** Bu işlemler sadece yetkili (curator/admin) hesaplarca yapılabiliyor ama o hesap ele
geçirilirse veya panelde bir yazılım hatası olursa (örn. sürekli tıklanan bir buton), bunu
durduracak bir mekanizma yok.
**Önerilen çözüm:** Aynı hız sınırlama mekanizmasını, daha yüksek bir limitle (örn. dakikada
30-60 istek) admin uçlarına da eklemek.
**Diğer seçenek:** Sadece CSV yükleme gibi "ağır" işlemlere sınır koyup, hafif işlemleri (tekil
onay/red gibi) şimdilik atlamak.

#### Temel güvenlik başlıkları hiç eklenmemiş
**Nerede:** Backend başlatma dosyası (`main.ts`) — hem burada hem web'de hem admin panelde eksik.
**Sorun ne:** Tarayıcıların bazı saldırı türlerine karşı kendini koruması için standart olan
bazı HTTP "güvenlik başlıkları" (tarayıcıya "bu sayfayı bir çerçeve içinde gösterme" gibi
talimatlar) hiç eklenmemiş.
**Neden önemli:** Bu başlıklar tek başına büyük bir açık değil ama ücretsiz, kolay bir ek
koruma katmanı — üç yerde birden eksik olması aynı işle tek seferde kapatılabilir.
**Önerilen çözüm:** Backend'e `@fastify/helmet` paketini kurup birkaç satırla etkinleştirmek;
web ve admin'de de Next.js'in kendi `headers()` ayarını kullanmak.

#### Çok satırlı CSV dosyaları backend'i yavaşlatabilir
**Nerede:** `apps/api/src/admin/venues/admin-venues.service.ts` (CSV içe aktarma).
**Sorun ne:** Bir CSV dosyasındaki HER satır için sırayla (biri bitmeden diğeri başlamadan) 2-3
ayrı veritabanı sorgusu çalıştırılıyor. Dosya boyutu 10MB ile sınırlı ama satır sayısı sınırsız —
böyle bir dosya on binlerce kısa satır içerebilir.
**Neden önemli:** Şu anki ölçekte (birkaç düzine mekan) sorun değil, ama kazara veya kötü niyetle
çok satırlı bir dosya yüklenirse işlem dakikalarca sürebilir, sunucu kaynağı meşgul kalır.
**Önerilen çözüm:** CSV'deki satır sayısına bir üst sınır koymak (örn. 2000 satır), aşan
dosyaları baştan reddetmek.
**Diğer seçenek:** İçe aktarmayı arka planda çalıştırıp "işleniyor, bitince haber vereceğiz"
demek — daha büyük bir değişiklik, MVP için şart değil.

#### Sık kullanılan arama filtrelerinde veritabanı hız kısayolu (indeks) yok
**Nerede:** Mekan verisi tablosu (`Venue`) — kategori, fiyat aralığı, "sadece butik" filtreleri.
**Sorun ne:** Bu üç filtrenin hiçbirinde, aramaları hızlandıran bir veritabanı kısayolu (indeks)
yok. Şu an sadece ilçe ve yayın durumu için var.
**Neden önemli:** Mekan sayısı arttıkça (yüzlerce/binlerce), bu filtrelerle arama yavaşlayabilir —
projenin hedeflediği "300 milisaniye altı arama" sözü tutulamayabilir.
**Önerilen çözüm:** En sık kullanılan kombinasyona göre bir indeks eklemek. Şu anki mekan sayısında
(~30-45) acil değil ama ucuz bir önlem.

#### Rol değişikliği ve toplu yüklemelerin kaydı tutulmuyor
**Nerede:** Rol atama ve CSV içe aktarma işlemleri.
**Sorun ne:** Bir admin başka birinin rolünü değiştirdiğinde ya da toplu bir mekan yüklemesi
yapıldığında, "kim, ne zaman, ne yaptı" bilgisi hiçbir yerde kalıcı olarak saklanmıyor.
**Neden önemli:** İleride bir sorun/kötüye kullanım yaşanırsa geriye dönük inceleme yapmak
imkânsız olur.
**Önerilen çözüm:** Basit bir "işlem kaydı" tablosu — kim, ne zaman, hangi işlemi yaptı, eski/yeni
değer neydi.

#### Bazı testler artık doğru olmayan bir bilgiyi belgeliyor
**Nerede:** `apps/api/test/app.e2e-spec.ts`.
**Sorun ne:** Bir test yorumunda "bu projede sahte-IP koruması hiç ayarlanmamış" yazıyor, ama bu
artık doğru değil — gerçek kod bu korumayı çoktan ekledi, sadece bu TEST kendi sahte ortamını bu
korumasız kuruyor.
**Neden önemli:** Kod doğru olsa bile bunun gerçekten çalıştığı hiçbir testle kanıtlanmamış.
**Önerilen çözüm:** Yorumu güncellemek, gerçek başlatma kodunu uçtan uca test eden yeni bir test
eklemek.

#### Kullanıcı başına favori sayısında toplam üst sınır yok
**Nerede:** Favoriler servis kodu.
**Sorun ne:** Yukarıdaki hız-sınırı bulgusuyla ilişkili ama farklı bir konu: hıza uysa bile,
zamanla bir kullanıcı binlerce liste biriktirebilir.
**Önerilen çözüm:** Liste oluşturma öncesi mevcut sayıyı kontrol edip bir üst sınırı aşınca nazik
bir hata döndürmek.

### 1.3 Düşük

- **Rol atama ucu, projenin geri kalanından farklı olarak veri doğrulama katmanından geçmiyor**
  (pratikte tehlikeli değil, servis katmanında ayrı bir kontrol var, ama tutarsız). *Çözüm:* aynı
  doğrulama desenini buraya da uygulamak.
- **Kullanılmayan bir paket (`@fastify/static`) hâlâ kurulu duruyor.** *Çözüm:* kaldırmak.
- **Hız sınırlama ve veri doğrulama kodlarının kendi başına (izole) testi yok** — şu an sadece
  onları kullanan ekranlar üzerinden dolaylı test ediliyor. *Çözüm:* birkaç basit, doğrudan test
  eklemek.
- **Bağımlılıkların bilinen güvenlik açıklarına karşı otomatik taraması yok.** *Çözüm:* GitHub'ın
  ücretsiz "Dependabot" özelliğini açmak (kod değişikliği gerektirmez).
- **Test dosyalarının aynı anda çalışmaya güvenli olmadığı bilgisi hâlâ geçerli** (detay: bölüm 5,
  "Bilinen Borç" kısmında).

---

## 2. Web Sitesi (apps/web)

**Zaten bilinen, hâlâ açık konular** (tekrar detaylandırılmadı): ana sayfa verilerinin süresiz
önbelleklenmesi (yeni onaylanan mekanlar sitede geç görünüyor), hata sayfalarının olmaması,
~180 farklı, birbiriyle uyumsuz renk kodu (tutarlı bir tasarım sistemi yok).

### 2.1 Kritik

#### Mekan sayfaları Google'da hep aynı başlıkla görünüyor
**Nerede:** Mekan detay sayfası ve ilçe sayfaları.
**Sorun ne:** Sitedeki HER sayfa (ana sayfa, ilçe sayfaları, tüm mekan sayfaları) Google
aramasında ve WhatsApp gibi yerlerde paylaşıldığında hep aynı genel başlığı gösteriyor: "GurmeGo
— İstanbul'un butik mekan rehberi". Biri Google'da "Kadıköy'de sakin bir kahve" diye arasa, o
mekanın kendi sayfası değil, hep aynı genel başlık çıkıyor.
**Neden önemli:** Bu tür bir keşif sitesinin en büyük trafik kaynağı genelde "mekan adı + ilçe"
aramalarıdır. Her sayfa aynı başlığı taşıdığı sürece Google bu sayfaları birbirinden ayıramaz,
sıralamada geride kalırlar.
**Önerilen çözüm:** Her sayfaya kendi başlık/açıklama üretimini eklemek — mekan sayfasında
mekanın adı+ilçesi başlık olsun, editoryal notu açıklama olsun, varsa fotoğrafı paylaşım
görseli olsun.
**Diğer seçenek:** Kısa vadede sadece başlık ve açıklama eklemek de büyük fark yaratır; paylaşım
görseli ikinci aşamada eklenebilir.

#### Arama motorlarına site haritası yok
**Nerede:** Web sitesinin kök klasörü.
**Sorun ne:** Google'a "sitedeki tüm sayfalar burada" diyen standart dosyalar (site haritası ve
arama-motoru-izin dosyası) hiç eklenmemiş.
**Neden önemli:** Site haritası olmadan yeni eklenen bir mekan sayfasının Google tarafından fark
edilmesi çok daha uzun sürer, bazı sayfalar hiç taranmayabilir.
**Önerilen çözüm:** Tüm ilçe+mekan adreslerini listeleyen bir site haritası ve arama motorlarına
izin veren basit bir dosya eklemek — standart, ucuz bir ekleme.

### 2.2 Orta

#### Mekan fotoğrafları optimize edilmeden gönderiliyor
**Nerede:** Mekan detay sayfası.
**Sorun ne:** Fotoğraflar, Next.js'in kendi resim optimizasyon aracı yerine düz bir resim
etiketiyle gösteriliyor — yani fotoğraf sıkıştırılmadan, cihaza göre küçültülmeden indiriliyor.
**Neden önemli:** Mobil kullanıcıda (ana hedef kitle) sayfa daha yavaş açılır, veri kullanımı
artar; Google'ın sayfa hızı puanlaması da bundan etkilenir (yine SEO'yu vuruyor).
**Önerilen çözüm:** Next.js'in kendi resim bileşenine geçmek — otomatik boyutlandırma, geç
yükleme ve modern format desteği gelir.

#### Aynı anda iki mekan favorilenirse aynı isimde iki liste oluşabilir
**Nerede:** Favori butonu.
**Sorun ne:** Bir kullanıcının hiç listesi yokken çok kısa aralıklarla iki farklı mekanda favori
butonuna basması (örn. iki sekmede), her iki butonun da kendi "Favorilerim" listesini
oluşturmasına yol açabilir — sonuçta aynı isimde iki liste ortaya çıkar.
**Neden önemli:** Kullanıcı deneyimini bozar (kafa karıştırır) ama veri kaybı ya da güvenlik
riski yok, çok nadir oluşur.
**Önerilen çözüm:** Bir kullanıcının aynı isimde iki liste açmasını veritabanı seviyesinde
engellemek.
**Diğer seçenek:** Favoriler sayfasında aynı isimli listeleri otomatik birleştiren bir temizlik.

#### Markanın "sıcak, editöryel" hissi için özel bir yazı tipi hiç yüklenmiyor
**Nerede:** Site geneli.
**Sorun ne:** Sitenin başlıklarında kullanılan "tırnaklı" yazı tipi aslında hiç özel olarak
yüklenmemiş — sadece cihazın kendi varsayılan yazı tipine güveniliyor. Bir Windows kullanıcısıyla
bir iPhone kullanıcısı muhtemelen farklı fontlar görüyor.
**Neden önemli:** Ürünün hedeflediği "sıcak/editöryel marka kimliği" için tipografi kilit bir
unsur; şu anki haliyle bu kimlik cihazdan cihaza tutarsız görünüyor.
**Önerilen çözüm:** Markaya uygun bir yazı tipini Next.js'in kendi font yükleme aracıyla seçip
yüklemek — hem tutarlı görünüm hem iyi performans sağlar.

#### Harita kütüphanesinin görsel dosyası her sayfada yükleniyor
**Nerede:** Sitenin ana iskelet dosyası.
**Sorun ne:** Haritanın kod kısmı doğru şekilde sadece gerektiğinde yükleniyor, ama haritanın
görsel/stil dosyası TÜM sayfalarda (favoriler, giriş sayfası dahil, hiç harita olmayan yerlerde
bile) yükleniyor.
**Önerilen çözüm:** Bu dosyayı ana iskeletten kaldırıp, gerçekten haritayı gösteren bileşene
taşımak.

### 2.3 Düşük

- **"Mekanı bildir" isteği, diğer tüm istekler için kullanılan ortak yöntemi atlayıp kendi
  başına gönderiliyor.** Tutarsız ama bugün bir hataya yol açmıyor. *Çözüm:* ortak yöntemi
  kullanacak şekilde yeniden yazmak.
- **Varsayılan ilçe seçimi, backend'in listeyi hangi sırada döndürdüğüne bağlı** — açıkça
  tanımlanmamış. *Çözüm:* varsayılan ilçeyi kod içinde açıkça sabitlemek.

### 2.4 Doğrulanan güçlü yönler (dokunulmamalı)
- Kullanıcı konumu hiçbir yerde kayıt/analiz sistemine yazılmıyor — gizlilik kuralına tam uyum.
- "Yarış durumu" korumaları (aynı anda birden fazla işlem yapıldığında eskisinin yenisinin
  üzerine yazmaması) son derece dikkatli uygulanmış.
- Güvenli olmayan HTML ekleme (kullanıcı girdisinin doğrudan sayfaya basılması) hiçbir yerde yok.
- Görsellerde erişilebilirlik metinleri tutarlı, klavye ile kullanım özenli.
- Sıcak/editöryel ton (metin dili, renk paleti) kod genelinde tutarlı — sorun sadece bunun bir
  "sistem" olarak kurulmamış olması.

---

## 3. Admin Panel (apps/admin)

**Zaten bilinen, hâlâ açık konular:** işlem kaydı (audit log) yok, "erişim yok" sayfası
stilsiz, hata sayfaları yok, güvenlik başlıkları yok, CSV yüklemede ilerleme göstergesi yok.

### 3.1 Orta

#### Panelde rol atama, veri kalitesi ve mekan geri-alma ekranı yok
**Nerede:** Panelin tüm sayfa listesi.
**Sorun ne:** Backend'de üç özellik hazır: birine yetki verme, mekan verisinin genel sağlığını
gösteren bir rapor, ve onaylanmış bir düzenlemeyi geri alma. Ama panelde bunların HİÇBİRİ için
bir ekran yok — sadece "bekleyenleri onayla/reddet" ve "CSV yükle" var.
**Neden önemli:** Bu işlemler muhtemelen şu an geliştirici tarafından elle (Prisma Studio veya
doğrudan API ile) yapılıyor. İşi başka birine devredince, o kişinin bu ekranları olmayacak.
**Önerilen çözüm:** Öncelik sırasıyla üç küçük sayfa: kullanıcı arama+rol verme, veri kalitesi
raporu, en son da mekan geçmişi/geri-alma.
**Diğer seçenek:** MVP'de bu üçü hâlâ elle yapılabilir ("iç araç, düşük öncelik") ama bu durumda
en azından "rol nasıl atanır" adımları bir yere yazılmalı.

#### Kuyruk ve import sayfaları arasında gezinme linki yok
**Nerede:** Panelin ortak üst kısmı.
**Sorun ne:** Üstte sadece "Çıkış yap" var — iki sayfa arasında tıklanabilir bir link yok.
**Neden önemli:** İki sayfalık panel için şu an kritik değil ama üçüncü bir sayfa (yukarıdaki
öneri) eklenince bu sorun büyür.
**Önerilen çözüm:** Üst kısma basit linkler eklemek.

#### Çok satırlı bozuk bir CSV, tarayıcıyı yavaşlatabilir
**Nerede:** CSV yükleme sayfası.
**Sorun ne:** Büyük bir dosyanın TÜM hataları, sayfalama olmadan tek seferde ekrana basılıyor —
binlerce satır aynı anda gösterilirse sayfa birkaç saniye donmuş gibi görünebilir.
**Önerilen çözüm:** Hata listesini ilk 50-100 satırla sınırlayıp "tam listeyi indir" seçeneği
sunmak.

### 3.2 Düşük

- **"Reddet" butonunda onay adımı yok** — yanlışlıkla tıklanırsa direkt işlem yapılıyor (etkisi
  sınırlı, veri kaybı yok). *Çözüm:* basit bir "emin misin?" sorusu eklemek.
- **Bağlantı bilgisi eksikse hata mesajı anlaşılır değil** — backend'de bu sorun zaten
  düzeltilmişti, panelde aynı düzeltme yapılmamış. *Çözüm:* aynı net-mesaj desenini buraya da
  uygulamak.
- **Giriş sayfasında "şifremi unuttum" yok.** *Çözüm:* Supabase'in hazır akışını tek bir link
  olarak eklemek.

### 3.3 Doğrulanan güçlü yönler
- Rol/yetki kontrolü tutarlı ve doğru kurulmuş.
- Hassas işlemlerin hiçbiri "önce göster, sonra doğrula" şeklinde tasarlanmamış — hepsi backend
  onayını bekliyor. Bu panelin en güçlü yönü: yarış durumu ve oturum-değişikliği koruması,
  production kalitesinde.

---

## 4. Mobil Uygulama (apps/mobile)

**Zaten bilinen, hâlâ açık konular:** çıkış yapma ekranı yok, çökme durumunda hiçbir bildirim
yok, tutarlı bir tasarım sistemi yok, gerçek bir telefonda hiç elle denenmemiş.

### 4.1 Kritik

#### Ekranların üstü telefonun saat/çentik alanının altında kalıyor
**Nerede:** Uygulamanın ana ekran yapısı.
**Sorun ne:** Uygulama, telefonun üst kısmındaki saat/pil/çentik alanını hesaba katmıyor —
Mekanlar ve Favoriler sekmelerinin ilk satırı bu alanın altında yarı görünmez kalabilir.
**Neden önemli:** Bu, kullanıcının uygulamayı AÇAR AÇMAZ göreceği bir görsel bozukluk — ilk
izlenim "bitmemiş uygulama" hissi verir.
**Önerilen çözüm:** Zaten kurulu olan (ama kullanılmayan) bir paketle ekranları güvenli alana
oturtmak — küçük bir değişiklik.

#### Bir ilçedeki mekanların hepsi görünmüyor
**Nerede:** Mekanlar (keşif) ekranı.
**Sorun ne:** Backend, mekan listesini "sayfa sayfa" veriyor ve "daha fazla var mı" bilgisini
de gönderiyor. Ama mobil uygulama bu bilgiyi hiç okumuyor — sadece İLK sayfayı gösteriyor.
Kullanıcı listenin sonuna kadar kaydırdığında hiçbir şey olmuyor.
**Neden önemli:** Bir ilçedeki mekan sayısı ilk sayfanın boyutunu geçtiği anda, kullanıcı geri
kalan mekanları hiçbir şekilde göremeyecek. Bu, uygulamanın temel amacını (mekan keşfi) ciddi
şekilde kısıtlıyor.
**Önerilen çözüm:** Liste sonuna gelindiğinde otomatik olarak bir sonraki sayfayı çekip listeye
eklemek ("sonsuz kaydırma").
**Diğer seçenek:** Sayfa numaralı ileri/geri butonları; ya da kısa vadede "X mekan daha var,
filtre uygula" uyarısı.

#### Mekan detayı yüklenirken veya yüklenemezse ekran tamamen boş kalıyor
**Nerede:** Mekan detay ekranı.
**Sorun ne:** Bilgiler gelene kadar ekranda hiçbir şey yok — ne "yükleniyor" yazısı ne bir
çerçeve. İnternet koparsa da ekran sonsuza kadar bomboş kalır, hiçbir hata mesajı çıkmaz.
**Neden önemli:** Kullanıcı "uygulama mı çöktü?" diye tereddüt eder; internet sorunu yaşayan
kullanıcı için ekran sonsuza dek boş kalır.
**Önerilen çözüm:** Üç durumu ayrı göstermek: yükleniyor (bir çevirici), hata ("tekrar dene"
butonu), veri geldi (mevcut görünüm).

#### Uygulama henüz mağazalara yüklenecek şekilde ayarlanmamış
**Nerede:** Uygulamanın yapılandırma dosyaları.
**Sorun ne:** iOS ve Android için gerekli "kimlik bilgileri" (uygulama paket adı) hiç
tanımlanmamış. Mağaza derlemesi için gereken yapılandırma dosyası da yok. Açılış ekranı da
tanımlı değil.
**Neden önemli:** Şu anki haliyle uygulama App Store veya Google Play'e YÜKLENEMEZ.
**Önerilen çözüm:** Bu kimlik bilgilerini eklemek, mağaza derleme yapılandırmasını oluşturmak,
bir açılış ekranı görseli eklemek. *(Not: bugün acil değil, ama mağazaya çıkmadan önce mutlaka
yapılmalı — unutulmasın diye buraya not edildi.)*

### 4.2 Orta

#### Giriş yaptıktan sonra hiçbir şey olmuyor
**Sorun ne:** Giriş BAŞARILI olsa bile ekran değişmiyor, kullanıcı aynı formu görmeye devam
ediyor. **Çözüm:** Başarılı girişte otomatik olarak bir önceki ekrana dönmek.

#### Kayıt sonrası e-posta onayı gerektiği söylenmiyor
**Sorun ne:** Yeni kayıt olan kullanıcı, e-postasını onaylaması gerektiğini bilmiyor, "neden giriş
yapamıyorum" diye kafası karışabilir. **Çözüm:** Kayıt sonrası açık bir bilgilendirme mesajı
göstermek.

#### Favoriler listesi boşsa hiçbir şey görünmüyor
**Sorun ne:** Henüz favori eklememiş bir kullanıcı sadece boş beyaz bir alan görüyor. **Çözüm:**
"Henüz favorin yok, keşfetmeye başla" mesajı + yönlendirme butonu.

#### Filtreye uyan mekan yoksa kullanıcı bunu anlayamıyor
**Sorun ne:** Bir filtre hiçbir mekanla eşleşmiyorsa liste sessizce boş kalıyor. **Çözüm:** "Bu
kriterlere uygun mekan bulunamadı" mesajı.

#### "Yol tarifi al" butonu bazen sessizce başarısız olabilir
**Sorun ne:** Nadir durumlarda harita uygulaması açılamazsa hiçbir hata çıkmıyor. **Çözüm:**
Basit bir uyarı mesajı eklemek.

#### Mekan fotoğrafı yüklenemezse veya yavaşsa kötü görünüyor
**Sorun ne:** Fotoğraf linki bozuksa çirkin bir boşluk kalıyor; ayrıca fotoğraflar telefonda
saklanmıyor (her seferinde yeniden indiriliyor), bu hem veri kullanımını artırıyor hem de
yavaşlatıyor. **Çözüm:** Otomatik önbellekleme ve yer tutucu desteği olan bir resim kütüphanesine
geçmek.

#### Paylaşım linki her zaman gerçek (canlı) siteyi gösteriyor
**Sorun ne:** Test ortamında bile "Paylaş" butonu hep canlı sitenin adresini kullanıyor, kod
içine sabit yazılmış. **Çözüm:** Diğer adresler gibi ayarlardan okumak.

#### Harita yüklenemezse hiçbir uyarı yok
**Sorun ne:** Bazı cihazlarda harita yüklenemeyebilir, bu durumda boş/gri bir kutu görünür.
**Çözüm:** Harita yüklenemediğinde en azından adresi metin olarak öne çıkarmak.

### 4.3 Düşük

- **Listeler aşağı çekilerek yenilenemiyor** ("pull to refresh" yok). *Çözüm:* eklemek.
- **Konum izni biraz erken isteniyor** (kullanıcı henüz bir şey yapmadan). *Çözüm:* izni,
  konuma dayalı bir özelliğe dokunulduğunda istemek.
- **Formlarda boş alan kontrolü yok** — boşken bile gönder butonuna basılabiliyor. *Çözüm:* boş
  alan varken butonu pasif yapmak.
- **"Favorilere ekle" butonu, oturum bilgisi eksikken sessizce hiçbir şey yapmıyor** (çok nadir).
  *Çözüm:* bu durumda da giriş ekranına yönlendirmek.
- **Çökme/hata takibi altyapısı yok** — uygulama bir kullanıcının telefonunda çökse bile
  geliştirici bundan haberdar olmuyor. *Çözüm:* ücretsiz bir hata takip servisi (örn. Sentry)
  kurmak. *(Bugün düşük öncelik, ama canlıya çıkmadan önce mutlaka eklenmeli.)*

### 4.4 Doğrulanan güçlü yönler
- Oturum bilgisi telefonun kendi güvenli kasasında saklanıyor (düz metin değil, doğru yapılmış).
- "Yarış durumu" koruması çok sağlam — projenin genelinde övülen bir kalite standardı.
- Test kapsamı iyi durumda, yakın zamanda eklenen test yardımcıları gerçekçi ve amaca uygun.

---

## 5. Genel / Altyapı / Vizyon Uyumu

Bu bölüm tek bir uygulamaya değil, projenin geneline bakıyor.

### 5.1 Güvenlik / Altyapı — Kritik ve Yüksek

#### Projenin kendi kılavuz dosyası (CLAUDE.md) yanlış bilgi veriyor
**Nerede:** Kök dizindeki `CLAUDE.md` dosyası.
**Sorun ne:** Bu dosya "henüz kod yok" diyor — oysa proje aylardır kodlanıyor, dört çalışan
uygulama, yüzlerce test, gerçek bir otomatik kontrol (CI) hattı var. Bu dosya her yeni oturumda
otomatik okunuyor.
**Neden önemli:** Bu dosyayı okuyan biri (yapay zeka asistanı dahil) yanlış bir başlangıç
noktasıyla işe başlıyor.
**Önerilen çözüm:** Bu bölümü güncel duruma göre yeniden yazmak ya da tamamen silmek (güncel
durum zaten ayrı bir dosyada — `docs/STATE.md` — tutuluyor).

#### Web ve admin panelinde ciddi, bilinen güvenlik açıkları olan bir sürüm kullanılıyor
**Nerede:** Web ve admin panelin kullandığı Next.js sürümü.
**Sorun ne:** Kullanılan sürümde iki ciddi güvenlik açığı var — ikisi de kimlik doğrulaması
gerektirmeden, uzaktan zararlı kod çalıştırılmasına izin verebilecek türden. Düzeltme sadece
çok daha yeni bir sürümde var.
**Neden önemli:** Bu tür açıklar "birileri özel olarak saldırırsa" değil, "internet genelinde
otomatik tarayan botların aradığı" seviyede bilinen riskler. Ürün canlıya alınırsa doğrudan risk
altında olur.
**Önerilen çözüm:** Sürüm yükseltmesini ayrı, planlı bir iş olarak ele almak (büyük bir sürüm
atlaması, test gerektirir). Ürün henüz canlıda olmadığı için bugün acil değil, ama canlıya
çıkmadan ÖNCE mutlaka kapatılmalı.

#### Backend'in web sunucusu altyapısında da ciddi açıklar var
**Nerede:** Backend'in kullandığı Fastify web sunucusu ve ilgili paketler.
**Sorun ne:** Bir ara-yazılım paketinde kimlik doğrulamayı atlatmaya izin veren ciddi bir açık,
ayrıca birkaç orta-yüksek seviyeli başka açık bulundu.
**Neden önemli:** Bunlar backend'in dışarıya açık ilk katmanında — gerçek kullanıcı trafiğinin
ilk değdiği yer.
**Önerilen çözüm:** İlgili paketleri güncel, yamalı sürümlere yükseltmek — genelde küçük/orta
büyüklükte güncellemeler, NestJS'in kendisini değiştirmek gerekmeyebilir.

#### Web ve admin panelinin gerçekten "derlendiği" hiç kontrol edilmiyor
**Nerede:** Otomatik kontrol (CI) hattı.
**Sorun ne:** Otomatik kontrol sadece backend'i derliyor. Web ve admin panelinin gerçek üretim
derlemesi bugüne kadar HİÇ otomatik test edilmemiş.
**Neden önemli:** Bazı hatalar sadece gerçek derleme sırasında ortaya çıkar — böyle bir hata
olsaydı bugüne kadar hiç yakalanmazdı.
**Önerilen çözüm:** Otomatik kontrol hattındaki derleme adımını web ve admin'i de kapsayacak
şekilde genişletmek.

### 5.2 Güvenlik / Altyapı — Orta ve Düşük

- **Bağımlılıklarda toplam 118 bilinen güvenlik açığı var, hiç düzenli taranmıyor** (çoğu
  düşük riskli geliştirme araçlarında). *Çözüm:* GitHub'ın ücretsiz otomatik uyarı özelliğini
  açmak.
- **"Tip güvenli API istemcisi" olduğu iddia edilen paket aslında hiçbir koruma sağlamıyor** —
  üretilen kod işlevsiz, kimse kullanmıyor. Gerçek güvenlik başka bir yerden (elle yazılmış ortak
  şemalardan) geliyor. *Çözüm:* Ya bu paketi gerçekten işlevsel hale getirmek ya da iddiayı
  dokümandan kaldırıp basitleştirmek.
- **Web, admin ve mobil uygulamalarda "örnek ayar dosyası" yok** — hangi gizli anahtarların
  gerektiği bir yerde yazılı değil. *Çözüm:* her birine örnek bir dosya eklemek.
- **Dokümante edilen otomatik yayınlama (deploy) hattının çoğu henüz gerçekte kurulmadı** —
  bu bir hata değil, muhtemelen bilinçli bir aşama, ama doküman ile gerçeklik arasındaki fark
  büyük. *Çözüm:* dokümana "yapıldı/henüz yapılmadı" notu eklemek.
- **Geliştirme kurallarında yazan bazı korumalar gerçekte yok** — "ana koda doğrudan yükleme
  kapalı" deniyor ama bu teknik olarak açık (ücretsiz plan bu özelliği desteklemiyor); bu
  konuşma boyunca doğrudan ana koda yükleme yapıldı, hiçbir engel çıkmadı. *Çözüm:* ya planı
  yükseltip bu korumayı gerçekten açmak, ya da dokümanı gerçeğe uygun hale getirmek.
- **Bir kod dosyası, kendi mimari kuralının koyduğu boyut sınırını zaten aştı** (mekan arama
  kodu). *Çözüm:* dosyayı, kuralın önerdiği gibi daha küçük parçalara bölmek.

### 5.3 Vizyon Uyumu

- **İyi haber:** Faz 2'ye ertelenen özellikler (akıllı arama, puanlama sistemi) kodda hiçbir
  yarım kalmış kalıntı bırakmamış — temiz.
- **"Onaylı puanlayıcı" rolü tanımlı ama hiçbir işe yaramıyor** — zararsız, bu rolün asıl anlamı
  olacağı özellik (puanlama sistemi) henüz yok. Faz 2'de kalabilir.
- **Markanın "sıcak, editöryel kimlik" hedefiyle kodun görsel durumu arasında büyük fark var** —
  bu zaten önceki denetimde bulunmuştu, burada tekrar doğrulandı: tutarlı bir tasarım sistemi
  (renk paleti, yazı tipi) hiçbir katmanda kurulmamış. Özellikle web tarafında (ilk izlenim ve
  SEO en kritik yer) yakın vadede düşünülmeli.

### 5.4 Bilinen, çözülmemiş borç

#### Backend testleri aynı anda çalışınca birbirine karışabilir
**Nerede:** 8 ayrı test dosyası, hepsi gerçek, tek bir veritabanına karşı çalışıyor.
**Sorun ne:** Bu testler aralarında "birbirimin işine karışmayalım" garantisi olmadan aynı
veritabanını paylaşıyor. Şu an sırayla çalıştıkları için sorun görünmüyor, ama daha önce bir
denemede (hız kazanmak için aynı anda çalıştırma denendiğinde) 5 test birden beklenmedik şekilde
kırılmıştı.
**Neden önemli:** Test sayısı arttıkça veya "testleri hızlandıralım" denildiğinde bu sorun
tekrar ortaya çıkacak.
**Önerilen çözüm:** Şimdilik dokunmaya gerek yok. Test sayısı önemli ölçüde artınca, her testin
kendi verisini izole şekilde oluşturup temizlediğinden emin olunmalı.

---

## 6. Özet tablo ve öneri

| Uygulama | Kritik | Orta | Düşük | Toplam |
|---|---|---|---|---|
| Backend | 1 | 7 | 4 | 12 |
| Web Sitesi | 2 | 4 | 2 | 8 |
| Admin Panel | 0 | 3 | 3 | 6 |
| Mobil Uygulama | 4 | 8 | 5 | 17 |
| Genel/Altyapı | 4 | 6 | — | 10 |
| **Toplam** | **11** | **28** | **14** | **53** |

*(Vizyon-uyumu maddeleri bu sayıma dahil değil — onlar "önem derecesi" değil "öncelik" ile
etiketlendi, ayrı bir karar konusu.)*

**Genel değerlendirme:** Projenin temelleri (yetkilendirme, güvenli sorgular, yarış-durumu
korumaları) sağlam — hiçbir katmanda klasik, "veri çalınabilir/silinebilir" türünden bir açık
bulunmadı. En çok dikkat isteyen konular: (1) kullanılan bazı kütüphanelerin eski/açıklı sürümleri
(canlıya çıkmadan önce), (2) mobil uygulamanın henüz gerçek kullanım için eksik kalan birkaç temel
parçası (sayfalama, boş ekranlar, mağaza ayarları), (3) web'in SEO temelinin eksikliği, ve (4)
projenin kendi dokümantasyonunun güncel olmaması.

Bu dosyadaki hiçbir madde için henüz bir işlem yapılmadı — hangi maddelerin ne zaman, hangi
sırayla ele alınacağı sizin kararınıza bağlı.
