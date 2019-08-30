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
  if (lang == 'ru') this.diffsuff = 3;
};

/**
 * На базе списка устройств построить вспомогательные списки:
 *    1. this.locationWords -  ключевые слова уровней и помещений:
 *       Если название помещения повторяется, то добавляется название уровня
 *        - this.locationWords.places = Map <id:['перв этаж','этаж один']
 *        - this.locationWords.zoons = Map <id:['[холл']>, <id:['перв этаж спальн']>, <id:['втор этаж спальн']>
 *    2. this.typeWords - типы для групповых операций
 *
 *    3. this.devNames - названия устройств для определения уникальности
 *       - this.devNames = = Map <name:count
 *
 *
 *	@param {Array} devices - массив устройств
 */
Vosmscmd.prototype.formLists = function(devices) {
  devices.forEach(dobj => {
    if (dobj.place && dobj.placeName) this.places[dobj.place] = { id: dobj.place, name: dobj.placeName };
    if (dobj.zone && dobj.zoneName)
      this.zones[dobj.zone] = { id: dobj.zone, name: dobj.zoneName, place: dobj.place, placeName: dobj.placeName };
  });

  this.markLongnames();
  this.locationWords.places = buildLocationMap(this.places, this.lang);
  this.locationWords.zones = buildLocationMap(this.zones, this.lang);
  this.devNamesMap = buildDevNamesMap(devices, this.lang);
  console.log('this.devNames ' + this.devNamesMap);
  this.formTypeWords();
};

Vosmscmd.prototype.markLongnames = function() {
  const zonesByName = {};
  Object.keys(this.zones).forEach(id => {
    const zname = this.zones[id].name;
    if (!zonesByName[zname]) {
      zonesByName[zname] = id;
    } else if (zonesByName[zname] != id) {
      // Нужно расширить название (включить туда place) для обеих зон
      this.zones[id].longname = 1;
      this.zones[zonesByName[zname]].longname = 1;
    }
  });
};

Vosmscmd.prototype.getLocationWords = function(name, id) {
  return this.locationWords[name] && this.locationWords[name].has(id) ? this.locationWords[name].get(id) : '';
};

/**
 * Сформировать структуру хранения ключевых слов this.typesByName для формирования групповых операций
 * TODO Слова для типов нужно брать с сервера. Пока здесь как объект - константа зависящая от языка!!
 * this.typesByName = {'свет':['510','520','530']}
 */
const types = {
  en: { '510': 'ligth', '520': 'ligth', '530': 'ligth' },
  ru: { '510': 'свет', '520': 'свет', '530': 'свет' }
};
Vosmscmd.prototype.formTypeWords = function() {
  this.typeWords = {};
  if (!types[this.lang]) return;

  Object.keys(types[this.lang]).forEach(id => {
    const tname = types[this.lang][id];
    if (!this.typeWords[tname]) this.typeWords[tname] = [];
    this.typeWords[tname].push(id);
  });
};

Vosmscmd.prototype.getVosmsCommandLen = function() {
  return vosmsCommand.length;
};

Vosmscmd.prototype.removeDeviceCommands= function() {
  
};

/**
 * Формировать команды для каждого устройства и групповые команды для каждого типа (typeword)
 *	@param {Array} devices - массив устройств
 *  @return {Array} Массив неуникальных команд??
 */
Vosmscmd.prototype.addDevices = function(devices) {
  this.locationWords = {};
  this.typeWords = {};
  this.places = {};
  this.zones = {};
  this.devNamesMap = new Map();

  if (!devices || !Array.isArray(devices) || !devices.length) return [];
 
  this.formLists(devices);

  const res = [];
  Object.keys(this.typeWords).forEach(typeword => {
    res.push(...this.formTypewordAllCommands(typeword, this.typeWords[typeword].join(',')));
  });

  devices.forEach(dev => {
    res.push(...this.formDnCommands(dev));
  });

  return this.add(res);
};

