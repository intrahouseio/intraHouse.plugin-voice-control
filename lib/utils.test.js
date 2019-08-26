/* eslint-disable */
/**
 * utils.test.js
 */

var util = require('util');
const assert = require('assert');
const hut = require('./utils');

describe('Utils', () => {
  describe('getPermutation', () => {
    it('Permutation 1', () => {
      var allArrays = [['первый', 'один'], ['этаж'], ['санузел', 'санузл'], ['веранд']];
      const result = hut.getPermutation(allArrays);
      console.log(util.inspect(result));
      assert.equal(typeof result, 'object');
    });
  });

  describe('WeakEq', () => {
    it('The same words', () => {
      const res = hut.weakEq('сравнить', 'сравнить', 3);
      assert.equal(res, true);
    });
    it('Verbs with diff ending', () => {
      const res = hut.weakEq('сравнить', 'сравни', 3);
      assert.equal(res, true);
    });
    it('Swap verbs with diff ending', () => {
      const res = hut.weakEq('сравн', 'сравнить', 3);
      assert.equal(res, true);
    });
    it('Nouns with diff ending', () => {
      const res = hut.weakEq('гостиная', 'гостиной', 3);
      assert.equal(res, true);
    });
    it('Else Nouns with diff ending', () => {
      const res = hut.weakEq('санузел', 'санузле', 3);
      assert.equal(res, true);
    });
  });

  describe('testKeyWords2', () => {
    it('включи свет гостиная', () => {
      const keyarr = 'включ свет гостин'.split(' ');
      const str = 'включи свет гостиная';
      const res = hut.testKeyWords2(keyarr, str, 3);
      assert.equal(res, true);
    });

    it('включи свет гостиная - включи свет в гостиной', () => {
      const keyarr = 'включ свет гостин'.split(' ');
      const str = 'включи свет в гостиной';
      const res = hut.testKeyWords2(keyarr, str, 3);
      assert.equal(res, true);
    });

    it('включи свет гостиная - включи свет в спальне', () => {
      const keyarr = 'включи свет гостиная'.split(' ');
      const str = 'включи свет в спальне';
      const res = hut.testKeyWords2(keyarr, str, 3);
      assert.equal(res, false);
    });
  });
});
