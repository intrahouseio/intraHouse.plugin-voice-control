/**
 * Объект для управления набором voice/sms команд (добавление, удаление, поиск).
 *    Команда содержит ключевые слова для выполнения действия устройства или вызова сценария.
 *    Запись-чтение файла smscommand.json здесь не выполняется.
 *
 * @module vosmscmd
 */

var util = require('util');

var hut = require('./utils');

const exclude = { en: ['a', 'the', 'in', 'with' ], ru: [ 'в', 'на', 'под', 'над', 'с' ] };

let vosmsCommand;
let dict;
let defaultLang;
var digits = {
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
  '10': 'ten',
  '11': 'eleven',
  '12': 'twelve',
  '13': 'thirteen',
  '14': 'fourteen',
  '15': 'fifteen',
  '16': 'sixteen',
  '17': 'seventeen',
  '18': 'eighteen',
  '19': 'nineteen',
  '20': 'twenty'
};

module.exports = Vosmscmd;

/** Создать пустой словарь и набор команд. Загрузить команды из входного массива
 *  @constructor
 **/
function Vosmscmd() {
  if (!(this instanceof Vosmscmd)) return new Vosmscmd();
  vosmsCommand = [];
  dict = {};
  defaultLang = 'ru';
}

Vosmscmd.prototype.setLang = function(lang) {
  defaultLang = lang;
};

Vosmscmd.prototype.getVosmsCommandLen = function() {
  return vosmsCommand.length;
};

/*
Vosmscmd.prototype.setCommands = function(sarr, defLang) {
  defaultLang = defLang;
  if (sarr && util.isArray(sarr)) {
    this.add(sarr);
  }
  console.log('vosmsCommand '+util.inspect(vosmsCommand));
};
*/

/**
 *  Возвращает ключевые слова для сценария
 *  	@param {String} scen - id сценария или строка действия (LAMP1.on)
 *   @return {String} Ключевые слова для сценария или действия
 **/
Vosmscmd.prototype.getKeyWords = function(scen) {
  for (var i = 0; i < vosmsCommand.length; i++) {
    if (vosmsCommand[i].scen == scen) {
      return vosmsCommand[i].keywords;
    }
  }
};

/**
 *  Возвращает список ключевых слов и ответы в виде строки
 **/
Vosmscmd.prototype.list = function() {
  var result = '';

  for (var i = 0; i < vosmsCommand.length; i++) {
    result =
      result +
      vosmsCommand[i].firstword +
      ' -->  ' +
      vosmsCommand[i].keywords +
      '<br> Action:' +
      vosmsCommand[i].scen +
      ' DEF=' +
      vosmsCommand[i].def +
      '<br> Reply:' +
      vosmsCommand[i].reply +
      '<br>';
  }
  return result;
};

/**
 *   Поиск команды по ключевым словам, содержащимся в строке
 *	  Ищем во входной строке вхождение первого (самого редкого) слова каждой команды
 * 	  Если не нашли - идем дальше, пропускаем команды с таким же первым ключевым словом
 *     Если нашли - проверяем все ключевые слова команды, начиная со второго
 *     Если найдены все ключевые слова - запоминаем индекс найденной команды в массив found, проходим весь массив
 *     Ищем среди совпавших команду с максимальным количеством ключевых слов
 *
 *  	@param {String} text - принятая команда (ключевые слова без пароля, может содержать лишние слова)
 *   @return {Object} {scen: ид сценария или действие, reply:текст ответа, index:индекс }
 **/
Vosmscmd.prototype.getActionAndAnswer = function(text) {
  let skipword;
  let found = [];
  let index;
  let maxwords;
  let warr;

  if (!text || typeof text != 'string') return;

  // Для замены чисел на слова нужно преобразовать в массив
  warr = getWordArray(text);
  text = ' ' + warr.join(' ');
  skipword = '';

  for (let i = 0; i < vosmsCommand.length; i++) {
    if (!vosmsCommand[i].scen) continue;

    if (skipword && vosmsCommand[i].firstword == skipword) continue;

    skipword = '';
    if (text.indexOf(' ' + vosmsCommand[i].firstword) < 0) {
      skipword = vosmsCommand[i].firstword;
      continue;
    }

    if (hut.testKeyWords2(vosmsCommand[i].arrwords, text, defaultLang == 'ru' ? 5 : 1)) {
      found.push(i);
    }
  }

  // Ничего не нашли
  if (found.length <= 0) return;

  index = found[0];

  // Нашли несколько - берем с мах кол-вом слов
  if (found.length > 1) {
    maxwords = vosmsCommand[index].arrwords.length;
    for (var i = 1; i < found.length; i++) {
      console.log('FOUND '+vosmsCommand[i].arrwords)
      if (vosmsCommand[i].arrwords.length > maxwords) {
        index = found[i];
        maxwords = vosmsCommand[index].arrwords.length;
      }
    }
  }

  if (vosmsCommand[index]) {
    return { scen: vosmsCommand[index].scen, reply: vosmsCommand[index].reply, index, num: vosmsCommand[index].num };
  }
};