/**
 * Формировать команды для устройства - возможны варианты с названием устройства и названием помещения
 */
Vosmscmd.prototype.formDnCommands = function(dobj) {
  const devnameArr = grammar.getKeyWords(dobj.name, this.lang); // Именительный падеж - беглые гласные не убирать

  let multi;
  devnameArr.forEach(devname => {
    if (this.devNamesMap.get(devname) > 1) multi = true;
  });

  const res = [];
  if (multi) {
    // Нужно добавить место расположения
    const placeArr = this.getLocationWords('zones', dobj.zone) || this.getLocationWords('places', dobj.place);
    devnameArr.forEach(devname => {
      placeArr.forEach(placement => {
        res.push(this.formDnComObj(dobj, devname, 'on', placement));
        res.push(this.formDnComObj(dobj, devname, 'off', placement));
      });
    });
  } else {
    // Название уникально - помещение не добавляем
    devnameArr.forEach(devname => {
      res.push(this.formDnComObj(dobj, devname, 'on', ''));
      res.push(this.formDnComObj(dobj, devname, 'off', ''));
    });
  }
  return res;
};

/**
 * Формировать групповые команды для типа (типов, объединенных словом)
 *   - для всех вариантов помещений и уровней? Без учета, есть там устройства или нет
 *
 */
Vosmscmd.prototype.formTypewordAllCommands = function(typeword, typestr) {
  const res = [];

  // key - id помещения, warr - массив слов
  this.locationWords.places.forEach((warr, id) => {
    warr.forEach(placement => {
      res.push(this.formAllComObj(typeword, { place: id, type: typestr }, 'on', placement));
      res.push(this.formAllComObj(typeword, { place: id, type: typestr }, 'off', placement));
    });
  });

  this.locationWords.zones.forEach((warr, id) => {
    warr.forEach(placement => {
      res.push(this.formAllComObj(typeword, { room: id, type: typestr }, 'on', placement));
      res.push(this.formAllComObj(typeword, { room: id, type: typestr }, 'off', placement));
    });
  });

  return res;
};

Vosmscmd.prototype.formDnComObj = function(dobj, devname, act, placement) {
  return {
    scen: dobj.dn + '.' + act,
    keywords: grammar.getActVerb(act, this.lang) + ' ' + devname + ' ' + placement,
    reply: formReply(fullDnPlacement(dobj), dobj.name, act, this.lang)
  };
};

function fullDnPlacement(dobj) {
  const zname = dobj.zoneName ? ' ' + dobj.zoneName : '';
  return dobj.placeName + zname;
}

function formReply(placement, objname, act, lang) {
  const verb = grammar.getActResultVerb(act, lang, objname);
  return placement + '. ' + hut.capitalize(objname) + ' ' + verb;
}

Vosmscmd.prototype.formAllComObj = function(typeword, filter, act, placement) {
  return {
    scen: 'ALL.' + act,
    filter,
    keywords: grammar.getActVerb(act, this.lang) + ' ' + typeword + ' ' + placement,
    reply: formReply(this.fullPlacementFromFilter(filter), typeword, act, this.lang)
  };
};

Vosmscmd.prototype.fullPlacementFromFilter = function(filter) {
  if (!filter) return '';
  if (filter.place) return this.places[filter.place].name || '';
  if (filter.room) {
    const item = this.zones[filter.room];
    const placename = this.places[item.place].name || '';
    return placename + ' ' + (item.name || '');
  }
};

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

  const found = this.getSuitable(grammar.getWordArray(text, this.lang));
  console.log(text + ' found.length=' + found.length);
  if (found.length <= 0) return;

  // Нашли несколько - берем с мах кол-вом слов
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

  return vosmsCommand[index] ? Object.assign({ index }, vosmsCommand[index]) : '';
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

Vosmscmd.prototype.addOne = function(sobj) {
  // Объект есть, дублирования нет - добавляем
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