/**
 *  Функции преобразования строк и слов
 *
 * @module grammar
 */

const util = require('util');

const hut = require('./utils');

exports.getKeyWords = getKeyWords;
exports.getWordArray = getWordArray;
exports.getActVerb = getActVerb;
exports.getActResultVerb = getActResultVerb;
exports.getVerbEnding = getVerbEnding;
exports.cutEnding = cutEnding;
exports.cutInfinitiveEnding = cutInfinitiveEnding;

const consonants = 'бвгджзклмнпрстфхцчшщ';

const excludedWords = { en: ['a', 'the', 'in', 'with'], ru: ['в', 'на', 'под', 'над', 'с', 'за', 'у', 'перед'] };

const digits = {
  en: {
    '1': ['first', 'one'],
    '2': ['second', 'two'],
    '3': ['third', 'three'],
    '4': ['four', 'fourth'],
    '5': ['fifth', 'five']
  },
  ru: {
    '1': ['перв', 'один'],
    '2': ['второ', 'два'],
    '3': ['трет', 'три'],
    '4': ['четверт', 'четыре'],
    '5': ['пят', 'пять'],
    '6': ['шесто', 'шесть'],
    '7': ['седьмо', 'семь'],
    '8': ['восьмо', 'восемь'],
    '9': ['девят'],
    '10': ['десят'],
    '11': ['одиннацат'],
    '12': ['двенадцат']
  }
};

const actVerb = {
  en: {
    on: 'turn on',
    off: 'turn off'
  },
  ru: {
    on: 'включ',
    off: 'выключ'
  }
};

const actResultVerb = {
  en: {
    on: 'is on',
    off: 'is off'
  },
  ru: {
    on: 'включен',
    off: 'выключен'
  }
};

/**
 * Получение наборов ключевых слов
 *	@param {String} str - исходная строка
 *	@param {String} lang - язык
 *	@param {String} opt - какие применять преобразования: 
           F - беглые гласные исключать, V - обрабатывать окончания глаголов
 *  @return {Array} Массив вариантов наборов ключевых слов
 *
 * Убрать все что в скобках (начиная со скобки - круглой или квадратной)  1 санузел на веранде: (М) и тд => 1 санузел:
 * Заменить небуквенные символы на пробел '1 санузел на веранде:' => '1 санузел  на веранде'
 * Преобразовать в массив ['1', 'санузел', 'на', 'веранде']
 * Убрать предлоги, артикли ['1', 'санузел', 'веранде']
 * Обрезать окончания, заменить цифры на слова
 *    в результате может получиться более одного набора ключевых слов - здесь 4
 * В результате получится массив строк: ['перв санузел веранд', 'один санузел веранд', 'перв санузл веранд', 'один санузл веранд']
 **/
function getKeyWords(str, lang, opt) {
  str = removeAllAfterBrackets(str);
  str = rusTroubles(str, lang); 
  let arr = str
    .replace(/[№#_/,/./:/;]/g, ' ')
    .toLowerCase()
    .split(/\s+/);

  arr = exclude(arr, lang);

  let permutations = 0;
  arr.forEach((item, idx) => {
    if (isDigit(item)) {
      arr[idx] = getDigitInWords(item, lang);
      permutations = 1;
    } else if (opt && opt.includes('F') && isFluentVowels(item, lang)) {
      arr[idx] = getFluentVowelsVariants(item, lang);
      permutations = 1;
    } else if (opt && opt.includes('V') && isInfinitive(item, lang)) {
      arr[idx] = cutInfinitiveEnding(item, lang);
    } else {
      arr[idx] = cutEnding(item, lang);
    }
  });

  return permutations ? hut.getPermutation(makeNestedArrays(arr)) : [arr.join(' ')];
}

/** Формировать массив слов из входящей строки
 *
 *	@param {String} str - исходная строка
 *	@param {String} lang - язык
 *  @return {Array} Массив слов
 *
 *    Перевести в нижний регистр, заменить ё на е, разбить по пробелам
 *    Числа перевести в слова. Окончания здесь не трогаем
 */
function getWordArray(str, lang) {
  if (!str || typeof str != 'string') return;
  
  str = rusTroubles(str, lang); 
  let arr = str.toLowerCase().split(/\s+/);

  arr = exclude(arr, lang);

  arr.forEach((item, idx) => {
    if (isDigit(item)) {
      arr[idx] = getDigitInWords(item, lang);
    }
  });

  return arr;
}

function rusTroubles(str, lang) {
  if (lang != 'ru') return str;
  return str.replace(/[ё]/g, 'е')
}

function removeAllAfterBrackets(str) {
  let j = str.search(/[/(/[/{]/);
  return j > 0 ? str.substr(0, j) : str;
}

function makeNestedArrays(arr) {
  return arr.map(item => (Array.isArray(item) ? item : [item]));
}

// Анализ беглых гласных в окончаниях для русского языка
// санузел => в санузле
// Гласная при склонении может выпадать, если слово заканчивается на согласную, а перед ней гласные еио
function isFluentVowels(str, lang) {
  if (lang != 'ru' || str.length < 4) return;

  if (consonants.includes(str.substr(-1))) {
    return 'еио'.includes(str.substr(-2, 1));
  }
}

// Возвращается ['санузел', 'санузл']
function getFluentVowelsVariants(str, lang) {
  if (!isFluentVowels(str, lang)) return str;

  let str1 = str.substr(0, str.length - 2) + str.substr(-1);
  return [str, str1];
}

function isDigit(str) {
  return !isNaN(str);
}

function getDigitInWords(str, lang) {
  return digits[lang] && digits[lang][str] ? digits[lang][str] : '';
}

function exclude(arr, lang) {
  return !excludedWords[lang] ? arr : arr.filter(word => !excludedWords[lang].includes(word));
}

function cutEnding(word, lang) {
  switch (lang) {
    case 'ru':
      return cutRusEnding(word);

    case 'en':
      return word.substr(-1) == 's' ? word.substr(0, word.length - 1) : word;
    default:
      return word;
  }
}

function cutRusEnding(word) {
  if (word.length <= 3) return word;

  // Убрать последние гласные
  const vowels = ['а', 'я', 'е', 'о','у','ю','и', 'ы', 'й', 'ь'];
  let res = word;
  while (res.length > 2) {
    if (vowels.includes(res.substr(-1))) {
      res = res.substr(0, res.length - 1);
    } else break;
  }
  return res;
}

function isInfinitive(word) {
  if (word.length <= 3) return;

  // Убрать последние гласные
  const ends = ['ить', 'ыть', 'ать'];
  return (ends.includes(word.substr(-3)));
}

function cutInfinitiveEnding(word) {
  return  isInfinitive(word) ? word.substr(0, word.length - 3) : word;
}

function getActVerb(act, lang) {
  return actVerb[lang] && actVerb[lang][act] ? actVerb[lang][act] : '';
}

function getActResultVerb(act, lang, objname) {
  const ending = objname ? getVerbEnding(objname, lang): '';
  return actResultVerb[lang] && actResultVerb[lang][act] ? actResultVerb[lang][act]+ending : '';
}

function getVerbEnding(str, lang) {
  if (lang != 'ru') return '';

  const sarr = str.split(/\s+/);
  if (!sarr || !sarr.length || !sarr[0] || sarr[0].length <= 3) return '';

  const last = sarr[0].substr(-1);
  if (last == 'ы' || last == 'и' || sarr[0].substr(-2, 2) == 'ые') return 'ы';

  return 'ая'.includes(last) ? 'а' : '';
}
