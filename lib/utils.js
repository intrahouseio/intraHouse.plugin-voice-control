const util = require('util');
const path = require('path');
const fs = require('fs');

exports.byorder = byorder;
exports.testKeyWords = testKeyWords; // !
exports.testKeyWords2 = testKeyWords2; // !
exports.compareKeyWords = compareKeyWords;

exports.isDnAction = isDnAction;
exports.getDnFromAction = getDnFromAction;
exports.weakEq = weakEq;
exports.weakInclude = weakInclude;

exports.getPermutation = getPermutation;
exports.capitalize = capitalize;
exports.removeKeyWords = removeKeyWords;
exports.readJsonFileSync = readJsonFileSync;
exports.getLocaleFile = getLocaleFile;

/** Возвращает true - если str содержит все слова (начала слов) из keystr **/
function testKeyWords(keystr, str) {
  if (!keystr || !str) {
    return false;
  }

  var keyarr = keystr.split(/\s/);
  var sarr = str.split(/\s/);
  let i;
  let j;
  let keyw;

  if (!keyarr.length || !sarr.length) {
    return false;
  }

  for (i = 0; i < keyarr.length; i++) keyarr[i] = keyarr[i].toLowerCase();
  for (i = 0; i < sarr.length; i++) sarr[i] = sarr[i].toLowerCase();

  // Все слова д.б. разные!! Light one on == Light one

  for (i = 0; i < keyarr.length; i++) {
    keyw = keyarr[i];

    j = 0;
    // Сначала проверяем полное совпадение
    while (j < sarr.length && sarr[j] != keyw) {
      j++;
    }

    if (j >= sarr.length) {
      // Если полного совпадения нет - то частичное: indexOf==0 - нач. с keyw->OK
      j = 0;
      while (j < sarr.length && sarr[j].indexOf(keyw) != 0) {
        j++;
      }
    }

    if (j >= sarr.length) {
      //i-тое кл. поле не нашли - неудача
      return false;
    }
    sarr.splice(j, 1);
    // Нашли - удаляем его
  }

  return true;
}

/** Проверка, что ключевые слова в строках не совпадают
 *
 *   @return {Number}: -1 - ошибка при разборе строк, 0-совпадают, >1 - отличаются
 **/
function compareKeyWords(keystr, str) {
  if (!keystr || !str) return -1;

  var keyarr = keystr.split(/\s+/);
  var sarr = str.split(/\s+/);
  let i;
  let j;
  let keyw;

  if (!keyarr.length || !sarr.length) return -1;

  for (i = 0; i < keyarr.length; i++) keyarr[i] = keyarr[i].toLowerCase();
  for (i = 0; i < sarr.length; i++) sarr[i] = sarr[i].toLowerCase();

  // Все слова д.б. разные!! Light one on == Light one

  for (i = 0; i < keyarr.length; i++) {
    keyw = keyarr[i];

    j = 0;
    // Сначала проверяем полное совпадение
    while (j < sarr.length && sarr[j] != keyw) {
      j++;
    }

    // Частичное не проверяем, т к сравниваем обработанные ключевые слова
    /*
    if (j >= sarr.length) {
      // Если полного совпадения нет - то частичное: indexOf==0 - нач. с keyw->OK
      j = 0;
      while (j < sarr.length && sarr[j].indexOf(keyw) != 0) {
        j++;
      }
    }
    */

    if (j >= sarr.length) {
      //i-тое кл. поле не нашли - значит, отличаются
      return 1;
    }
    sarr.splice(j, 1);
    // Нашли - удаляем его
  }

  return sarr.length; // если остались слова не совп - то > 1
}

/** Сравнение входящей строки с ключевыми словами
 *
 *   Входящий массив и строка переведены в нижний регистр,
 *
 *   @param {Array} keyarr - массив ключевых слов
 *   @param {String} str - входящая строка
 *   @param {Number} diffsuffixlen - на сколько символов допустимо отклонение окончания
 *
 *   @return true - если str содержит все слова (начала слов) из keyarr
 **/
function testKeyWords2(keyarr, str, diffsuffixlen) {
  let sarr;
  let j;
  let keyw;

  if (!keyarr || !str || typeof str != 'string') return;

  sarr = str.split(/\s+/);

  if (!keyarr.length || !sarr.length) return;

  // Все слова д.б. разные!! Light one on == Light one

  for (var i = 0; i < keyarr.length; i++) {
    keyw = keyarr[i];

    j = 0;

    // Сначала проверяем полное совпадение
    while (j < sarr.length && sarr[j] != keyw) {
      j++;
    }

    if (j >= sarr.length && diffsuffixlen) {
      // Если полного совпадения нет - то частичное: indexOf==0 - нач. с keyw->OK
      j = 0;
      while (j < sarr.length && sarr[j].indexOf(keyw) != 0) {
        j++;
      }
    }

    if (j >= sarr.length || (diffsuffixlen && sarr[j].length - keyw.length > diffsuffixlen)) {
      // if (j >= sarr.length) {
      //i-тое кл. поле не нашли - неудача
      return false;
    }
    sarr.splice(j, 1);
    // Нашли - удаляем его
  }

  return true;
}

