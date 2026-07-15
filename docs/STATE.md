# Durum — 2026-07-16

## Veri sınırı
Kurumsal repo değil (kişisel proje). Codex/GLM delegasyonu serbest.

## Aktif plan
Yok — henüz kod yazma turu başlamadı. Spec revizyonu tamamlandı, sırada iskelet kurulumu var.

## Şu an ne yapıyoruz
`idea-red-team` skill'i ile proje Codex'e (GPT-5.6 Sol, high effort) yıktırıldı. Verdikt: **NO-GO**
(orijinal haliyle). Kullanıcıyla birlikte kapsam önemli ölçüde daraltıldı ve tüm doküman seti
(product-overview.md, prd.md, architecture.md, rule-engine.md, api-spec.md, ai-prompt-design.md,
infrastructure.md, development-guidelines.md) buna göre güncellendi. Tam değişiklik listesi ve
gerekçeler: docs/CHANGELOG.md (2026-07-16 girdisi).

Özet pivot: menü/fiyat sistemi yerine fiyat aralığı + favori ürünler (tam menü Faz 2), "butik" tanımı
gerçek dünya kategorisine oturdu (zincir değil, ≤3 şube, IG/TikTok'ta dolaşan yerler), kullanıcı katkısı
+ mekan-sahibi-girişi Faz 2'ye alındı (MVP verisi yalnızca kürasyon ekibinden: Hazar + 1-2 kişi),
semantic search/AI arama tamamen Faz 2'ye çekildi (MVP arama yalnızca yapısal filtre), WhatsApp paylaşım
ve Google yorumlarına deep-link MVP'ye eklendi, MVP mekan sayısı hedefi (~225) düşürülecek (kesin sayı
henüz yok).

## Sıradaki adım
Kullanıcıyla MVP mekan sayısı hedefini netleştir, sonra ilk kod turuna geç: architecture.md §3'teki
monorepo iskeletini (pnpm workspace + Turborepo) kur.

## Bloke olanlar
- Yok.

## Yakın kararlar
- Red-team verdikti, tam pivot tablosu ve reddedilen bulgu: docs/CHANGELOG.md (2026-07-16 girdisi)

## Denenmiş ve ELENMİŞ yaklaşımlar
- Tam menü sistemi (kalem+fiyat, MVP'de): ELENDİ. Gerekçe: Codex — sürekli çürüyen envanter, tek
  kişi/küçük ekiple sürdürülemez (ayda 38-75 saat sadece güncellik kontrolü). KOŞULLU — kürasyon ekibi
  büyür veya restoran-sahibi-girişi (Faz 2) aktif olursa yeniden değerlendir.
- Semantic search/pgvector (MVP'de, ilk tasarım): ELENDİ → Faz 2'ye alındı. Gerekçe: Codex — birkaç yüz
  mekanlık veri setinde gereksiz karmaşıklık ("mühendislik kostümü"); kullanıcı MVP'de tamamen yapısal
  filtreyi tercih etti. KOŞULLU — Faz 2'de mekan sayısı büyüyünce yeniden değerlendir.
- "Butik" tanımını salt DB kuralına (şube sayısı ≤4) dayandırmak: ELENDİ. Gerekçe: kullanıcı açısından
  anlamsız/keyfi. KALICI — artık gerçek dünya kategorisi (IG/TikTok'ta dolaşan, ≤3 şubeli yerler) ile
  tanımlanıyor, eşik hâlâ config'te ama tanım daha isabetli.
- Kullanıcı katkısını MVP'de açık tutmak: ELENDİ → Faz 2'ye alındı. Gerekçe: Codex — MVP'de kullanıcı
  kitlesi yokken katkı akışı çalışmaz (döngü: katkı için kullanıcı, kullanıcı için güvenilir veri
  gerekir). KOŞULLU — kullanıcı tabanı oluşunca (Faz 2 hedefi) yeniden aç.
- Google yorumlarını Places API ile uygulama içinde göstermek: ELENDİ, deep-link ile değiştirildi.
  Gerekçe: API'nin ToS kısıtları (attribution zorunlu, review metni 30 günden fazla cache'lenemez) +
  ücretli istek; MVP'de risk/maliyete değmiyor. KOŞULLU — Faz 2'de kendi review hacmi yetersiz kalırsa
  yeniden değerlendir.
