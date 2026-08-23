/**
 * TEKNOFEST yarışma kategorileri.
 *
 * ⚠️ Kategori listesi ve terimler yarışmadan yarışmaya değişir; bunlar
 * Yarışma Yöneticisi tarafından arayüzden tanımlanacak. Buradaki tanımlar
 * motoru geliştirmek ve test etmek için başlangıç setidir.
 *
 * Terim seçiminde ağırlık vermeye gerek yok: IDF, birden çok kategoride
 * geçen terimleri (ör. "sensör", "yazılım") otomatik olarak değersizleştirir.
 */

import type { Kategori } from './kategori';

export const TARIM: Kategori = {
  kod: 'tarim',
  ad: 'Tarım Teknolojileri',
  terimler: [
    'tarım', 'tarla', 'ekin', 'hasat', 'yabancı ot', 'herbisit', 'çapalama',
    'sulama', 'toprak', 'gübre', 'pamuk', 'buğday', 'mısır', 'sera',
    'bitki', 'verim', 'dekar', 'traktör', 'zirai', 'tohum', 'ürün deseni',
    'bitki hastalığı', 'hasat sonrası', 'arıcılık', 'kovan',
  ],
};

export const SU: Kategori = {
  kod: 'su',
  ad: 'Su Kaynakları',
  terimler: [
    'su kaynağı', 'yeraltı suyu', 'baraj', 'arıtma', 'atık su', 'debi',
    'akifer', 'su kalitesi', 'damla sulama', 'su tasarrufu', 'havza',
    'kuraklık', 'nem', 'buharlaşma', 'su tüketimi', 'içme suyu',
  ],
};

export const YAZILIM: Kategori = {
  kod: 'yazilim',
  ad: 'Yazılım',
  terimler: [
    'web uygulaması', 'mobil uygulama', 'arayüz', 'veritabanı', 'api',
    'bulut', 'mikroservis', 'kullanıcı deneyimi', 'backend', 'frontend',
    'siber güvenlik', 'şifreleme', 'blokzincir', 'derin öğrenme',
    'doğal dil işleme', 'öneri sistemi',
  ],
};

export const ENERJI: Kategori = {
  kod: 'enerji',
  ad: 'Çevre ve Enerji',
  terimler: [
    'yenilenebilir enerji', 'güneş paneli', 'fotovoltaik', 'rüzgâr türbini',
    'batarya', 'karbon ayak izi', 'emisyon', 'geri dönüşüm', 'atık yönetimi',
    'enerji verimliliği', 'hidrojen', 'jeotermal', 'sera gazı',
  ],
};

export const ULASIM: Kategori = {
  kod: 'ulasim',
  ad: 'Akıllı Ulaşım',
  terimler: [
    'trafik', 'kavşak', 'otonom araç', 'sürücüsüz', 'toplu taşıma',
    'rota optimizasyonu', 'araç takip', 'plaka tanıma', 'kaza önleme',
    'şerit takibi', 'lojistik', 'filo yönetimi',
  ],
};

export const SAGLIK: Kategori = {
  kod: 'saglik',
  ad: 'Sağlık Teknolojileri',
  terimler: [
    'hasta', 'teşhis', 'tanı', 'tıbbi görüntüleme', 'radyoloji', 'protez',
    'biyomedikal', 'klinik', 'ilaç', 'hastane', 'ameliyat', 'rehabilitasyon',
    'tele-tıp', 'giyilebilir sağlık',
  ],
};

export const KATEGORILER: Kategori[] = [TARIM, SU, YAZILIM, ENERJI, ULASIM, SAGLIK];
