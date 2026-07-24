# ADR 001: Redis yok — rate limit/cache Postgres unlogged tabloda, CacheStore interface arkasında
Tarih: 2026-07-24

## Bağlam
MVP pilotu 30-45 mekan, 6 hafta, ≥150 kullanıcı ölçeğinde (Pilot Karar Sözleşmesi, `prd.md §5`). Rate
limiting (IP/kullanıcı bazlı sayaç) ve genel "bilgi yanlış" bildirim sayacı için bir sayaç deposu
gerekiyor. Redis eklemek ayrı bir stateful servis (hosting, yedekleme, bağlantı yönetimi) demek.

## Seçenekler
1. **Redis (Upstash/Railway)** — artı: doğru araç, TTL/atomic increment native. Eksi: MVP ölçeğinde
   gereksiz operasyonel yük, ek maliyet, ek servis = ek hata noktası.
2. **Postgres `unlogged` tablo + `CacheStore` interface** (seçilen) — artı: mevcut Supabase Postgres'te,
   ek servis yok, `unlogged` WAL yazmadığı için normal tablodan hızlı. Eksi: crash sonrası veri kaybı
   (rate limit sayacı için kabul edilebilir — kalıcı veri değil), yüksek yazma sıklığında satır
   kilitlenmesi riski (bkz. erken uyarı sinyali).
3. **In-memory (process içi Map)** — artı: en basit. Eksi: birden fazla API instance'ı olursa (yatay
   ölçekleme) sayaç instance'lar arası paylaşılmaz, rate limit etkisiz kalır.

## Karar
Seçenek 2: Postgres `unlogged` tablo, `CacheStore` interface arkasında (`apps/api/src/common/cache-store.interface.ts`).
Trafik büyüyünce Redis'e geçiş yalnızca `RedisCacheStoreService implements CacheStore` yazıp bir DI
binding değiştirmek — mimari değişikliği gerektirmez.

## Kabul edilen bedel
- Yüksek eşzamanlı yazma trafiğinde (aynı anda çok sayıda istek aynı sayaç satırını güncellerse) satır
  kilitlenmesi/vacuum baskısı oluşabilir — pilot ölçeğinde (haftada ~150 kullanıcı) bu gerçekleşmez ama
  gerçek bir sınır. Bu, "tek instance" sınırlaması değil — Postgres birden fazla API container'ından gelen
  bağlantıyı sorunsuz kaldırır; asıl risk aynı satıra (`rate_limit_counters` tablosunda aynı `key`) çok
  sayıda eşzamanlı `UPSERT` çakışması (write contention), Redis'in atomic `INCR`'ı bunu doğal olarak önler.
- **Sadece Postgres crash-recovery'sinde** (temiz restart/deploy değil) `unlogged` tablo içeriği temizlenir
  — rate limit sayaçları sıfırlanır (kabul edilebilir, kalıcı veri kaybı değil). Normal `pnpm deploy`/servis
  restart'ında veri korunur; bu ayrım önemli çünkü "her deploy'da rate limit sıfırlanıyor" yanlış bir
  varsayıma yol açabilir.

## Erken uyarı sinyalleri
- API p95 gecikmesi rate-limit guard'ı içeren uçlarda 500ms'i geçerse (NFR-02 marjı) VE profiling/`EXPLAIN
  ANALYZE` `rate_limit_counters` tablosundaki `UPSERT` çakışmasını (lock wait) işaret ederse → Redis'e geç.
- Günlük istek hacmi 50.000'i geçerse — bu başlangıç tahmini bir eşik (Pilot Karar Sözleşmesi'nin ≥150
  kullanıcı × günde birkaç oturum varsayımına göre kabaca hesaplanmış); ilk gerçek trafik verisiyle (pilot
  2. haftasından itibaren) yeniden kalibre edilmeli, kör kör 50.000'e sadık kalınmamalı.
- API 2. instance'a ölçeklenirse (yatay ölçekleme kararı verilirse) → aynı PR'da Redis'e geçilmeli,
  ertelenmemeli — yatay ölçekleme + Postgres-backed rate limit kombinasyonu contention riskini büyütür.

## Sonuç (sonradan doldurulur)
Tarih: —
Tuttu mu: —
Ne öğrendik: —