Vosmscmd.prototype.addFirst = function(sarr) {
  const res = [];
  sarr.forEach(dev => {
    const placement = dev.zoneName || dev.placeName;
    res.push({
      scen: dev.dn + '.on',
      keywords: 'вкл ' + dev.name + ' ' + placement,
      reply: placement + ' ' + dev.name + ' включен'
    });
    res.push({
      scen: dev.dn + '.off',
      keywords: 'выкл ' + dev.name + ' ' + placement,
      reply: placement + ' ' + dev.name + ' выключен'
    });
  });
  console.log('')
  return this.add(res);
};

/**  Добавить команды в массив vosmsCommand с проверкой уникальности добавляемых ключевых слов.
*     	Ключевые слова каждого включаемого элемента разложить в массив, упорядоченный по возрастанию частоты использования 
*       Если это действие - выделить dn

*     @param {Array} sarr - массив объектов - команд. Свойства команды:
*         @property {string} scen - ид-р сценария или строка-действие
*         @property {string} keywords - ключевые слова через пробел
*         @property {string} reply   - текст ответа
*         @property {string} num      - ид-р записи в файле smscommand
*         @property {string} def      - флаг: 1- это default команда и записи в файле нет

*     @return  {Array} rarr - массив не включенных (не уникальных) объектов. Добавлено свойство dupscen - c чем найдено пересечение.
*              Пустой массив означает, что все объекты включены. 
*              Неопределенное значение - ошибка при выполнении  
*/
Vosmscmd.prototype.add = function(sarr) {
  let rarr = [];

  if (!sarr || !util.isArray(sarr)) {
    return;
  }

  // Проверить уникальность добавляемых ключевых слов
  // Не уникальные помечать dupscen, затем переписать в rarr
  for (let i = 0; i < sarr.length; i++) {
    if (!sarr[i].scen) continue;

    //   1. Во входящем массиве. Сравниваем с пройденными
    for (let j = 0; j < i; j++) {
      if (hut.compareKeyWords(sarr[i].keywords, sarr[j].keywords) <= 0) {
        sarr[i].dupscen = sarr[j].scen;
        break;
      }
    }

    //   2. В vosmsCommand
    if (!sarr[i].dupscen) {
      for (var j = 0; j < vosmsCommand.length; j++) {
        if (hut.compareKeyWords(sarr[i].keywords, vosmsCommand[j].keywords) <= 0) {
          sarr[i].dupscen = vosmsCommand[j].scen;
          break;
        }
      }
    }
  }

  // Удалить не уникальные или с пустым действием. Не уникальные переписать в rarr для возврата
  for (let i = sarr.length - 1; i >= 0; i--) {
    if (sarr[i].scen && sarr[i].keywords && !sarr[i].dupscen) continue;

    if (sarr[i].dupscen) {
      rarr.push(sarr[i]);
    }
    sarr.splice(i, 1);
  }

  if (sarr.length) {
    // 1 проход - добавить слова в словарь частоты использования ключевых слов
    for (let i = 0; i < sarr.length; i++) {
      addToDict(sarr[i].keywords);
    }

    // 2 проход - добавить в массив команд vosmsCommand
    // В каждую запись включить массив arrwords ключевых слов, упорядоченный в нужном порядке
    for (let i = 0; i < sarr.length; i++) {
      addToCommand(sarr[i]);
    }

    // Сортировать массив по первому ключевому слову
    vosmsCommand.sort(hut.byorder('firstword', 'A'));
  }

  // Вывести не уникальные ключевые слова на консоль - параметризовать?
  // Будут проверяться все команды (в т.ч. из smscommand тоже)
  if (rarr.length > 0) {
    for (var i = 0; i < rarr.length; i++) {
      //console.log('Voice/sms keywords "'+rarr[i].keywords+ '" skipped for action '+ rarr[i].scen+ '. Origin action '+rarr[i].dupscen);
    }
  }

  return rarr;
};

