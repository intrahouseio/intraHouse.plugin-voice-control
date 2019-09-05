/**
 * Объект для управления набором команд (добавление, удаление, поиск).
 *    Команда содержит ключевые слова для выполнения действия устройства или вызова сценария.
 *
 * @module vosmscmd
 */

const util = require('util');

const hut = require('./utils');
const grammar = require('./grammar');
const fdict = require('./freqdict')();
const devcmd = require('./devcmd')();

let vosmsCommand;
module.exports = Vosmscmd;

/**
 *  @constructor
 **/
function Vosmscmd() {
  if (!(this instanceof Vosmscmd)) return new Vosmscmd();

  vosmsCommand = [];
  this.diffsuff = 1;
}

Vosmscmd.prototype.setLang = function(lang) {
  this.lang = lang;
  this.diffsuff = lang == 'ru' ? 3 : 1;
  devcmd.setParam('lang', lang);
  devcmd.setParam('diffsuff', this.diffsuff);
};

Vosmscmd.prototype.getLocationWords = function(name, id) {
  return this.locationWords[name] && this.locationWords[name].has(id) ? this.locationWords[name].get(id) : '';
};

Vosmscmd.prototype.getChannels = function() {
  return devcmd.getWordy();
};

Vosmscmd.prototype.getVosmsCommandLen = function() {
  return vosmsCommand.length;
};

Vosmscmd.prototype.getVosmsSceneCommands = function() {
  return vosmsCommand.filter(item => !hut.isDnAction(item.scen));
  // return vosmsCommand;
};



/**
 * Формировать команды для каждого устройства и групповые команды для каждого типа (typeword)
 *	@param {Array} devices - массив устройств
 *  @return {Array} Массив неуникальных команд
 */
Vosmscmd.prototype.addDevices = function(devices) {
  const res = devcmd.processDevices(devices);
  return this.add(res);
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
 *    @return {Object} {scen: ид сценария или действие, reply:текст ответа, index:индекс }
 **/
Vosmscmd.prototype.getActionAndAnswer = function(text) {
  if (!text || typeof text != 'string') return;
  const words = grammar.getWordArray(text, this.lang);

  const found = this.getSuitable(words);

  console.log(text + ' found.length=' + found.length);
  if (found.length <= 0) return;

  // Нашли несколько - берем с мах кол-вом совпавших ключевых слов
  let index = found[0];
  let maxwords;
  if (found.length > 1) {
    maxwords = vosmsCommand[index].arrwords.length;
    for (var i = 1; i < found.length; i++) {
      if (vosmsCommand[found[i]].arrwords.length > maxwords) {
        index = found[i];
        maxwords = vosmsCommand[index].arrwords.length;
      }
    }
  }

  // Если это команда устройства или групповая - проверить, может во фразе есть помещение и оно не совпадает!!
  return vosmsCommand[index] && devcmd.fitLocation(vosmsCommand[index], words) ? Object.assign({ index }, vosmsCommand[index]) : '';
};


Vosmscmd.prototype.getSuitable = function(warr) {
  if (!warr) return [];

  const text = ' ' + warr.join(' ');
  const found = [];
  let skipword = '';

  for (let i = 0; i < vosmsCommand.length; i++) {
    if (!vosmsCommand[i].scen) continue;

    if (skipword && vosmsCommand[i].firstword == skipword) continue;

    skipword = '';
    if (text.indexOf(' ' + vosmsCommand[i].firstword) < 0) {
      skipword = vosmsCommand[i].firstword;
      continue;
    }

    if (hut.testKeyWords2(vosmsCommand[i].arrwords, text, this.diffsuff)) {
      found.push(i);
    }
  }
  return found;
};

Vosmscmd.prototype.addScenes = function(sarr) {
  if (!sarr || !util.isArray(sarr)) return;
  // Сценарии удалить?
  // Сформировать ключевые слова и ответы
  // Добавить в словарь
  const res = [];
  sarr.forEach(item => {
    // item.scene, item.name
    const warr = grammar.getKeyWords(item.name, this.lang, 'V');
    warr.forEach(keywords => {
      res.push({ scen: item.scene, keywords, reply: formSceneComReply(item.name, this.lang) });
    });
  });
  this.add(res);
};

function formSceneComReply(name, lang) {
  switch (lang) {
    case 'ru':
      return 'Команда "' + name + '" выполнена.';
    default:
      return '"' + name + '" done.';
  }
}

/**  Добавить команды в массив vosmsCommand с проверкой уникальности добавляемых ключевых слов.
*     	Ключевые слова каждого включаемого элемента разложить в массив, упорядоченный по возрастанию частоты использования 
*       Если это действие - выделить dn

*     @param {Array} sarr - массив объектов - команд. Свойства команды:
*         @property {string} scen - ид-р сценария или строка-действие
*         @property {string} keywords - ключевые слова через пробел
*         @property {string} reply   - текст ответа
*         @property {Object} filter   - фильтр для групповых команд
*
*     @return  {Array} rarr - массив не включенных (не уникальных) объектов. Добавлено свойство dupscen - c чем найдено пересечение.
*              Пустой массив означает, что все объекты включены. 
*              Неопределенное значение - ошибка при выполнении  
*/
Vosmscmd.prototype.add = function(sarr) {
  if (!sarr || !util.isArray(sarr)) return;

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
  const rarr = [];
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
      fdict.add(sarr[i].keywords);
    }

    // 2 проход - добавить в массив команд vosmsCommand
    // В каждую запись включить массив arrwords ключевых слов, упорядоченный в нужном порядке
    for (let i = 0; i < sarr.length; i++) {
      this.addToCommand(sarr[i]);
    }

    // Сортировать массив по первому ключевому слову
    vosmsCommand.sort(hut.byorder('firstword', 'A'));
  }

  vosmsCommand.forEach(item => {
    console.log(item.scen + ' ' + item.keywords + ' ' + item.reply + ' filter=' + util.inspect(item.filter));
  });

  console.log('DUP=' + util.inspect(rarr));
  return rarr;
};

