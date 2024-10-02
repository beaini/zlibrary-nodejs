// src/const.js

const Extension = Object.freeze({
  TXT: "TXT",
  PDF: "PDF",
  FB2: "FB2",
  EPUB: "EPUB",
  LIT: "LIT",
  MOBI: "MOBI",
  RTF: "RTF",
  DJV: "DJV",
  DJVU: "DJVU",
  AZW: "AZW",
  AZW3: "AZW3",
});

const OrderOptions = Object.freeze({
  POPULAR: "popular",
  NEWEST: "date_created",
  RECENT: "date_updated",
});

const Language = Object.freeze({
  ARABIC: "arabic",
  ARMENIAN: "armenian",
  AZERBAIJANI: "azerbaijani",
  BENGALI: "bengali",
  CHINESE: "chinese",
  DUTCH: "dutch",
  ENGLISH: "english",
  FRENCH: "french",
  GEORGIAN: "georgian",
  GERMAN: "german",
  GREEK: "greek",
  HINDI: "hindi",
  INDONESIAN: "indonesian",
  ITALIAN: "italian",
  JAPANESE: "japanese",
  KOREAN: "korean",
  MALAYSIAN: "malaysian",
  PASHTO: "pashto",
  POLISH: "polish",
  PORTUGUESE: "portuguese",
  RUSSIAN: "russian",
  SERBIAN: "serbian",
  SPANISH: "spanish",
  TELUGU: "telugu",
  THAI: "thai",
  TURKISH: "turkish",
  UKRAINIAN: "ukrainian",
  URDU: "urdu",
  VIETNAMESE: "vietnamese",
  // ... (Include all other languages as per your Python code)
});

module.exports = {
  Extension,
  OrderOptions,
  Language,
};
