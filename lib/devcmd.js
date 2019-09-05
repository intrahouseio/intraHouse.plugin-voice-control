/**
 *
 */
const util = require('util');

const hut = require('./utils');
const grammar = require('./grammar');
// const fdict = require('./freqdict')();

const types = {
  en: { '510': 'ligth', '520': 'ligth', '530': 'ligth' },
  ru: { '510': 'свет', '520': 'свет', '530': 'свет' }
};

module.exports = Devcmd;

/**
 *  @constructor
 **/
function Devcmd() {
  if (!(this instanceof Devcmd)) return new Devcmd();
  this.clearLists();
}

Devcmd.prototype.setParam = function(prop, value) {
  this[prop] = value;
};

Devcmd.prototype.clearLists = function() {
  this.locationWords = {};
  this.typeWords = {};
  this.places = {};
  this.zones = {};
  this.devNamesMap = new Map();
  this.wordy = [];
};

Devcmd.prototype.getWordy = function() {
  return this.wordy;
};

Devcmd.prototype.processDevices = function(devices, opt) {
  this.clearLists();

  if (!devices || !Array.isArray(devices) || !devices.length) return [];

  this.formLists(devices);

  const res = [];
  if (opt.gengroupcmd) {
    Object.keys(this.typeWords).forEach(typeword => {
      res.push(...this.formTypewordAllCommands(typeword, this.typeWords[typeword].join(',')));
    });
  }

  if (opt.gendevcmd) {
    devices.forEach(dev => {
      const dncmd = this.formDnCommands(dev);
      res.push(...dncmd);
      dncmd.forEach(item => {
        this.wordy.push({ id: item.scen, scene: item.scen, dn: item.dn, words: item.keywords });
      });
    });
  }
  return res;
};

/**
 * На базе списка устройств построить вспомогательные списки:
 *    1. this.locationWords -  ключевые слова уровней и помещений:
 *       Если название помещения повторяется, то добавляется название уровня
 *        - this.locationWords.places = Map <id:['перв этаж','этаж один']
 *        - this.locationWords.zoons = Map <id:[['холл']>, <id:['перв этаж спальн']>, <id:['втор этаж спальн']>
 *    2. this.typeWords - типы для групповых операций
 *
 *    3. this.devNames - названия устройств для определения уникальности
 *       - this.devNames = = Map <name:count
 *
 *
 *	@param {Array} devices - массив устройств
 */
Devcmd.prototype.formLists = function(devices) {
  this.devSet = {};

  devices.forEach(dobj => {
    this.devSet[dobj.dn] = dobj;
    if (dobj.place && dobj.placeName) this.places[dobj.place] = { id: dobj.place, name: dobj.placeName };
    if (dobj.zone && dobj.zoneName) {
      this.zones[dobj.zone] = { id: dobj.zone, name: dobj.zoneName, place: dobj.place, placeName: dobj.placeName };
    }
  });

  this.markLongnames();
  this.locationWords.places = buildLocationMap(this.places, this.lang);
  this.locationWords.zones = buildLocationMap(this.zones, this.lang);
  this.devNamesMap = buildDevNamesMap(devices, this.lang);
  console.log('this.devNames ' + this.devNamesMap);
  this.formTypeWords();
};

Devcmd.prototype.markLongnames = function() {
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
/**
 * Формировать команды для устройства - возможны варианты с названием устройства и названием помещения
 */
Devcmd.prototype.formDnCommands = function(dobj) {
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

Devcmd.prototype.getLocationWords = function(name, id) {
  return this.locationWords[name] && this.locationWords[name].has(id) ? this.locationWords[name].get(id) : '';
};

Devcmd.prototype.formDnComObj = function(dobj, devname, act, placement) {
  return {
    scen: dobj.dn + '.' + act,
    dn: dobj.dn,
    keywords: grammar.getActVerb(act, this.lang) + ' ' + devname + ' ' + placement,
    devname,
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

Devcmd.prototype.formAllComObj = function(typeword, filter, act, placement) {
  return {
    scen: 'ALL.' + act,
    filter,
    keywords: grammar.getActVerb(act, this.lang) + ' ' + typeword + ' ' + placement,
    reply: formReply(this.fullPlacementFromFilter(filter), typeword, act, this.lang)
  };
};

Devcmd.prototype.fullPlacementFromFilter = function(filter) {
  if (!filter) return '';
  if (filter.place) return this.places[filter.place].name || '';
  if (filter.room) {
    const item = this.zones[filter.room];
    const placename = this.places[item.place].name || '';
    return placename + ' ' + (item.name || '');
  }
};

/**
 * Формировать групповые команды для типа (типов, объединенных словом)
 *   - для всех вариантов помещений и уровней? Без учета, есть там устройства или нет
 *
 */
Devcmd.prototype.formTypewordAllCommands = function(typeword, typestr) {
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

/**
 * Сформировать структуру хранения ключевых слов this.typeWords для формирования групповых операций
 * TODO Слова для типов нужно брать с сервера. Пока здесь как объект - константа зависящая от языка!!
 */

Devcmd.prototype.formTypeWords = function() {
  this.typeWords = {};
  if (!types[this.lang]) return;

  Object.keys(types[this.lang]).forEach(id => {
    const tname = types[this.lang][id];
    if (!this.typeWords[tname]) this.typeWords[tname] = [];
    this.typeWords[tname].push(id);
  });
};

/** Убедиться, что во входящей фразе нет слов, указывающих на другое помещение, если это не сценарий */
Devcmd.prototype.fitLocation = function(vocmdObj, words) {
  console.log('fitLocation ' + words);
  // Если сценарий - ничего не проверяем
  if (!hut.isDnAction(vocmdObj.scen)) return true;

  // Во входящей фразе найти лишние слова
  const overWords = hut.removeKeyWords(vocmdObj.arrwords, words, this.diffsuff);

  if (!overWords.length) return true;

  console.log('fitLocation overWords ' + util.inspect(overWords));

  // Проверить - возможно это помещение или уровень
  // Если да - проверить, устройство размещено там (фильтр групповой совпадает?)
  let zone = this.findLocationByWords(overWords.join(' '), this.locationWords.zones);
  if (zone) {
    // Проверить, что зона совпадает
    return this.checkLocation(vocmdObj, 'zone', zone);
  }
  let place = this.findLocationByWords(overWords.join(' '), this.locationWords.places);
  if (place) return this.checkLocation(vocmdObj, 'place', place);

  return true;
};

Devcmd.prototype.checkLocation = function(comobj, where, wid) {
  console.log('checkLocation ' + where + '=' + wid + ' comobj=' + util.inspect(comobj));
  if (comobj.filter) {
    switch (where) {
      case 'place':
        return comobj.filter.place == wid;
      case 'zone':
        return comobj.filter.room == wid;
      default:
        return false;
    }
  }

  const dn = comobj.dn;
  const dobj = this.devSet[dn];
  return dobj && dobj[where] == wid;
};

Devcmd.prototype.findLocationByWords = function(text, whereMap) {
  console.log('findLocationByWords ' + text);
  for (let [key, values] of whereMap.entries()) {
    // value.forEach(placement => {
    for (let j = 0; j < values.length; j++) {
      const placement = values[j];
      // console.log('placemant '+placement+' text='+text)
      if (hut.testKeyWords2(placement.split(' '), text, this.diffsuff)) {
        console.log('FOUND ' + placement + ' id=' + key);
        return key;
      }
    }
  }
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
