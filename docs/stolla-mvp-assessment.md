# Stolla MVP Değerlendirmesi ve Önerilen Yol Haritası

## Genel sonuç

Stolla çalışan bir testnet MVP'si, ancak henüz production-ready veya contributor-ready bir ürün değil. Kontrat temeli sağlam görünüyor; en büyük eksikler proposal keşfi, frontend kalite kapıları, mobil uyumluluk, gerçek ürün verisi ve güvenlik sertleştirmesi.

Önerilen bir sonraki hedef, doğrudan multi-community veya mainnet'e geçmek yerine **Stolla v0.2: kullanılabilir ve doğrulanabilir tek topluluk pilotu** olmalıdır.

## Doğrulanan mevcut durum

### Çalışan parçalar

- Next.js production build başarılı.
- `/`, `/community`, `/proposals` ve `/proposals/[id]` route'ları derleniyor.
- Toplam üç contract testi başarılı. Testlerde doğrulanan davranışlar:
  - NFT owner-only mint
  - Token URI saklama
  - Delegation sonrası voting power
  - Proposal oluşturma ve oy verme
- Production server üzerinde testnet RPC bağlantısı çalıştı.
- Stolla Community ve STOLLA collection bilgisi zincirden okunabildi.
- NFT mint, delegation, proposal oluşturma ve vote gönderme kod yolları mevcut.
- Landing sayfası masaüstünde görsel olarak güçlü ve ürünü anlaşılır anlatıyor.
- Ürünün mevcut kapsamı tek NFT ve tek Governor instance olarak tanımlanmış: [PRD](prd.md#L12).

### Ekran görüntüleri

Production build üzerinden alınan görüntüler:

- [Landing — desktop](../.local/screenshots/landing-desktop-retry.png)
- [Landing — mobile](../.local/screenshots/landing-mobile.png)
- [Community — desktop](../.local/screenshots/community-production.png)
- [Community — mobile](../.local/screenshots/community-mobile-production.png)
- [Proposals — desktop](../.local/screenshots/proposals-production.png)
- [Proposals — mobile](../.local/screenshots/proposals-mobile-production.png)

Ekran görüntüleri `.local/` altında tutuluyor ve Git tarafından ignore ediliyor.

## Tespit edilen temel sorunlar

### 1. Proposal listesi gerçek anlamda public değil

Proposal kimlikleri zincirden veya bir indexer'dan bulunmuyor; yalnızca proposal'ı oluşturan tarayıcının `localStorage` alanında saklanıyor: [contracts.ts](../apps/web/src/lib/contracts.ts#L54).

Bunun sonucunda:

- Başka cihazdan giren kullanıcı proposal'ları göremiyor.
- Tarayıcı verisi temizlenince liste kayboluyor.
- Landing sayfasından **Browse proposals** bağlantısını izleyen kullanıcı boş bir listeyle karşılaşıyor.
- Public governance geçmişi sunulamıyor.
- PRD'deki “her kullanıcı proposal durumunu ve oy sayılarını görür” hedefi karşılanmıyor.

Bu, mevcut ürünün en önemli açığıdır.

### 2. Oy sonuçları görünmüyor

Proposal detail ekranında yalnızca proposal state'i ve kullanıcının oy verip vermediği gösteriliyor. Aşağıdaki bilgiler eksik:

- For / Against / Abstain toplamları
- Proposal açıklaması
- Proposer
- Başlangıç ve bitiş ledger bilgisi
- Quorum ilerlemesi
- Kullanıcının voting power'ı
- Explorer bağlantıları

Ürün zincirde oy kullandırıyor, ancak governance kararını kullanıcıya yeterince görünür kılmıyor.

### 3. Landing sayfasında statik veri gerçek veri gibi sunuluyor

Landing hero içindeki proposal'lar kodda sabit tanımlanmış olmasına rağmen panelde **Live from RPC** yazıyor: [HeroSection.tsx — veri](../apps/web/src/components/landing/HeroSection.tsx#L13) ve [HeroSection.tsx — etiket](../apps/web/src/components/landing/HeroSection.tsx#L86).

Bu ifade mevcut durumda yanıltıcıdır. Panel ya gerçek proposal verisine bağlanmalı ya da açıkça **Demo data** olarak işaretlenmelidir.

### 4. Mobil görünümde yatay taşma var

Mobil ekran görüntülerinde aşağıdaki sorunlar gözlendi:

- Wallet butonu viewport dışında kalıyor.
- Header tek satıra sığmıyor.
- Bazı başlıklar ve açıklamalar sağdan kesiliyor.
- Form kartları viewport dışına taşıyor.
- Landing header CTA'sı kısmen görünmez durumda.

Header'daki logo, iki navigasyon bağlantısı ve wallet butonu her genişlikte tek satıra zorlanıyor: [Header.tsx](../apps/web/src/components/Header.tsx#L17).

### 5. Lint kalite kapısı kırmızı

İnceleme sırasında `npm run lint` sonucu:

- 14 hata
- 21 uyarı

Hataların ana kaynakları:

- Üç sayfadaki effect/state yaklaşımı
- Otomatik üretilmiş contract binding dosyalarının normal uygulama kodu gibi lint edilmesi
- Generated binding'lerde `any`, declaration merging ve `@ts-ignore` kullanımı

Production build başarılı olsa da contributor PR'ları için güvenilir bir kalite kapısı bulunmuyor.

### 6. Frontend test altyapısı yok

Package script'lerinde frontend unit, component veya E2E testi bulunmuyor: [apps/web/package.json](../apps/web/package.json#L5).

Aşağıdaki akışlar otomatik olarak doğrulanmıyor:

- Wallet connect/disconnect
- RPC loading ve error state'leri
- Mint form validasyonu
- Delegation
- Proposal oluşturma
- Proposal listesi
- Vote gönderme
- Mobil navigasyon

### 7. CI bulunmuyor

PRD, contract testlerinin CI üzerinde çalışmasını kabul kriteri olarak belirtiyor; ancak `.github/workflows` altında bir workflow bulunmuyor: [PRD](prd.md#L29).

### 8. Development server kararsız

`next dev` sırasında aralıklı olarak React Client Manifest ve stale Turbopack hataları oluştu. Production build ve `next start` sorunsuz çalıştı.

Muhtemel etkenler:

- Root ve `apps/web` altında iki ayrı lockfile bulunması
- Next.js'in workspace root'unu tahmin etmek zorunda kalması
- Turbopack root yapılandırmasının bulunmaması
- Dev cache ve dependency çözümleme farkları

Bu henüz doğrulanmış bir kök neden değildir, ancak contributor onboarding öncesinde araştırılıp çözülmelidir.

### 9. Dependency güvenlik borcu var

İnceleme sırasında `npm audit --omit=dev` sonucu:

- Toplam 39 bulgu
- 1 critical
- 11 high
- 9 moderate
- 18 low

Bulguların büyük bölümü wallet kit, Trezor, protobuf, Axios, Next.js ve diğer transitive dependency'lerden geliyor. Bunların varlığı doğrudan sömürülebilir oldukları anlamına gelmez; dependency tree ve browser bundle erişilebilirliği üzerinden ayrı ayrı değerlendirilmelidir.

Körlemesine `npm audit fix --force` uygulanmamalıdır.

### 10. Contract test kapsamı MVP için dahi dar

Mevcut üç başarılı test aşağıdaki durumları kapsamıyor:

- Geçersiz veya boş token URI
- NFT transferinden sonra voting power
- Yeniden delegation
- Birden fazla NFT ile oy ağırlığı
- Duplicate voting
- Quorum sınırları
- Proposal threshold sınırları
- Cancel yetkilendirmesi
- Execute başarısı ve başarısızlığı
- Voting delay ve voting period sınırları
- Storage yaşam süresi ve upgrade davranışı
- Property/fuzz testleri

Mainnet öncesinde bunların çoğunun kapsanması gerekecektir.

## Önerilen ürün yönü

### Aşama 1 — Stolla v0.2: Güvenilir tek-community pilotu

Öncelikli hedef:

> Herhangi bir kullanıcı Stolla'ya girdiğinde gerçek testnet community bilgisini ve bütün proposal geçmişini görebilmeli; wallet bağlayarak anlaşılır bir şekilde mint, delegate, propose ve vote akışını tamamlayabilmeli.

Bu aşamada:

- Proposal indexleme çözülmeli.
- Proposal kartları ve gerçek oy sonuçları gösterilmeli.
- Mobil taşmalar düzeltilmeli.
- Transaction lifecycle tasarlanmalı.
- Lint, CI ve frontend testleri eklenmeli.
- Landing sayfasında yalnızca gerçek veya açıkça demo olarak işaretlenmiş veri kullanılmalı.
- En az bir gerçek testnet pilot community ile uçtan uca doğrulama yapılmalı.

### Aşama 2 — Stolla v0.3: Multi-community platformu

Tek-community pilotu stabil olduktan sonra aşağıdaki işler ele alınmalı:

- `CommunityFactory` kontratı
- Community registry
- `/communities`
- `/communities/[id]`
- Community oluşturma wizard'ı
- Her community için ayrı NFT ve Governor
- Community logo, açıklama ve metadata alanları
- Community bazlı proposal indexleme
- Governance parametrelerini deployment sırasında seçme

Bu aşama Stolla'yı tek DAO demosundan Stellar projelerinin kullanabileceği bir governance launchpad'e dönüştürür.

### Aşama 3 — Mainnet readiness

- Contract test matrisini genişletme
- Property/fuzz testleri
- Yetkilendirme ve storage incelemesi
- Dependency güvenlik temizliği
- Audit hazırlığı
- Testnet pilot geri bildirimlerini işleme
- Timelock ve execution modelini ayrıca tasarlama
- Monitoring ve hata takibi
- Mainnet deployment runbook'u

Timelock/treasury execution'ın v0.2 kapsamına alınmaması önerilir. Önce signaling governance akışının güvenilir, keşfedilebilir ve kullanılabilir olması daha değerlidir.

## İlk GrantFox issue dalgası için adaylar

Bu maddeler henüz nihai issue metinleri değildir. Bir sonraki adımda her biri yaklaşık yarım günlük, bağımsız ve doğrulanabilir işlere ayrılacaktır.

### Başlangıç seviyesi

- Mobil app header ve yatay taşmaları düzelt.
- Landing sayfasındaki statik veriyi **Demo data** olarak işaretle.
- Contributor guide ve PR template oluştur.
- Community ve proposal ekranlarına skeleton/loading state ekle.

### Orta seviye

- Generated contract binding'lerini lint kapsamından doğru şekilde ayır.
- React effect lint hatalarını gider.
- GitHub Actions ile frontend build/lint ve contract test CI ekle.
- Workspace lockfile ve Turbopack root problemini çöz.
- Proposal detail ekranına oy toplamları ve quorum göstergesi ekle.
- Transaction durum bileşeni oluştur: simulation, wallet approval, submission, confirmation ve failure.

### İleri seviye

- `localStorage` yerine event/RPC tabanlı proposal discovery geliştir.
- Governor contract edge-case test paketini genişlet.
- NFT transfer/delegation invariant testleri ekle.
- Wallet dependency ağacındaki güvenlik bulgularını analiz edip upgrade planı çıkar.
- Multi-community factory için teknik tasarım ve prototip hazırla.

## Önerilen öncelik sırası

1. CI, lint ve development server güvenilirliği
2. Mobil layout
3. Proposal discovery/indexleme
4. Gerçek proposal detayları ve oy sonuçları
5. Transaction UX ve hata yönetimi
6. Contract test kapsamı
7. Dependency güvenlik temizliği
8. Testnet pilot
9. Multi-community factory
10. Audit ve mainnet

## Sonuç

Stolla'nın kontrat fikri ve görsel kimliği hazır. Bir sonraki değerli sıçrama yeni kontrat özelliği eklemek değil; mevcut governance akışını public, güvenilir, mobil uyumlu ve doğrulanabilir bir ürüne çevirmektir.
