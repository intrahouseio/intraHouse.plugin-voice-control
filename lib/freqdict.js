/**
 * Частотный словарь
 *  -
 */

module.exports = Fdict;

/**
 *  @constructor
 **/
function Fdict() {
  if (!(this instanceof Fdict)) return new Fdict();
  this.dict = {};
}

/** Добавить слова в частотный словарь
 *
 *	@param {Array || string} words - массив или строка ключевых слов
 */
Fdict.prototype.add = function(words) {
  const warr = (typeof words == 'string') ? words.split(/\s+/) : words;
  if (!warr || !warr.length) return;

  warr.forEach(word => {
    if (word) {
      if (!this.dict[word]) this.dict[word] = 0;
      this.dict[word] += 1;
    }
  });
};

/** Удалить слова из частотного словаря
 *
 *	@param {Array} warr - массив ключевых слов
 */
Fdict.prototype.delete = function(warr) {
  if (!warr || !warr.length) return;

  warr.forEach(word => {
    if (word && this.dict[word] > 0) {
      this.dict[word] -= 1;
    }
  });
};

/** Возвращает индекс элемента массива с минимальным значением частоты (самое редкое слово в массиве)
 *
 *	@param {Array} warr - массив ключевых слов
 *	@return {Number} - индекс элемента массива с минимальным значением частоты 
 */
Fdict.prototype.minDictRate = function(warr) {
  if (!warr || !warr.length) return -1;

  let minindex = 0;
  let minvalue = 9999;

  warr.forEach((word, idx) => {
    if (word && this.dict[word]) {
      if (minvalue > this.dict[word]) {
        minvalue = this.dict[word];
        minindex = idx;
      }
    }
  });

  return minindex;
};

/** Сформировать массив ключевых слов по возрастанию частоты использования
 *	@param {Array} warr - массив ключевых слов
 *	@return {Array} - входной массив переупорядоченный по частоте
 */
Fdict.prototype.sortByFreq = function(warr) {
  if (!warr || !warr.length) return [];

  const rarr = [];
  // на каждом этапе ищем слово с наименьшим весом
  while (warr.length > 0) {
    let j = this.minDictRate(warr);
    rarr.push(warr[j]);
    warr.splice(j, 1);
  }
  return rarr;
}

/*
function addToDict(warr) {

  if (!warr || !warr.length) return;

  for (var i = 0; i < warr.length; i++) {
    if (!warr[i]) continue;

    word = warr[i];
    if (dict[word]) {
      dict[word] += 1;
    } else {
      dict[word] = 1;
    }
  }
}
*/

/** Удалить слова из частотного словаря
 */
/*
function delFromDict(warr) {
  var word;

  for (var i = 0; i < warr.length; i++) {
    if (!warr[i]) continue;

    word = warr[i];
    if (dict[word] > 0) {
      dict[word] -= 1;
    }
  }
}
*/
