var assert = require('assert')
  , utils = require('../lib/utils');

describe('Utils', function () {

    it('should strip duplicates from an array', function () {
        assert.deepEqual(utils.stripDuplicates([]), []);
        assert.deepEqual(utils.stripDuplicates(['a', 'b', 'c', 'a']), ['a', 'b', 'c']);
    });

});