/** Удалить из входящей строки ключевые слова
 *
 *   Входящий массив и строка переведены в нижний регистр,
 *
 *   @param {Array} keyarr - массив ключевых слов
 *   @param {String} sarr - массив  входящая строка
 *   @param {Number} diffsuffixlen - на сколько символов допустимо отклонение окончания
 *
 *   @return true - если str содержит все слова (начала слов) из keyarr
 **/
function removeKeyWords(keyarr, sarr, diffsuffixlen) {
  if (!keyarr || !sarr) return;

  for (var i = 0; i < keyarr.length; i++) {
    const keyw = keyarr[i];

    let j = 0;
    while (j < sarr.length && sarr[j].indexOf(keyw) != 0) {
      j++;
    }

    if (j < sarr.length && sarr[j].length - keyw.length <= diffsuffixlen) {
      sarr.splice(j, 1);
    }
  }

  return sarr;
}

function weakEq(word, keyword, difflen) {
  const maxlen = word.length > keyword.length ? word.length : keyword.length;
  const len = maxlen - difflen > 2 ? maxlen - difflen : 2;

  return word.substr(0, len) == keyword.substr(0, len);
}

function weakInclude(text, word, difflen) {
  const len = word.length - difflen > 2 ? word.length - difflen : 2;

  const keyword = ' ' + word.substr(0, len);
  return text.indexOf(keyword) >= 0;
}

/** Функция сортировки используется в качестве вызываемой функции для сортировки массива ОБЪЕКТОВ
	arr.sort(hut.byorder('place,room','D')
*   	ordernames - имена полей для сортировки через запятую 	
*       direction: D-descending 
*  
*   	Возвращает функцию сравнения
**/
function byorder(ordernames, direction, parsingInt) {
  var arrForSort = [];
  var dirflag = direction == 'D' ? -1 : 1; //ascending = 1, descending = -1;

  if (ordernames && typeof ordernames == 'string') {
    arrForSort = ordernames.split(',');
  }

  return function(o, p) {
    if (typeof o != 'object' || typeof p != 'object') {
      return 0;
    }
    if (arrForSort.length == 0) {
      return 0;
    }
    for (var i = 0; i < arrForSort.length; i++) {
      let a;
      let b;
      let name = arrForSort[i];

      a = o[name];
      b = p[name];
      if (a != b) {
        if (parsingInt) {
          let astr = String(a);
          let bstr = String(b);
          if (!isNaN(parseInt(astr, 10)) && !isNaN(parseInt(bstr, 10))) {
            return parseInt(astr, 10) < parseInt(bstr, 10) ? -1 * dirflag : 1 * dirflag;
          }
        }
        // сравним как числа
        if (!isNaN(Number(a)) && !isNaN(Number(b))) {
          return Number(a) < Number(b) ? -1 * dirflag : 1 * dirflag;
        }

        // одинаковый тип, не числа
        if (typeof a === typeof b) {
          return a < b ? -1 * dirflag : 1 * dirflag;
        }

        return typeof a < typeof b ? -1 * dirflag : 1 * dirflag;
      }
    }
    return 0;
  };
}

/**
 *  Проверка, что входная строка - это команда типа LAMP1.on(off, set) или REGIM:2
 *  Возвращает true или false
 **/
function isDnAction(scen) {
  var sarr = splitDnAction(scen);

  return !!sarr;
}

function getDnFromAction(scen) {
  var sarr = splitDnAction(scen);
  return sarr ? allTrim(sarr[0]) : '';
}

/*
  function getActFromAction( scen) {
  var sarr = splitDnAction( scen );
    return ( sarr ) ? allTrim(sarr[1]) : '';
  }
  */

function splitDnAction(scen) {
  let sarr;
  let delim;

  if (typeof scen != 'string' || scen.length < 4) return;

  delim = scen.indexOf('.') > 0 ? '.' : ':';

  sarr = scen.split(delim);
  return sarr && sarr.length == 2 ? sarr : '';
}

/** Удаление space-символов (пробел, табуляция, новая строка) в начале и конце строки
 *  @memberof ihutils.string
 **/
function allTrim(str) {
  //   [\s] -  то же что и [\n\t\r\f]
  if (str && typeof str == 'string') {
    return str.replace(/^\s+/, '').replace(/\s+$/, '');
  }
  return '';
}

function getPermutation(array, prefix) {
  prefix = prefix || '';
  if (!array.length) {
    return prefix;
  }

  return array[0].reduce((result, value) => result.concat(getPermutation(array.slice(1), prefix + value + ' ')), []);
  // return result;
}

function capitalize(str) {
  if (typeof str != 'string') return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function readJsonFileSync(filename, nothrow) {
  try {
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
  } catch (e) {
    if (!nothrow) throw { message: 'readJsonFileSync:' + filename + '. ' + util.inspect(e) };
    console.log('WARN: Reading ' + filename + '. ' + e.message);
    return {};
  }
}

function getLocaleFile(lang) {
  return path.join(__dirname, '../locale/' + lang + '.json');
}
