/* eslint-disable */
/**
 * grammar.test.js
 */

var util = require('util');
const assert = require('assert');
const grammar = require('./grammar');

describe('Grammar', () => {
  describe('cutEnding', () => {
    it('Холл', () => {
      let word = 'холл';
      let lang = 'ru';
      const result = grammar.cutEnding(word, lang);

      assert.equal(result, 'холл');
    });
    it('Веранда', () => {
      let word = 'веранда';
      let lang = 'ru';
      const result = grammar.cutEnding(word, lang);

      assert.equal(result, 'веранд');
    });
    it('Гостиная', () => {
      let word = 'гостиная';
      let lang = 'ru';
      const result = grammar.cutEnding(word, lang);

      assert.equal(result, 'гостин');
    });
    it('Точечные', () => {
      let word = 'точечные';
      let lang = 'ru';
      const result = grammar.cutEnding(word, lang);

      assert.equal(result, 'точечн');
    });
    it('Точечный', () => {
      let word = 'точечный';
      let lang = 'ru';
      const result = grammar.cutEnding(word, lang);

      assert.equal(result, 'точечн');
    });
    it('Длинношеее', () => {
      let word = 'Длинношеее';
      let lang = 'ru';
      const result = grammar.cutEnding(word, lang);

      assert.equal(result, 'Длиннош');
    });
    it('Светильники', () => {
      let word = 'Светильники';
      let lang = 'ru';
      const result = grammar.cutEnding(word, lang);

      assert.equal(result, 'Светильник');
    });
  });
  describe('getKeyWords', () => {
    it('Simple string - холл', () => {
      let name = 'холл';
      let lang = 'ru';
      const result = grammar.getKeyWords(name, lang);
      console.log(util.inspect(result));
      assert.equal(typeof result, 'object');
      assert.equal(result.length, 1);
      assert.equal(result[0], 'холл');
    });

    it('String with Number - 1 этаж', () => {
      let name = '1 этаж';
      let lang = 'ru';
      const result = grammar.getKeyWords(name, lang);
      console.log(util.inspect(result));
      assert.equal(typeof result, 'object');
      assert.equal(result.length, 2);
      assert.equal(result[0].trimRight(), 'перв этаж');
    });

    it('String with FluentVowel - санузел', () => {
      let name = 'санузел';
      let lang = 'ru';
      const result = grammar.getKeyWords(name, lang);
      console.log(util.inspect(result));
      assert.equal(typeof result, 'object');
      assert.equal(result.length, 2);
      assert.equal(result[0].trimRight(), 'санузел');
      assert.equal(result[1].trimRight(), 'санузл');
    });

    it('String with Number&FluentVowel - 1 санузел на веранде', () => {
      let name = '1 санузел на веранде';
      let lang = 'ru';
      const result = grammar.getKeyWords(name, lang);
      console.log(util.inspect(result));
      assert.equal(typeof result, 'object');
      assert.equal(result.length, 4);
      assert.equal(result[0].trimRight(), 'перв санузел веранд');
    });

    it('Hard string - санузел №1, на веранде (в тенечке) только для своих', () => {
      let name = 'санузел №1, на веранде (в тенечке) только для своих';
      let lang = 'ru';
      const result = grammar.getKeyWords(name, lang);
      console.log(util.inspect(result));
      assert.equal(typeof result, 'object');
      assert.equal(result.length, 4);
      assert.equal(result[0].trimRight(), 'санузел перв веранд');
      assert.equal(result[1].trimRight(), 'санузел один веранд');
    });
  });
});
