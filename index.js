/**
 *  verbalcommander.js
 *  Плагин обработки вербальных (текстовых) команд управления устройствами и запуска сценариев:
 *
 *  На старте:
 *  - Получает с сервера свои Расширения, в которых пользователь вводит фразы на запуск сценарив, управление устройствами
 * 
 *  - Получает с сервера списки устройств вместе с названием помещения/уровня для автоматической генерации фраз
 *    Строит словарь ключевых слов для управления каждым устройством и группового управления
 *    Берутся только устройства заданных подсистем (параметры gendevcmd, gengroupcmd)
 * 
 
 *
 * Основной цикл:
 *  - Получает с сервера команды {uuid:xx, type:"command", command:"включи дорогуша свет в холле"}
 *  - Ищет в словаре ключевые слова из сообщения
 *  - Запускает сценарий
 *     или передает команду устройству plugin.do('LAMP1', 'on')
 *     или передает групповую команду  plugin.do({place:1, type:'510,520'}, 'off')
 *
 *  - Передает ответ на клиент: {uuid:xx, reply:'Холл Свет включен', result:1}, при ошибке {uuid:xx, result:0}
 *
 *
 * Подписка на изменения:
 *   При редактировании Расширений, устройств, названий уровней или помещений - перегенерирует команды
 *
 */

const util = require('util');


const plugin = require('ih-plugin-api')();
const vc = require('./lib/vosmscmd')();

plugin.log(`Verbal Commander has started`);

plugin.on('error', err => {
  plugin.log('ERROR: ' + util.inspect(err));
});

plugin.params
  .get()
  .then(params => {
    processParams(params);
    return loadExtra();
  })
  .then(() => {
    loadDevices();
  })
  .catch(e => {
    plugin.log('ERROR! ' + util.inspect(e));
  });

function processParams(params) {
  plugin.params = params;
  plugin.log('Received PARAMS ' + JSON.stringify(params));
  vc.setLang(params.lang || 'ru');
}

function loadExtra(reload) {
  return new Promise(resolve => {
    plugin.get('pluginextra', { unit: 'voicecontrol' }).then(scenelist => {
      if (reload) vc.delCommands({ ext: 1 });

      plugin.log('Uploaded ext commands: ' + scenelist.length);
      vc.addExt(scenelist);
      // plugin.log('Ext: '+ util.inspect(vc.getVosmsExtCommands()));
      resolve();
    });
  });
}

function loadDevices(reload) {
  return new Promise(resolve => {
    plugin.get('devicesV4', { cl: 'ActorD,ActorA' }).then(devicelist => {
      if (reload) vc.delCommands({ devices: 1 });
      plugin.log( vc.getMessage('gendevcmd')+' - '+(plugin.params.gendevcmd ? vc.getMessage('yes') : vc.getMessage('no')));
      plugin.log( vc.getMessage('gengroupcmd')+' - '+(plugin.params.gengroupcmd ? vc.getMessage('yes') : vc.getMessage('no')));
      const dups = vc.addDevices(devicelist, plugin.params);  // Параметры - опционально генерировать команды
     
      // plugin.log('Dev: '+ util.inspect(vc.getVosmsDevCommands()));

      // plugin.log('Уникальные команды: ' + vc.getVosmsCommandLen());
      plugin.log(vc.getMessage('NotUnique')+' : ' + dups.length);
      if (dups.length) plugin.log(util.inspect(dups));
      plugin.set('channels', vc.getChannels());
      resolve();
    });
  });
}

/**
 * Запросы от сервера - обработчик сообщений type:command
 * {type:"command", command:"фраза содержащая ключевые слова"}
 *
 * Разобрать входящее сообщение
 * Передать команду управления на сервер
 * И ответ на клиент
 */
plugin.onCommand(message => {
  if (!message.command || typeof message.command != 'string') {
    throw { message: 'Unknown command in message:' + util.inspect(message) + ' Expected string!' };
  }

  plugin.log('get mess:'+util.inspect(message));
  const sender = {login: message.login ? message.login+'voicecontrol' :  'voicecontrol'};

  
  const result = vc.getActionAndAnswer(message.command);
  if (result && result.scen) {
    if (result.scen.indexOf('.') < 0) {
      // Сценарий
      plugin.startscene(result.scen, '', sender);
    } else {
      const arr = result.scen.split('.');
      const value = result.value;
      if (arr[0] == 'ALL') {
        plugin.do(result.filter, arr[1], value, sender);
      } else {
        plugin.do(arr[0], arr[1], value, sender);
      }
    }

    message.payload = { reply: result.reply, result: 1 };
  } else {
    message.payload = { result: 0 };
  }
  plugin.sendResponse(message, 1);
});

/**
 * Подписка на редактирование списков
 *  и перегенерация команд
 */

// Изменились названия помещений и уровней - Запросить и перегенерировать заново автоматические команды
// plugin.places.onUpdate(data => {
plugin.places.onUpdate(() => {
  plugin.log('Places has updated. Rebuild device commands');
  loadDevices(true);
});

plugin.rooms.onUpdate(() => {
  plugin.log('Rooms has updated. Rebuild device commands');
  loadDevices(true);
});


// Изменения в устройствах - любые (добавление, удаление) - Запросить и перегенерировать заново автоматические команды
plugin.onChange('devref',  { cl: 'ActorD,ActorA' }, (data) => {
  plugin.log('Device has updated.'+util.inspect(data));
  loadDevices(true);
});

// Изменения в Расширениях- любые (добавление, удаление) - Запросить и перегенерировать заново ext команды
plugin.onChange('pluginextra',  { unit: 'voicecontrol' }, (data) => {
  plugin.log('EXT has updated.'+util.inspect(data));
  loadExtra(true);
});