Vosmscmd.prototype.addOne = function(sobj) {
  // Объект есть, дублирования нет - добавляем
  if (!sobj && !sobj.keywords) {
    return;
  }

  if (this.findIdentKeyWords(sobj.keywords)) {
    throw { name: 'errname', message: 'KEYWORDDUPLICATION' };
  }

  addToDict(sobj.keywords);
  addToCommand(sobj);
  // Сортировать массив по первому ключевому слову
  // TODO - можно рассмотреть вариант insert
  vosmsCommand.sort(hut.byorder('firstword', 'A'));
  return true;
};

/** Редактирование vosmsCommand при редактировании smscommand **/
Vosmscmd.prototype.edit = function(fun, sobj) {
  if (!fun) {
    console.log('Vosmscmd.edit error: Undefined fun for ' + util.inspect(sobj));
    return;
  }

  if (fun != 'add') {
    // edit, del - delete
    if (!sobj.num) {
      console.log('Vosmscmd.edit error: Undefined num for ' + util.inspect(sobj));
      return;
    }
    this.delCommands({ num: sobj.num });
  }

  if (fun != 'del') {
    // edit, add -> add
    delete sobj.fun;
    this.addOne(sobj);
  }
};

/** Удалить команды по различным критериям
* 	@param {Object}  - opt - содержит поля-фильтры для удаления
* 		@property {string}  - num - ид-р записи для удаления (номер в файле smscommand, для def - совп. со scen 
* 		@property {string}  - scen - ид-р сценария или действие 
* 		@property {string}  - dn  - удалить команды для устр-ва dn, если задано def:1 - только default команды 
* 		@property {string}  - def  - удалить default команды, если dn не задан - default для всех устройств

* 	@return {Number} - возвращает количество удаленных записей
*/
Vosmscmd.prototype.delCommands = function(opt) {
  var result = 0;

  for (var i = vosmsCommand.length - 1; i >= 0; i--) {
    if (
      (opt.num && vosmsCommand[i].num == opt.num) ||
      (opt.scen && vosmsCommand[i].scen == opt.scen) ||
      (opt.dn && !opt.def && vosmsCommand[i].dn == opt.dn) ||
      (opt.dn && opt.def && vosmsCommand[i].dn == opt.dn && vosmsCommand[i].def)
    ) {
      // Удалить из словаря
      delFromDict(vosmsCommand[i].arrwords);

      // Удалить из массива команд
      vosmsCommand.splice(i, 1);
      result++;
    }
  }
  return result;
};

/** Возвращает в callback все команды -действия для одного или всех устройств
 */
Vosmscmd.prototype.findDnActions = function(onedn, callback) {
  for (var i = 0; i < vosmsCommand.length; i++) {
    if (vosmsCommand[i].dn && (!onedn || vosmsCommand[i].dn == onedn)) {
      if (callback) callback('ACTION', vosmsCommand[i], vosmsCommand[i].scen);
    }
  }
};

/** Возвращает в callback все команды для выбранного сценария
 */
Vosmscmd.prototype.findForScen = function(scen, callback) {
  for (var i = 0; i < vosmsCommand.length; i++) {
    if (vosmsCommand[i].scen && vosmsCommand[i].scen == scen) {
      if (callback) callback('SCENE', vosmsCommand[i], vosmsCommand[i].scen);
    }
  }
};

Vosmscmd.prototype.findIdentKeyWords = function(keywords) {
  for (var j = 0; j < vosmsCommand.length; j++) {
    if (hut.compareKeyWords(keywords, vosmsCommand[j].keywords) <= 0) {
      return { scen: vosmsCommand[j].scen, keywords: vosmsCommand[j].keywords, index: j, num: vosmsCommand[j].num };
    }
  }
};

/**********************   Частные функции модуля   **********************************/

/** Формировать массив ключевых слов из строки
 *    Перевести в нижний регистр, разбить по пробелам
 *    Числа перевести в слова
 */
