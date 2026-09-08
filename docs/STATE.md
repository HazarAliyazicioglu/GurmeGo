# Durum — 2026-09-08

## Veri sınırı
Codex: izinli (kişisel proje, kurumsal işaret yok — repo `HazarAliyazicioglu/GurmeGo`)
GLM: izinli
Kaynak: global CLAUDE.md kuralı, kurumsal repo işareti yok

## Aktif plan
"Baştan sona polish" turu (4d/4e'den önce) — `apps/mobile` üzerinde. Worktree:
`.claude/worktrees/mobile-theme`, branch `worktree-mobile-theme`, master'dan 8 commit ileride,
**henüz merge edilmedi**. `git status` temiz, her şey commit'li.

## Şu an ne yapıyoruz
3 tur gerçek cihaz geri bildirimi (tema/hardal palet, filtre paneli, harita sekmesi, giriş/çıkış,
profil kartı) uygulandı, ardından `cross-model-review` (Codex) çalıştırıldı: 3 MAJOR + 1 MINOR
gerçek bug bulundu, hepsi TDD ile düzeltildi (commit `0adb0fb`). Swipe-tab denemesi (material-top-tabs)
kullanıcı isteğiyle geri alındı, düz `bottom-tabs`'a dönüldü (commit `8bf2c55`, bağımlılıklar
`419cb1b`'de kaldırıldı).

## PC açılınca test etmen gerekenler (henüz cihazda doğrulanmadı)
1. Backend'i başlat: `apps/api` → `pnpm --filter @gurmego/api start:dev` (port 3999, `.env` zaten
   ayarlı). Yerel Supabase da açık olmalı (54421/54422).
2. Metro'yu başlat: `apps/mobile` → `pnpm --filter @gurmego/mobile start` (LAN IP değişmiş olabilir —
   `ipconfig` ile kontrol et, `apps/mobile/.env.local`'daki IP'leri güncelle gerekirse).
3. Expo Go'da `exp://<LAN-IP>:8081` ile bağlan.
4. **Test listesi** (son commit `0adb0fb`'den beri hiç cihazda denenmedi):
   - Giriş yap → başarılı olunca form kapanıp önceki ekrana dönüyor mu (önceden dönmüyordu)
   - VenueDetail'de Google puanı yıldızları gerçek puana göre mi (örn. 3.0 için ★★★☆☆, sabit 5 değil)
   - Favoriler sekmesi: giriş yapmışken üstte e-posta + "Çıkış yap"; çıkış hata verirse mesaj görünüyor mu
   - Harita sekmesi: marker'lara dokunma artık 20 mekan sınırını aşsa da çalışıyor mu (test verisiyle
     görünmeyebilir, az sayıda mekan varsa fark etmez)
   - Sekmeler arası swipe YOK artık, sadece alt bar

## Sıradaki adım
Kullanıcı cihazda test edip onaylarsa: ya mobile'da 4. bir geri bildirim turuna devam, ya da
`apps/web`'e geçiş. Henüz karar verilmedi — kullanıcıya sor.

## Bloke olanlar
- Google Maps Android API key yok — harita ekranı hâlâ boş/siyah çıkıyor (bilinçli ertelendi, "sonra
  hallederim" dendi, hâlâ geçerli).

## Yakın kararlar
- Swipe-tab (material-top-tabs) denendi, MapView'in pan gesture'ıyla çakıştı, kullanıcı kaldırılmasını
  istedi — geri alındı. Bir daha önerme.
- Profil bilgisi ayrı sekme değil, Favoriler sekmesine gömülü (kullanıcı tercihi).
- ADR 005 (native mobile pivot), Round 1/2/3 red-team, Plan 1-4 mimari kararları: değişmedi, bkz. önceki
  STATE.md sürümleri / docs/adr/.

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- Tam menü/semantic search/geniş kullanıcı katkısı/Gurme Puanı (MVP'de): Faz 2'ye.
- Review/red-team'i tek turda bitirmeyi ummak: ELENDİ.
- Cross-session/cross-user guard'larda TEK sinyal kullanmak: ELENDİ.
- Expo `EXPO_PUBLIC_*` env'i dinamik `process.env[name]` ile okumak: ELENDİ.
- material-top-tabs ile swipe-tab: ELENDİ — MapView pan gesture çakışması + kullanıcı tercihi.
  KOŞULLU: harita ekranı ayrı bir yaklaşımla (örn. sadece Discovery/Favoriler arası swipe, Harita hariç)
  tekrar denenebilir ama kullanıcı istemedikçe önerme.
