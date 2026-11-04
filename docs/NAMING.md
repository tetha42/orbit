# Naming: English only

Orbit is built for international use, so the database, the API, function names and
variable names are English. This page defines the vocabulary and records what
the old Turkish names became.

## Rules

1. Identifiers (variables, parameters, properties, functions, types, files and routes) are English.
2. Values the application stores — statuses, types, roles, settings keys, JSON keys — are English.
   Existing databases are upgraded in place at start-up by `src/db/legacyValues.ts`.
3. User-facing text is translated through i18n (`tr` and `en`). It may stay Turkish in the `tr` catalogue.
4. `pnpm check` runs `scripts/check-identifiers.mjs`; a Turkish word from the table below in a
   declared name under `src/` fails the build.

## What the 733 flagged names became

The identifier check of the previous release tolerated 733 declarations (148 distinct names).
All of them are renamed:

| Old name | New name | Declarations |
| --- | --- | --- |
| `mesaj` | `message` | 58 |
| `aciklama` | `description` | 46 |
| `baslik` | `title` | 37 |
| `kategori` | `category` | 35 |
| `bolum` | `department` | 27 |
| `renk` | `color` | 25 |
| `tur` | `type` | 23 |
| `yonet` | `manage` | 21 |
| `icerik` | `content` | 19 |
| `sinif` | `grade` | 19 |
| `izinler` | `permissions` | 18 |
| `etkinlikId` | `eventId` | 14 |
| `rolAd` | `roleName` | 14 |
| `kurus` | `minor` | 11 |
| `boyut` | `size` | 10 |
| `kullaniciAdSoyad` | `userNameSurname` | 9 |
| `setAciklama` | `setDescription` | 9 |
| `setKategori` | `setCategory` | 9 |
| `uyeler` | `members` | 9 |
| `basvuruNotu` | `applicationNote` | 8 |
| `mesajId` | `messageId` | 8 |
| `neden` | `reason` | 8 |
| `atananUyeId` | `assigneeMemberId` | 7 |
| `gorevId` | `taskId` | 7 |
| `sonMesaj` | `lastMessage` | 7 |
| `takimAdi` | `teamName` | 7 |
| `liderAdSoyad` | `leaderNameSurname` | 6 |
| `rolBilgi` | `roleInfo` | 6 |
| `takimlar` | `teams` | 6 |
| `takimRolu` | `teamRole` | 6 |
| `fark` | `diff` | 5 |
| `kayitSayisi` | `recordCount` | 5 |
| `secenekId` | `optionId` | 5 |
| `sistem` | `system` | 5 |
| `takim` | `team` | 5 |
| `aktifUyeSayisi` | `activeMemberCount` | 4 |
| `ekler` | `attachments` | 4 |
| `kasa` | `vault` | 4 |
| `kasalar` | `vaults` | 4 |
| `kayitlar` | `records` | 4 |
| `konu` | `topic` | 4 |
| `setDurum` | `setStatus` | 4 |
| `setTur` | `setType` | 4 |
| `sonAktifIp` | `lastActiveIp` | 4 |
| `sonAktifTarihi` | `lastActiveDate` | 4 |
| `tehditPuani` | `threatScore` | 4 |
| `yanitlananMesaj` | `repliedMessage` | 4 |
| `yanitlananMesajId` | `repliedMessageId` | 4 |
| `anket` | `poll` | 3 |
| `atlananlar` | `skipped` | 3 |
| `durum` | `status` | 3 |
| `gonderen` | `sender` | 3 |
| `gonderenAd` | `senderName` | 3 |
| `issueBaslik` | `issueTitle` | 3 |
| `issueEtkinlikId` | `issueEventId` | 3 |
| `izin` | `permission` | 3 |
| `katilinanEtkinlik` | `attendedEvent` | 3 |
| `kullaniciBolum` | `userDepartment` | 3 |
| `kullaniciSayisi` | `userCount` | 3 |
| `rolId` | `roleId` | 3 |
| `rolRenk` | `roleColor` | 3 |
| `sayfa` | `page` | 3 |
| `setBaslik` | `setTitle` | 3 |
| `setIssueBaslik` | `setIssueTitle` | 3 |
| `setIssueEtkinlikId` | `setIssueEventId` | 3 |
| `setTarih` | `setDate` | 3 |
| `sonraki` | `next` | 3 |
| `takimAd` | `teamName` | 3 |
| `tamamlananGorev` | `completedTask` | 3 |
| `toplam` | `total` | 3 |
| `aktif` | `active` | 2 |
| `aktifOturumToken` | `activeSessionToken` | 2 |
| `basvuruZorunlu` | `applicationRequired` | 2 |
| `bekleyenBasvuru` | `pendingApplication` | 2 |
| `benimTakimSayim` | `myTeamCount` | 2 |
| `gelir` | `income` | 2 |
| `gider` | `expense` | 2 |
| `gonderenFoto` | `senderPhoto` | 2 |
| `gonderenId` | `senderId` | 2 |
| `hedef` | `target` | 2 |
| `karsiKasaAd` | `counterpartVaultName` | 2 |
| `konuId` | `topicId` | 2 |
| `kullaniciOylari` | `userVotes` | 2 |
| `liderMi` | `leaderMi` | 2 |
| `mesajSayisi` | `messageCount` | 2 |
| `sayfaBoyutu` | `pageSize` | 2 |
| `setTutar` | `setAmount` | 2 |
| `sonGonderen` | `lastSender` | 2 |
| `toplamOy` | `totalVote` | 2 |
| `tutar` | `amount` | 2 |
| `yeniIcerik` | `newContent` | 2 |
| `yeniSifre` | `newPassword` | 2 |
| `zaman` | `time` | 2 |
| `__beuRolOnbellegi` | `__beuRoleCache` | 1 |
| `__sistemLogBakimi` | `__SystemLogMaintenance` | 1 |
| `_kullaniciId` | `_UserId` | 1 |
| `acikGorev` | `openTask` | 1 |
| `aktifIp` | `activeIp` | 1 |
| `aktifTakimlar` | `activeTeams` | 1 |
| `aktifTime` | `activeTime` | 1 |
| `aktifUye` | `activeMember` | 1 |
| `ChatOda` | `ChatRoom` | 1 |
| `ChatOdaItem` | `ChatRoomItem` | 1 |
| `cleanBolum` | `cleanDepartment` | 1 |
| `duzenle` | `edit` | 1 |
| `eklerJson` | `attachmentsJson` | 1 |
| `eposta` | `email` | 1 |
| `epostaIleHaber` | `emailWithNews` | 1 |
| `etkinlik` | `event` | 1 |
| `etkinlik_izni` | `event_Permission` | 1 |
| `Fark` | `Diff` | 1 |
| `FarkSatiri` | `DiffRow` | 1 |
| `hedefYol` | `targetPath` | 1 |
| `HER_ZAMAN_ACIK` | `EVERY_TIME_OPEN` | 1 |
| `intelAktif` | `intelActive` | 1 |
| `isKategori` | `isCategory` | 1 |
| `kategoriDagilimi` | `categoryDistribution` | 1 |
| `kayitliEtkinlik` | `registeredEvent` | 1 |
| `kayitZamani` | `recordTime` | 1 |
| `kullanici` | `user` | 1 |
| `onIslemChange` | `onActionChange` | 1 |
| `onKategoriChange` | `onCategoryChange` | 1 |
| `onKisiChange` | `onPersonChange` | 1 |
| `onKisiDegisti` | `onPersonChanged` | 1 |
| `onRolChange` | `onRoleChange` | 1 |
| `onRolFilterChange` | `onRoleFilterChange` | 1 |
| `onSelectKategori` | `onSelectCategory` | 1 |
| `onTurChange` | `onTypeChange` | 1 |
| `postaEposta` | `mailEmail` | 1 |
| `rawTur` | `rawType` | 1 |
| `setBolum` | `setDepartment` | 1 |
| `setHedef` | `setTarget` | 1 |
| `setIzinler` | `setPermissions` | 1 |
| `setRenk` | `setColor` | 1 |
| `setSifre` | `setPassword` | 1 |
| `setSinif` | `setGrade` | 1 |
| `setYeniSifre` | `setNewPassword` | 1 |
| `setYeniSifreTekrar` | `setNewPasswordRepeat` | 1 |
| `sifreSifirla` | `passwordReset` | 1 |
| `sil` | `remove` | 1 |
| `toplamSayfa` | `totalPage` | 1 |
| `uye` | `member` | 1 |
| `uyeIdleri` | `memberIds` | 1 |
| `uyelerData` | `membersData` | 1 |
| `yanitlananMesajJson` | `repliedMessageJson` | 1 |
| `yeniSifreTekrar` | `newPasswordRepeat` | 1 |
| `yeniUyeIdleri` | `newMemberIds` | 1 |
| `zamanStr` | `timeStr` | 1 |