/** Добавить команду
 */
Vosmscmd.prototype.addToCommand = function(sobj) {
  const warr = fdict.sortByFreq(grammar.getWordArray(sobj.keywords, this.lang));
  if (!warr || !warr.length) return;

  vosmsCommand.push({
    num: sobj.num,
    scen: sobj.scen,
    keywords: sobj.keywords,
    reply: sobj.reply,
    filter: sobj.filter
  });

  const last = vosmsCommand.length - 1;

  // Если это действие - выделить dn
  if (hut.isDnAction(sobj.scen)) {
    vosmsCommand[last].dn = hut.getDnFromAction(sobj.scen);
  }

  vosmsCommand[last].firstword = warr[0];
  vosmsCommand[last].arrwords = warr.filter(item => item);
};

/** Удалить команды по различным критериям
* 	@param {Object}  - opt - содержит поля-фильтры для удаления
* 		@property {string}  - num - ид-р записи для удаления (номер в файле smscommand, для def - совп. со scen 
* 		@property {string}  - scen - ид-р сценария или действие 
* 		@property {string}  - dn  - удалить команды для устр-ва dn, если задано def:1 - только default команды 
* 		@property {string}  - devices:1  - удалить команды для всех устройств включая групповые

* 	@return {Number} - возвращает количество удаленных записей
*/
Vosmscmd.prototype.delCommands = function(opt) {
  var result = 0;

  for (var i = vosmsCommand.length - 1; i >= 0; i--) {
    if (
      (opt.num && vosmsCommand[i].num == opt.num) ||
      (opt.scen && vosmsCommand[i].scen == opt.scen) ||
      (opt.dn && vosmsCommand[i].dn == opt.dn) ||
      (opt.devices && hut.isDnAction(vosmsCommand[i].scen))
    ) {
      // Удалить из словаря
      fdict.delete(vosmsCommand[i].arrwords);

      // Удалить из массива команд
      vosmsCommand.splice(i, 1);
      result++;
    }
  }
  return result;
};

/**
 *  Возвращает ключевые слова для сценария
 *  	@param {String} scen - id сценария или строка действия (LAMP1.on)
 *   @return {String} Ключевые слова для сценария или действия
 **/
/*
Vosmscmd.prototype.getKeyWords = function(scen) {
  for (var i = 0; i < vosmsCommand.length; i++) {
    if (vosmsCommand[i].scen == scen) {
      return vosmsCommand[i].keywords;
    }
  }
};
*/

/*
Vosmscmd.prototype.addOne = function(sobj) {
  if (!sobj && !sobj.keywords) {
    return;
  }

  if (this.findIdentKeyWords(sobj.keywords)) {
    throw { name: 'errname', message: 'KEYWORDDUPLICATION' };
  }

  fdict.add(grammar.getWordArray(sobj.keywords));
  this.addToCommand(sobj);
  // Сортировать массив по первому ключевому слову
  // TODO - можно рассмотреть вариант insert
  vosmsCommand.sort(hut.byorder('firstword', 'A'));
  return true;
};
*/

/** Редактирование vosmsCommand при редактировании smscommand **/
/*
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
*/

/** Возвращает в callback все команды -действия для одного или всех устройств
 */
/*
Vosmscmd.prototype.findDnActions = function(onedn, callback) {
  for (var i = 0; i < vosmsCommand.length; i++) {
    if (vosmsCommand[i].dn && (!onedn || vosmsCommand[i].dn == onedn)) {
      if (callback) callback('ACTION', vosmsCommand[i], vosmsCommand[i].scen);
    }
  }
};
*/

/** Возвращает в callback все команды для выбранного сценария
 */
/*
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
*/

/*

function buildLocationMap(data, lang) {
  const res = new Map();

  Object.keys(data).forEach(id => {
    const item = data[id];
    if (item.name) {
      // const str = item.longname && item.placeName ? item.placeName + ' ' + item.name : item.name;
      const str = item.longname ? item.placeName + ' ' + item.name : item.name;
      res.set(item.id, grammar.getKeyWords(str, lang, 'F')); // Возвращает массив, так как могут быть варианты!!
    }
  });
  return res;
}

function buildDevNamesMap(devices, lang) {
  const res = new Map();
  devices.forEach(dev => {
    const nameArr = grammar.getKeyWords(dev.name, lang);
    // Добавить элементы массива - м б несколько
    nameArr.forEach(name => {
      if (!res.has(name)) {
        res.set(name, 1);
      } else {
        res.set(name, res.get(name) + 1);
      }
    });
  });
  return res;
}
*/
