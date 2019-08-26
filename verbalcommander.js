/**
 *  verbalcommander.js
 *  Плагин обработки вербальных (текстовых) команд управления устройствами и запуска сценариев:
 *
 *  На старте:
 *  - Получает с сервера списки устройств, помещений и уровней.
 *  - Строит словарь ключевых слов для управления каждым устройством и группового управления
 *  - Получает названия интерактивных сценариев, добавляет в словарь ключевые слова
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
 *   При редактировании названий сценариев, устройств, уровней и помещений - перегенерирует команды
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
    plugin.params = params;
    plugin.log('Received PARAMS ' + JSON.stringify(params));

    // TODO - здесь НУЖНО получить язык от системы!!!
    // И список слов по типам устройств для групповых команд!!
    vc.setLang('ru');
    return plugin.get('devicesV4', { cl: 'ActorD,ActorA' });
  })
  .then(devicelist => {
    if (devicelist && devicelist.length) {
      vc.formLocationList(devicelist);
      const dups = vc.addFirst(devicelist);

      plugin.log('Уникальные команды: ' + vc.getVosmsCommandLen());
      plugin.log('Не уникальные (не включены в словарь): ' + dups.length);
      plugin.log(util.inspect(dups));
    }
  })
  .catch(e => {
    plugin.log('ERROR! ' + util.inspect(e));
  });

/**
 * Запросы от сервера - обработчик сообщений type:command
 * {type:"command", command:"..."}
 *
 * Разобрать входящее сообщение
 * Передать команду управления на сервер
 * И ответ на клиент
 */
plugin.onCommand(message => {
  if (!message.command || typeof message.command != 'string') {
    throw { message: 'Unknown command in message:' + util.inspect(message) + ' Expected string!' };
  }

  const result = vc.getActionAndAnswer(message.command);
  if (result && result.scen) {

    // TODO - может быть сценарий!!
    const arr = result.scen.split('.');
    if (arr[0] == 'ALL') {
      plugin.do(result.filter, arr[1]);
    } else {
      plugin.do(arr[0], arr[1]);
    }

    message.payload = { reply: result.reply, result: 1 };
  } else {
    message.payload = { result: 0 };
  }
  plugin.sendResponse(message, 1);
});


/**
 * Подписка на редактирование списков
 *  и перегенерация (добавление, удаление) команд
 */