## Word list (identifier pieces)

Names are split into words (`kullaniciAdSoyad` → `kullanici` + `Ad` + `Soyad`) and each Turkish word is replaced:

| Turkish | English |
| --- | --- |
| `acik` | `open` |
| `aciklama` | `description` |
| `acil` | `urgent` |
| `ad` | `name` |
| `aday` | `candidate` |
| `adet` | `count` |
| `adi` | `name` |
| `adim` | `step` |
| `adimi` | `step` |
| `adres` | `address` |
| `agirligi` | `weight` |
| `akis` | `feed` |
| `aksiyon` | `action` |
| `aktarim` | `transfer` |
| `aktarimi` | `transfer` |
| `aktif` | `active` |
| `aktivite` | `activity` |
| `aktivoturumtoken` | `activeSessionToken` |
| `aktor` | `actor` |
| `alan` | `field` |
| `alani` | `field` |
| `alanlar` | `fields` |
| `alanlari` | `fields` |
| `aldim` | `received` |
| `alici` | `recipient` |
| `alicilar` | `recipients` |
| `anahtar` | `key` |
| `anahtari` | `key` |
| `anket` | `poll` |
| `anonim` | `anonymous` |
| `araligi` | `range` |
| `arama` | `search` |
| `aranan` | `searched` |
| `ariza` | `failure` |
| `arizali` | `faulty` |
| `arsiv` | `archive` |
| `arsivle` | `archive` |
| `asla` | `never` |
| `atama` | `assignment` |
| `atanabilir` | `assignable` |
| `atanan` | `assignee` |
| `atayan` | `assigner` |
| `atlananlar` | `skipped` |
| `atolye` | `workshop` |
| `ay` | `month` |
| `ayar` | `setting` |
| `ayarlar` | `settings` |
| `aylar` | `months` |
| `aylik` | `monthly` |
| `ayni` | `same` |
| `ayril` | `leave` |
| `ayrildi` | `left` |
| `bakim` | `maintenance` |
| `bakimi` | `maintenance` |
| `bakiye` | `balance` |
| `baslangic` | `start` |
| `baslangictarihi` | `startDate` |
| `baslik` | `title` |
| `basvuru` | `application` |
| `basvurular` | `applications` |
| `begendim` | `iLiked` |
| `begeni` | `like` |
| `beklenen` | `expected` |
| `bekleyen` | `pending` |
| `bekliyor` | `pending` |
| `belge` | `document` |
| `belgeli` | `documented` |
| `bende` | `mine` |
| `benim` | `my` |
| `bildirim` | `notification` |
| `bildirimler` | `notifications` |
| `bilet` | `ticket` |
| `bilgi` | `info` |
| `bitis` | `end` |
| `bitistarihi` | `endDate` |
| `bitti` | `finished` |
| `bolum` | `department` |
| `bolumler` | `departments` |
| `bos` | `empty` |
| `boyut` | `size` |
| `boyutu` | `size` |
| `bulunamadi` | `notFound` |
| `calistir` | `run` |
| `canli` | `live` |
| `cevap` | `reply` |
| `cevapla` | `reply` |
| `cihazi` | `device` |
| `cikan` | `leaving` |
| `cikis` | `logout` |
| `cinsiyet` | `gender` |
| `coklu` | `multiple` |
| `cope` | `trash` |
| `copte` | `trashed` |
| `dagilim` | `distribution` |
| `dagilimi` | `distribution` |
| `dakika` | `minutes` |
| `deger` | `value` |
| `degisiklikler` | `changes` |
| `degisti` | `changed` |
| `degistir` | `change` |
| `deneme` | `attempt` |
| `denetim` | `audit` |
| `detay` | `detail` |
| `devam` | `ongoing` |
| `dil` | `language` |
| `dogrulama` | `verification` |
| `dogrulandi` | `verified` |
| `dogum` | `birth` |
| `dolu` | `full` |
| `doluluk` | `occupancy` |
| `dosya` | `file` |
| `durum` | `status` |
| `durumu` | `status` |
| `durumum` | `myStatus` |
| `dusuk` | `low` |
| `dusurulen` | `dropped` |
| `duyuru` | `announcement` |
| `duyurular` | `announcements` |
| `duzenle` | `edit` |
| `duzenlenme` | `edit` |
| `eki` | `attachment` |
| `ekle` | `add` |
| `eklenen` | `added` |
| `eklenme` | `added` |
| `ekler` | `attachments` |
| `ekran` | `screen` |
| `eksik` | `missing` |
| `eksiksiz` | `complete` |
| `engeller` | `blocks` |
| `envanter` | `inventory` |
| `eposta` | `email` |
| `erisilebilir` | `accessible` |
| `erisim` | `access` |
| `eski` | `old` |
| `etiket` | `tag` |
| `etiketler` | `tags` |
| `etkilenen` | `affected` |
| `etkin` | `active` |
| `etkinlik` | `event` |
| `etkinlikler` | `events` |
| `evrak` | `document` |
| `fakulte` | `faculty` |
| `fark` | `diff` |
| `farki` | `diff` |
| `farkli` | `different` |
| `fazla` | `extra` |
| `filtre` | `filter` |
| `fis` | `receipt` |
| `foto` | `photo` |
| `gad` | `givenName` |
| `gecer` | `valid` |
| `gecerli` | `valid` |
| `gecerlilik` | `validity` |
| `gecersiz` | `invalid` |
| `gecici` | `temporary` |
| `gecikmis` | `overdue` |
| `gecikti` | `overdue` |
| `gecmis` | `history` |
| `gecmisi` | `history` |
| `gelen` | `incoming` |
| `gelene` | `inbox` |
| `gelir` | `income` |
| `genel` | `general` |
| `geri` | `back` |
| `getir` | `fetch` |
| `gidecek` | `outgoing` |
| `gider` | `expense` |
| `girdisi` | `input` |
| `giris` | `login` |
| `girisyap` | `login` |
| `gizli` | `hidden` |
| `gonder` | `send` |
| `gonderen` | `sender` |
| `gonderenad` | `senderName` |
| `gonderenfoto` | `senderPhoto` |
| `gonderenid` | `senderId` |
| `gonderildi` | `sent` |
| `gonderilen` | `sent` |
| `gonderim` | `sending` |
| `gorev` | `task` |
| `gorevler` | `tasks` |
| `gorulme` | `seen` |
| `goster` | `show` |
| `govde` | `body` |
| `gsoyad` | `familySurname` |
| `gun` | `day` |
| `guncelle` | `update` |
| `guncelleme` | `update` |
| `guncellenen` | `updated` |
| `guncellenme` | `update` |
| `guncelleyen` | `updater` |
| `gundem` | `agenda` |
| `guvenilir` | `trusted` |
| `haber` | `news` |
| `haberler` | `news` |
| `hareket` | `movement` |
| `hareketler` | `movements` |
| `hata` | `error` |
| `hazir` | `ready` |
| `hedef` | `target` |
| `hedefler` | `targets` |
| `hepsi` | `all` |
| `her` | `every` |
| `herhangi` | `any` |
| `herkese` | `everyone` |
| `iade` | `return` |
| `icerik` | `content` |
| `idler` | `ids` |
| `idleri` | `ids` |
| `ihlaller` | `violations` |
| `iki` | `two` |
| `ikon` | `icon` |
| `ikram` | `catering` |
| `ile` | `with` |
| `ilerleme` | `progress` |
| `iletildi` | `delivered` |
| `imza` | `signature` |
| `imzalar` | `signatures` |
| `inceleme` | `review` |
| `indeks` | `index` |
| `indiriliyor` | `downloading` |
| `iptal` | `cancelled` |
| `iptaledildi` | `cancelled` |
| `isaretli` | `marked` |
| `isbirligi` | `collaboration` |
| `isim` | `name` |
| `islem` | `action` |
| `islemleri` | `actions` |
| `istenen` | `requested` |
| `iyi` | `good` |
| `izin` | `permission` |
| `izinler` | `permissions` |
| `izinli` | `permitted` |
| `izni` | `permission` |
| `kabul` | `accept` |
| `kacis` | `escape` |
| `kalan` | `remaining` |
| `kamuya` | `public` |
| `kapali` | `closed` |
| `kapasite` | `capacity` |
| `kaptan` | `captain` |
| `karar` | `decision` |
| `kararim` | `myDecision` |
| `kararlar` | `decisions` |
| `karsi` | `counterpart` |
| `kasa` | `vault` |
| `kasalar` | `vaults` |
| `kasas` | `vaults` |
| `kategori` | `category` |
| `katildi` | `joined` |
| `katilim` | `participation` |
| `katilimci` | `participant` |
| `katilinan` | `attended` |
| `katilma` | `join` |
| `kaydeden` | `recorder` |
| `kaydedildi` | `saved` |
| `kaydet` | `save` |
| `kaydim` | `myRecord` |
| `kayip` | `lost` |
| `kayit` | `record` |
| `kayitlar` | `records` |
| `kayitlari` | `records` |
| `kayitli` | `registered` |
| `kayitol` | `register` |
| `kayitsiz` | `unregistered` |
| `kaynak` | `source` |
| `kazanildi` | `earned` |
| `kilit` | `lock` |
| `kilitli` | `locked` |
| `kirli` | `dirty` |
| `kisa` | `short` |
| `kisi` | `person` |
| `kisiler` | `people` |
| `klasor` | `folder` |
| `kod` | `code` |
| `kodu` | `code` |
| `komut` | `command` |
| `kontenjan` | `capacity` |
| `konu` | `topic` |
| `konuid` | `topicId` |
| `konular` | `topics` |
| `konum` | `location` |
| `kopya` | `copy` |
| `kopyala` | `copy` |
| `kritik` | `critical` |
| `kullanici` | `user` |
| `kullaniciid` | `userId` |
| `kullanicilar` | `users` |
| `kullanim` | `usage` |
| `kullanma` | `usage` |
| `kulup` | `club` |
| `kurul` | `board` |
| `kurulum` | `setup` |
| `kurus` | `minor` |
| `lider` | `leader` |
| `liderler` | `leaders` |
| `limitler` | `limits` |
| `liste` | `list` |
| `madde` | `item` |
| `maddeler` | `items` |
| `malzeme` | `material` |
| `manuel` | `manual` |
| `mesaj` | `message` |
| `mesajlar` | `messages` |
| `metin` | `text` |
| `mevcut` | `current` |
| `mezun` | `graduate` |
| `mezunlar` | `graduates` |
| `neden` | `reason` |
| `nedenler` | `reasons` |
| `notu` | `note` |
| `oda` | `room` |
| `odaid` | `roomId` |
| `odalar` | `rooms` |
| `odenek` | `allowance` |
| `odunc` | `loan` |
| `oduncte` | `onLoan` |
| `ogrenci` | `student` |
| `ogrencino` | `studentNo` |
| `okundu` | `read` |
| `okunmadi` | `unread` |
| `okunmamis` | `unread` |
| `okunur` | `readable` |
| `okur` | `reader` |
| `okuyucu` | `reader` |
| `olc` | `measure` |
| `olu` | `dead` |
| `olustur` | `create` |
| `olusturan` | `creator` |
| `olusturanad` | `creatorName` |
| `olusturanid` | `creatorId` |
| `olusturma` | `creation` |
| `onay` | `approval` |
| `onayla` | `approve` |
| `onaylandi` | `approved` |
| `onbellegi` | `cache` |
| `onceki` | `previous` |
| `oncelik` | `priority` |
| `onemli` | `important` |
| `oneri` | `proposal` |
| `onizleme` | `preview` |
| `oran` | `ratio` |
| `orani` | `ratio` |
| `orta` | `medium` |
| `oturum` | `session` |
| `oturumbitis` | `sessionEnd` |
| `oy` | `vote` |
| `oylari` | `votes` |
| `ozel` | `custom` |
| `ozet` | `summary` |
| `ozeti` | `summary` |
| `parola` | `password` |
| `pencere` | `window` |
| `posta` | `mail` |
| `profil` | `profile` |
| `profilfoto` | `profilePhoto` |
| `proje` | `project` |
| `projeler` | `projects` |
| `puan` | `points` |
| `puani` | `score` |
| `rastgele` | `random` |
| `reddedildi` | `rejected` |
| `reddet` | `reject` |
| `rehberci` | `guide` |
| `renk` | `color` |
| `resim` | `image` |
| `resmi` | `official` |
| `rol` | `role` |
| `rolad` | `roleName` |
| `rolid` | `roleId` |
| `roller` | `roles` |
| `rolu` | `role` |
| `rozet` | `badge` |
| `rozetler` | `badges` |
| `sabitli` | `pinned` |
| `saglam` | `robust` |
| `sahte` | `fake` |
| `salon` | `hall` |
| `saniye` | `seconds` |
| `satir` | `row` |
| `satiri` | `row` |
| `satirlar` | `rows` |
| `sayfa` | `page` |
| `sayi` | `count` |
| `sayim` | `count` |
| `sayisi` | `count` |
| `sebep` | `reason` |
| `secenek` | `option` |
| `secenekler` | `options` |
| `secildi` | `selected` |
| `secili` | `selected` |
| `secim` | `selection` |
| `sekreter` | `secretary` |
| `seminer` | `seminar` |
| `seri` | `series` |
| `sertifika` | `certificate` |
| `sertifikalar` | `certificates` |
| `servis` | `service` |
| `seviye` | `level` |
| `sifirla` | `reset` |
| `sifre` | `password` |
| `sifrehash` | `passwordHash` |
| `sil` | `remove` |
| `silinen` | `deleted` |
| `silinme` | `deletion` |
| `simdi` | `now` |
| `sinif` | `grade` |
| `siniflar` | `grades` |
| `sinir` | `limit` |
| `sira` | `order` |
| `sirala` | `sort` |
| `siralama` | `ranking` |
| `sistem` | `system` |
| `son` | `last` |
| `sonaktifip` | `lastActiveIp` |
| `sonaktiftarihi` | `lastActiveDate` |
| `songecerlilik` | `lastValidity` |
| `songirisip` | `lastLoginIp` |
| `songiristarihi` | `lastLoginDate` |
| `songirisuseragent` | `lastLoginUserAgent` |
| `sonmesaj` | `lastMessage` |
| `sonraki` | `next` |
| `sonuc` | `result` |
| `sonuclar` | `results` |
| `sorgu` | `query` |
| `soru` | `question` |
| `soyad` | `surname` |
| `soyisim` | `surname` |
| `strateji` | `strategy` |
| `sunucu` | `server` |
| `sutun` | `column` |
| `tablo` | `table` |
| `tahsisi` | `allocation` |
| `takim` | `team` |
| `takimi` | `team` |
| `takimlar` | `teams` |
| `takip` | `follow` |
| `talep` | `request` |
| `tamam` | `done` |
| `tamamlanan` | `completed` |
| `tamamlandi` | `completed` |
| `tamamlanma` | `completion` |
| `tanim` | `definition` |
| `tanimlar` | `definitions` |
| `taraf` | `side` |
| `tarama` | `scan` |
| `tarih` | `date` |
| `tarihi` | `date` |
| `tarihler` | `dates` |
| `tasi` | `move` |
| `taslak` | `draft` |
| `tehdit` | `threat` |
| `tehditpuani` | `threatScore` |
| `teknoloji` | `technology` |
| `teknolojiler` | `technologies` |
| `tekrar` | `repeat` |
| `telefon` | `phone` |
| `telefonu` | `phone` |
| `temiz` | `clean` |
| `temizle` | `clear` |
| `temizleniyor` | `clearing` |
| `teslim` | `due` |
| `tip` | `type` |
| `toplam` | `total` |
| `toplamsayfa` | `totalPages` |
| `toplanti` | `meeting` |
| `toplantilar` | `meetings` |
| `totpsonadim` | `totpLastStep` |
| `tumu` | `all` |
| `tur` | `type` |
| `turu` | `type` |
| `tutar` | `amount` |
| `tuzak` | `trap` |
| `ulasilabilir` | `reachable` |
| `universite` | `university` |
| `unvan` | `rank` |
| `ust` | `top` |
| `uyari` | `warning` |
| `uye` | `member` |
| `uyeler` | `members` |
| `uyelik` | `membership` |
| `uygulama` | `app` |
| `uzat` | `extend` |
| `uzmanliklar` | `expertise` |
| `vardi` | `existed` |
| `varsayilan` | `default` |
| `varsayilandi` | `wasDefault` |
| `verenler` | `givers` |
| `verildi` | `given` |
| `verilen` | `given` |
| `verilis` | `issuance` |
| `yabanci` | `foreign` |
| `yaklasan` | `upcoming` |
| `yanit` | `reply` |
| `yanitlanan` | `replied` |
| `yanitlar` | `replies` |
| `yapilacak` | `todo` |
| `yapimci` | `producer` |
| `yardimci` | `helper` |
| `yarisma` | `competition` |
| `yasak` | `forbidden` |
| `yayin` | `publish` |
| `yayinda` | `published` |
| `yazar` | `author` |
| `yazdim` | `wrote` |
| `yazi` | `text` |
| `yeni` | `new` |
| `yesno` | `yesNo` |
| `yeterli` | `sufficient` |
| `yetki` | `permission` |
| `yetkili` | `authorized` |
| `yetkililer` | `authorized` |
| `yetkisi` | `permission` |
| `yildiz` | `star` |
| `yoklama` | `attendance` |
| `yoklamam` | `myAttendance` |
| `yol` | `path` |
| `yonetebilir` | `canManage` |
| `yonetici` | `admin` |
| `yonetim` | `management` |
| `yonlendirme` | `redirect` |
| `yontem` | `method` |
| `yorum` | `comment` |
| `yorumlar` | `comments` |
| `yuklenen` | `uploaded` |
| `yuklenme` | `upload` |
| `yukleyen` | `uploader` |
| `yuksek` | `high` |
| `yuzde` | `percent` |
| `zaman` | `time` |
| `zamani` | `time` |
| `zaten` | `already` |
| `zorunlu` | `required` |

