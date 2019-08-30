/* eslint-disable */
/**
 * tests
 */

const util = require('util');
const assert = require('assert');
const vosmscmd = require('./vosmscmd');

const set1 = [
  { dn: 'LAMP1', zone: '101', name: 'бра', type: '510', place: '1', placeName: '1 этаж', zoneName: 'Холл' },
  { dn: 'LAMP2', zone: '201', name: 'Верхний свет', type: '520', place: '2', placeName: '2 этаж', zoneName: 'Спальня' },
  { dn: 'LAMP3', name: 'Верхний свет', type: '510', place: '1', placeName: '1 этаж' },
  { dn: 'SLAMP1', zone: '103', name: 'Светильник', type: '510', place: '1', placeName: '1 этаж', zoneName: 'Санузел' }
 
];

// Повтор - два санузла на 1 и втором этажах
const set2 = [
  { dn: 'LAMP1', zone: '107', name: 'бра', type: '510', place: '1', placeName: '1 этаж', zoneName: 'Лестница' },
  { dn: 'SLAMP1', zone: '103', name: 'Светильник', type: '510', place: '1', placeName: '1 этаж', zoneName: 'Санузел' },
  { dn: 'SLAMP2', zone: '203', name: 'Светильник', type: '510', place: '2', placeName: '2 этаж', zoneName: 'Санузел' },
  { dn: 'TPOL', zone: '203', name: 'Теплый пол', type: '510', place: '2', placeName: '2 этаж', zoneName: 'Санузел' },
  { dn: 'LAMP2', zone: '207', name: 'Торшер', type: '510', place: '2', placeName: '2 этаж', zoneName: 'Лестница' }
];

function createVo(set) {
  const vo = new vosmscmd();
  vo.setLang('ru');
  const dup = vo.addDevices(set);
  console.log('DUP='+util.inspect(dup));
  return vo;
}

describe('Verbal Command', () => {
  describe('Set1', () => {
    it('Command exists - включи бра', () => {
      const vo = createVo(set1);

      const result = vo.getActionAndAnswer('включи бра');

      assert.equal(typeof result, 'object');
      assert.equal(result.scen, 'LAMP1.on');
    });

    it('Command exists for place - включи верхний свет на первом этаже', () => {
      const vo = createVo(set1);

      const result = vo.getActionAndAnswer('включи верхний свет на первом этаже');

      assert.equal(typeof result, 'object');
      assert.equal(result.scen, 'LAMP3.on');
    });

    it('Command exists - ну ка быстро бра в холле включи', () => {
      const vo = createVo(set1);

      const result = vo.getActionAndAnswer('ну ка быстро бра в холле включи');

      assert.equal(typeof result, 'object');
      assert.equal(result.scen, 'LAMP1.on');
    });

    it('Command exists - включи верхний свет в спальне', () => {
      const vo = createVo(set1);

      const result = vo.getActionAndAnswer('включи верхний свет в спальне');

      assert.equal(typeof result, 'object');
      assert.equal(result.scen, 'LAMP2.on');
    });

    it('Command exists - включи светильник в санузле первого этажа', () => {
      const vo = createVo(set1);

      const result = vo.getActionAndAnswer('включи светильник в санузле первого этажа');
      console.log('result=' + util.inspect(result));

      assert.equal(typeof result, 'object');
      assert.equal(result.scen, 'SLAMP1.on');
    });

    it('Group Command exists - включи свет в санузле первого этажа', () => {
      // первого этажа - лишнее - санузел один
      const vo = createVo(set1);

      const result = vo.getActionAndAnswer('включи светильник в санузле первого этажа');
      console.log('result=' + util.inspect(result));

      assert.equal(typeof result, 'object');
      assert.equal(result.scen, 'SLAMP1.on');
    });

    it('Group Command exists - включи свет в спальне', () => {
      const vo = createVo(set1);

      const result = vo.getActionAndAnswer('включи свет в спальне');

      assert.equal(typeof result, 'object');
      assert.equal(result.scen, 'ALL.on');
      assert.equal(typeof result.filter, 'object');
      assert.equal(result.filter.room, '201');
    });

    it('Command not exists - ну ка быстро свет на балконе выключи', () => {
      const vo = createVo(set1);

      const result = vo.getActionAndAnswer('ну ка быстро свет на балконе выключи');

      assert.equal(typeof result, 'undefined');
    });

    it('Command incomplete - свет выключи', () => {
      const vo = createVo(set1);

      const result = vo.getActionAndAnswer('свет выключи');

      assert.equal(typeof result, 'undefined');
    });
  });

  describe('Set2', () => {
    it('Command exists - включи светильник в санузле первого этажа', () => {
      const vo = createVo(set2);

      const result = vo.getActionAndAnswer('включи светильник в санузле первого этажа');
      console.log('result=' + util.inspect(result));

      assert.equal(typeof result, 'object');
      assert.equal(result.scen, 'SLAMP1.on');
    });

    it('Group Command exists - включи свет в санузле первого этажа', () => {
      const vo = createVo(set2);

      const result = vo.getActionAndAnswer('включи свет в санузле первого этажа');
      console.log('result=' + util.inspect(result));

      assert.equal(typeof result, 'object');
      assert.equal(result.scen, 'ALL.on');
    });
    it('Group Command exists - включи свет на лестнице', () => {
      const vo = createVo(set2);

      const result = vo.getActionAndAnswer('включи свет на лестнице первого этажа');
      console.log('result=' + util.inspect(result));

      assert.equal(typeof result, 'object');
      assert.equal(result.scen, 'ALL.on');
    });

    it('Group Command exists - включи тёплый пол в санузле второго этажа', () => {
      const vo = createVo(set2);


      const result = vo.getActionAndAnswer('включи тёплый пол в санузле второго этажа');
      console.log('result=' + util.inspect(result));

      assert.equal(typeof result, 'object');
      assert.equal(result.scen, 'TPOL.on');
    });
  });
});
