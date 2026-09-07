# ADR 005: MVP tüketici deneyimi native mobile app (React Native/Expo), web/PWA değil
Tarih: 2026-09-07

## Bağlam
2026-07-16 round-2 red-team'i, orijinal spec'teki "React Native ana deneyim" kararını MVP kapsamı
için erteleyip web/PWA'ya indirgemişti (gerekçe: henüz hiçbir hesabı olmayan bir 6 haftalık/150
kullanıcılık pilotun önüne erken native app karmaşıklığı koymamak). Plan 1-4c bu web/PWA
varsayımıyla tamamlandı ve `master`'a merge edildi (Task 27, 2026-09-06).

Kullanıcı bu kararı pilot başlamadan önce tersine çevirdi: MVP'nin tüketici deneyimi artık
web/PWA değil, native app (iOS+Android) olacak. Gerekçe: (1) mağaza (App Store/Play Store)
görünürlüğü/güveni gerekli görülüyor, (2) PWA deneyiminin (konum, genel akıcılık) yetersiz
hissettirmesi.

`idea-red-team` (Codex, 2026-09-07) bu pivotu **NO-GO** ile değerlendirdi, yüksek güvenle —
mağaza-güven varsayımının kanıtsız olduğunu, tamamlanmış/doğrulanmış bir yüzeyin (web/PWA)
yeniden yazılmasının pilotu 5-9 hafta geciktireceğini öne sürerek. Kullanıcı bu verdikti bilerek
reddetti. Tam rapor: `docs/superpowers/specs/2026-09-07-mobile-mvp-pivot-design.md` §0, §8.

## Seçenekler
1. **React Native (Expo) native app** — artı: mağaza varlığı, gerçek native konum/performans,
   `architecture.md`'nin orijinal hedefine dönüş. eksi: ~2.200 satır web UI'nin sıfırdan yeniden
   yazılması, 20-35 mühendis-günü + 14 gün Play closed test + belirsiz Apple review süresi,
   auth/session lifecycle karmaşıklığı (web'de 11 review turu gerektirmişti), iki istemci
   (web+mobile) bakım yükü.
2. **Web/PWA'da kal (mevcut karar)** — artı: zaten tamamlanmış, test edilmiş, merge edilmiş; sıfır
   ek geliştirme maliyeti; pilot hemen başlayabilir. eksi: mağaza varlığı yok, PWA'nın native
   izin/performans deneyimi tarayıcıya bağımlı.
3. **Capacitor (mevcut web'i native kabuğa sarma)** — artı: hızlı, apps/web'i olduğu gibi kullanır.
   eksi: içi hâlâ webview — "PWA yetersiz hissettiriyor" endişesini çözmüyor, sadece mağaza
   görünürlüğü sorununu çözer. `idea-red-team`'e bu seçenek de sorulmadı, kullanıcı doğrudan
   1'i seçti.

## Karar
Seçenek 1 — React Native (Expo), backend (`apps/api`) neredeyse hiç değişmeden (tek istisna:
`plan-red-team`'in favoriden-çıkarma bulgusu üzerine kullanıcı kararıyla eklenen
`DELETE /me/lists/:id/venues/:venueId`, bkz. `docs/superpowers/plans/2026-09-07-mobile-mvp.md`
Task 1 — web'de de backend'de de hiç var olmayan bir özellikti, gerçek parite için eklendi),
`packages/shared` zod şemaları tekrar kullanılarak (mobile ile web AYNI şema tanımlarını paylaşır,
bkz. Task 2 — v1'de bu iki istemcide ayrı ayrı tanımlanacaktı, `plan-red-team` bunu bulup düzeltti).

## Kabul edilen bedel
- Tamamlanmış, test edilmiş, 11 review turundan geçmiş web/PWA tüketici deneyimi (Plan 2) aktif
  geliştirmeden çıkarılıyor, sadece SEO/marketing sitesi olarak kalıyor — o yatırımın büyük kısmı
  pilotun asıl deneyimi için kullanılmayacak.
- Pilot başlangıcı gerçekçi olarak 5-9 hafta gecikiyor (pilotun kendisi 6 hafta) — "öğrenme
  süresini geliştirme süresine çeviriyoruz" (Codex'in ifadesi).
- Mağaza-güven varsayımı kanıtsız — hiçbir saha verisi bunu doğrulamıyor, bilinçli bir bahis.
- İki istemci (web SEO + native mobile) artık ayrı ayrı bakım gerektiriyor; Plan 4d'nin KVKK/
  event-capture/hesap silme kapsamı da ikiye katlanıyor.
- Apple Developer Program ($99/yıl) + Google Play Console ($25) gerçek para harcanıyor.

## Erken uyarı sinyalleri
Bu karar YANLIŞSA şu ölçülebilir eşiklerin altında/üstünde kalırız (Codex'in "fikrimi ne
değiştirir" kriterinden alındı, design doc §0 — düzeltme: `plan-red-team` (2. tur) bu bölümün
kendi içinde çelişkili olduğunu buldu; "D7 <%25" ve "D7 <%10" iki AYRI karşılaştırma noktasıydı
(biri native'in kendi regret eşiği, diğeri hiç koşulmayacak bir PWA-karşılaştırma senaryosu) —
tek, net bir eşiğe indirgendi aşağıda):
- 100 kullanıcılık eşzamanlı bir kurulum testinde native koldaki 50 kişiden **<30'u** kurulumu
  tamamlarsa.
- Kurulum yapanların **<%25'i** D7'de geri dönerse (pilotun kendi gerçek verisiyle ölçülür, ayrı
  bir PWA kontrol grubu koşturulmayacak — bu tek başına yeterli bir regret sinyali).
- Toplam geliştirme + release-candidate hazırlığı, kabul edilen 20-35 mühendis-günlük tahminin
  **belirgin üstüne** (**>45 mühendis-günü**) çıkarsa.
- Pilot başlangıcı, kabul edilen 5-9 haftalık pencereyi de aşarsa (örn. 12+ hafta).

Bu sinyallerden herhangi biri gerçekleşirse: web/PWA'ya (Plan 2, zaten merge edilmiş ve çalışır
durumda) geri dönüş gündeme gelmeli — kod kaybolmadı, sadece aktif geliştirmeden çıkarıldı.

## Sonuç (sonradan doldurulur)
Tarih: —
Tuttu mu: —
Ne öğrendik: —
