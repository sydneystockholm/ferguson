var assert = require('assert')
  , exports = require('../');

describe('Exports', function () {

    it('should provide a shortcut for instantiating an asset manager', function () {
        var Ferguson = exports.Ferguson;
        assert(typeof Ferguson, 'function', 'Expected exports.Ferguson to exist');
        var instance = exports('/tmp');
        assert(instance instanceof Ferguson, 'Expected a shortcut function for instantiating a Ferguson');
    });

    it('should export the tag formats and helpers', function () {
        assert(typeof exports.tags, 'object', 'Expected exports.tags to exist');
        assert(typeof exports.tags.stringify, 'function',
            'Expected exports.tags to export tag formats and helpers');
    });

    it('should export the default compressors', function () {
        assert(typeof exports.compressors, 'object', 'Expected exports.compressors to exist');
        assert(typeof exports.compressors['.js'], 'function',
            'Expected exports.compressors to export the default compressors');
    });

    it('should export utility functions', function () {
        assert(typeof exports.utils, 'object', 'Expected exports.utils to exist');
        assert(typeof exports.utils.stripDuplicates, 'function',
            'Expected exports.utils to export utilities');
    });

});
