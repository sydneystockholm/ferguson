var assert = require('assert')
  , exports = require('../');

describe('Exports', function () {

    it('should provide a shortcut for instantiating an asset manager', function () {
        var Manager = exports.Manager;
        assert(typeof Manager, 'function', 'Expected exports.Manager to exist');
        var instance = exports('/tmp');
        assert(instance instanceof Manager, 'Expected a shortcut function for instantiating a Manager');
    });

    it('should export the tag formats and helpers', function () {
        assert(typeof exports.tags, 'object', 'Expected exports.tags to exist');
        assert(typeof exports.tags.stringify, 'function',
            'Expected exports.tags to export tag formats and helpers');
    });

    it('should export utility functions', function () {
        assert(typeof exports.utils, 'object', 'Expected exports.utils to exist');
        assert(typeof exports.utils.stripDuplicates, 'function',
            'Expected exports.utils to export utilities');
    });

});