## Stored values

| Old value | New value |
| --- | --- |
| `acik` | `open` |
| `acil` | `urgent` |
| `aktar` | `transfer` |
| `aktarim` | `transfer` |
| `aktif` | `active` |
| `anket` | `poll` |
| `arizali` | `faulty` |
| `arsiv` | `archived` |
| `arsivle` | `archive` |
| `askida` | `suspended` |
| `atandi` | `assigned` |
| `atolye` | `workshop` |
| `basladi` | `started` |
| `basvurdu` | `applied` |
| `beklemede` | `pending` |
| `bende` | `mine` |
| `bilet` | `ticket` |
| `bugun` | `today` |
| `bulunamadi` | `not_found` |
| `cop` | `trash` |
| `cope` | `trash` |
| `degisti` | `changed` |
| `dolu` | `full` |
| `dusuk` | `low` |
| `duzenle` | `edit` |
| `duzenlendi` | `edited` |
| `ekle` | `add` |
| `etkinlik_izni` | `event_permission` |
| `gecerli` | `valid` |
| `gecersiz` | `invalid` |
| `gecikmis` | `overdue` |
| `gecikti` | `overdue` |
| `gelen` | `inbox` |
| `gelene` | `restore` |
| `gelir` | `income` |
| `genel` | `general` |
| `gider` | `expense` |
| `gonderilen` | `sent` |
| `haber` | `news` |
| `hepsi` | `all` |
| `hesap` | `account` |
| `iade` | `return` |
| `ileri` | `next` |
| `inceleme` | `review` |
| `iptal` | `cancelled` |
| `isbirligi` | `collaboration` |
| `izleniyor` | `monitoring` |
| `kabul` | `accepted` |
| `kapali` | `closed` |
| `karar` | `resolution` |
| `kasa` | `vault` |
| `katilim-var` | `has_participation` |
| `kayip` | `lost` |
| `kayitli` | `registered` |
| `kilitli` | `locked` |
| `kisisel` | `personal` |
| `kod-var` | `code_exists` |
| `kritik` | `critical` |
| `kullan` | `use` |
| `kulup_active_wallpaper` | `club_active_wallpaper` |
| `kulup_adi` | `club_name` |
| `kulup_bilgileri` | `club_info` |
| `kulup_domain` | `club_domain` |
| `kulup_language` | `club_language` |
| `kulup_session_token` | `club_session_token` |
| `kulup_theme` | `club_theme` |
| `kulup_window_cycle` | `club_window_cycle` |
| `madde_eklendi` | `item_added` |
| `madde_tamamlandi` | `item_completed` |
| `malzeme_talep` | `material_request` |
| `manuel` | `manual` |
| `mezun` | `alumni` |
| `musait-degil` | `unavailable` |
| `oda_genel` | `room_general` |
| `odunc` | `loan` |
| `oduncte` | `on_loan` |
| `oduncte-degil` | `not_on_loan` |
| `oku` | `read` |
| `okundu` | `read` |
| `okunmadi` | `unread` |
| `okunmamis` | `unread` |
| `okur` | `reader` |
| `olusturuldu` | `created` |
| `onarimda` | `repairing` |
| `onayla` | `approve` |
| `onayli` | `approval` |
| `oneri` | `proposed` |
| `orta` | `medium` |
| `ozel` | `private` |
| `pasif` | `inactive` |
| `proje` | `project` |
| `reddedildi` | `rejected` |
| `reddet` | `reject` |
| `resmi` | `official` |
| `rol_admin` | `role_admin` |
| `rol_mezun` | `role_alumni` |
| `rol_uye` | `role_member` |
| `rol_yonetim_kurulu` | `role_management_board` |
| `role-yok` | `no_role` |
| `roller_raw` | `roles_raw` |
| `saglam` | `available` |
| `salon_tahsisi` | `hall_allocation` |
| `sari` | `yellow` |
| `seminer` | `seminar` |
| `sifre_sifirlama` | `password_reset` |
| `sil` | `delete` |
| `silindi` | `deleted` |
| `sistem` | `system` |
| `son-admin` | `last_admin` |
| `suresi-doldu` | `expired` |
| `suruyor` | `in_progress` |
| `takim` | `team` |
| `tamamlandi` | `done` |
| `tasindi` | `moved` |
| `taslak` | `draft` |
| `toplanti` | `meeting` |
| `tum` | `all` |
| `ust_yazi` | `cover_letter` |
| `uye` | `member` |
| `uyeler` | `members` |
| `uzat` | `extend` |
| `var` | `set` |
| `yakin` | `upcoming` |
| `yapilacak` | `todo` |
| `yarisma` | `competition` |
| `yayinda` | `published` |
| `yaz` | `write` |
| `yok` | `none` |
| `yonet` | `manage` |
| `yonetim` | `management` |
| `yorum` | `comment` |
| `yuksek` | `high` |
| `zaten` | `already` |

Budget categories are stored as slugs too: `İkram → catering`, `Afiş/Baskı → printing`,
`Sponsorluk → sponsorship`, `Donanım → hardware`, `Ulaşım → transport`, `Diğer → other`,
`Ödenek Aktarımı → allowance_transfer`. The UI shows them through `budgetCat_<slug>` translations.

## Deliberate exceptions

- The HKDF label `kulup-portal` in `src/lib/auth/serverSecret.ts` stays: changing it would
  re-key every secret encrypted at rest.
- Translation keys in `src/lib/i18n*.ts` (for example `kasaIncome`) are catalogue keys, not code
  identifiers; many are assembled at run time.
- Historic audit-log snapshots are not rewritten.