function getWordArray(keywordstr) {
  let warr;
  if (keywordstr && typeof keywordstr == 'string') {
    warr = keywordstr
      .replace(/[#_()/,/.]/g, '')
      .toLowerCase()
      .split(/\s+/);
    if (warr && warr.length > 0) {
      warr = removePretext(warr);
      warr = replaceDigits(warr);
      warr = cutWords(warr);

      /*
      
      for (var i = 0; i < warr.length; i++) {
        if (warr[i] && !isNaN(+warr[i])) {
          if (digits[warr[i]]) {
            // заменить число на строку
            warr[i] = digits[warr[i]];
            continue;
          }
        }

        // Убрать окончания - разные алгоритмы для ru, en - но пока здесь для en!!
        else if (warr[i].substr(-1) == 's') {
          warr[i] = warr[i].substr(0, warr[i].length - 1);
        }
      }
      */
    }
    return warr;
  }
}

function removePretext(arr) {
  return !exclude[defaultLang] ? arr : arr.filter(word => !exclude[defaultLang].includes(word));
}

function replaceDigits(arr) {
  return !digits[defaultLang] ? arr : arr.map(word => digits[defaultLang][word] || word);
}

function cutWords(arr) {
  return arr.map(word => tryCut(word));
}

function tryCut(word) {
  switch (defaultLang) {
    case 'ru':
      return cutRusEnding(word);

    case 'en':
      return word.substr(-1) == 's' ? word.substr(0, word.length - 1) : word;
    default:
      return word;
  }
}


function cutRusEnding(word) {
  if (word.length<=3) return word;

  // Убрать окончание глагола
  const verbEnding = ['ить','ать','ять','ите'];
  if (verbEnding.includes(word.substr(-3))) return word.substr(0,word.length - 3);

  // Убрать последние гласные
  const vowels = ['а','я','е','и','ы','й'];
  let res = word;
  while (res.length > 2) {
    if (vowels.includes(res.substr(-1))) {
      res = res.substr(0, word.length - 1);
    } else break;
  }
  return res;

}

/** Формировать упорядоченный массив ключевых слов из строки
 *    Упорядочить по словарю по возрастанию частоты использования
 */
function getSortedWordArray(keywordstr) {
  let warr;
  let j;
  let rarr = [];

  warr = getWordArray(keywordstr);

  if (!warr) return;

  // на каждом этапе ищем слово с наименьшим весом
  while (warr.length > 0) {
    j = minDictRate(warr);
    rarr.push(warr[j]);
    warr.splice(j, 1);
  }
  return rarr;
}

// Возвращает индекс минимального значения
function minDictRate(warr) {
  let a;
  let minindex = 0;
  let minvalue = 9999;

  for (var i = 1; i < warr.length; i++) {
    a = warr[i];
    if (!a || !dict[a]) continue;

    if (minvalue > dict[a]) {
      minvalue = dict[a];
      minindex = i;
    }
  }
  return minindex;
}

/** Добавить слова в частотный словарь
 */
function addToDict(keywordstr) {
  let warr;
  let word;

  warr = getWordArray(keywordstr);
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

/** Удалить слова из частотного словаря
 */
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

/** Добавить команду
 */
function addToCommand(sobj) {
  let warr;
  let last;

  warr = getSortedWordArray(sobj.keywords);
  if (!warr || !warr.length) return -1;

  vosmsCommand.push({
    num: sobj.num,
    scen: sobj.scen,
    keywords: sobj.keywords,
    reply: sobj.reply,
    vosms: sobj.vosms,
    def: sobj.def
  });
  last = vosmsCommand.length - 1;

  // Если это действие - выделить dn
  if (hut.isDnAction(sobj.scen)) {
    vosmsCommand[last].dn = hut.getDnFromAction(sobj.scen);

    // для дефолтного действия num равен scen
    if (vosmsCommand[last].def) {
      vosmsCommand[last].num = vosmsCommand[last].scen;
      vosmsCommand[last].vosms = 1;
    }
  }

  vosmsCommand[last].firstword = warr[0];

  // 17.09.15
  vosmsCommand[last].arrwords = [];
  for (var j = 0; j < warr.length; j++) {
    vosmsCommand[last].arrwords.push(warr[j]);
  }
}
