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

  this.dict = hut.readJsonFileSync(hut.getLocaleFile(lang));
};

Vosmscmd.prototype.getMessage = function(id) {
  return this.dict[id] || '';
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

Vosmscmd.prototype.getVosmsExtCommands = function() {
  return vosmsCommand.filter(item => item.ext);
};

Vosmscmd.prototype.getVosmsDevCommands = function() {
  return vosmsCommand.filter(item => !item.ext);
};
/**
 * Формировать команды для каждого устройства и групповые команды для каждого типа (typeword)
 *	@param {Array} devices - массив устройств
 *  @return {Array} Массив неуникальных команд
 */
Vosmscmd.prototype.addDevices = function(devices, opt) {
  const res = devcmd.processDevices(devices, opt);
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
  return vosmsCommand[index] && devcmd.fitLocation(vosmsCommand[index], words)
    ? Object.assign({ index }, vosmsCommand[index])
    : '';
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

/**
 * Формирование команд из массива Расширений (pluginextra)
 * @param {Array} -  sarr -  массив Расширений 
 *   Элемент массива:
      "name": {String} - ключевая фраза
      "what": {String} - что выполнить: scene, devcmd, group
      "scene":{String} - сценарий
      "arg": {String} - параметры сценария??
      "act": {String} - действие устройства или групповой команды
      "dn":  {String} - устройство
      "gr_subs":{String} - id подсистемы групповой команды
      "gr_place":{String}- id уровня групповой команды
      "gr_room":{String} - id помещения групповой команды
      "gr_type":{String} - id типа групповой команды
 */
Vosmscmd.prototype.addExt = function(sarr) {
  if (!sarr || !util.isArray(sarr)) return;

  // Сформировать команды
  // Сформировать ключевые слова и ответы
  // Добавить в словарь
  const res = [];
  sarr.forEach(item => {
    const warr = grammar.getKeyWords(item.name, this.lang, 'V');
    warr.forEach(keywords => {
      const filter = item.what == 'group' ? formFilter(item) : '';
      const value = (item.act == 'set' || item.act == 'set+' || item.act == 'set-') ? item.value : '';
      res.push({ scen: formExtCommand(item), keywords, filter, value, ext: 1, reply: grammar.formExtReply(item.name, this.lang) });
    });
  });
  this.add(res);
};

function formFilter(item) {
  let res = {};
  if (item.gr_subs) res.subs = item.gr_subs;
  if (item.gr_place) res.place = item.gr_place;
  if (item.gr_room) res.room = item.gr_room;
  if (item.gr_type) res.type = item.gr_type;

  return Object.keys(res).length ? res : '';
}

function formExtCommand(item) {
  switch (item.what) {
    case 'scene':
      return item.scene;

    case 'devcmd':
      return item.dn + '.' + item.act;

    case 'group':
      return 'ALL.' + item.act;

    default:
      return '';
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
    filter: sobj.filter,
    value: sobj.value,
    ext: sobj.ext
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
* 		@property {string}  - devices:1  - удалить команды для всех устройств включая групповые, сгенерированные автоматически
                          - ext:1 - удалить команды ext
* 	@return {Number} - возвращает количество удаленных записей
*/
Vosmscmd.prototype.delCommands = function(opt) {
  var result = 0;

  for (var i = vosmsCommand.length - 1; i >= 0; i--) {
    if (
      (opt.num && vosmsCommand[i].num == opt.num) ||
      (opt.scen && vosmsCommand[i].scen == opt.scen) ||
      (opt.dn && vosmsCommand[i].dn == opt.dn) ||
      ((opt.devices && !vosmsCommand[i].ext) || (opt.ext && vosmsCommand[i].ext))
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

