var assert = require('assert')
  , path = require('path');

var AssetManager = require('../lib/assets').AssetManager
  , fixtures = path.join(__dirname, 'fixtures');

describe('Assets', function () {

    it('should find all assets in the specified directory', function () {
        var manager = new AssetManager(path.join(fixtures, 'walk-directory'));
        var files = manager.getAssets().map(function (file) {
            return file.name;
        });
        assert.deepEqual(files.sort(), [
            'css/styles.css'
          , 'js/libraries/jquery.js'
          , 'js/main.js'
          , 'robots.txt'
        ]);
    });

    it('should emit an error if the stat directory doesn\'t exist', function () {
        var manager = new AssetManager(path.join(fixtures, 'not-existent'))
          , had_error = false;
        manager.on('error', function (err) {
            assert(err.message && err.message.indexOf('ENOENT') >= 0, 'Expected an ENOENT error');
            had_error = true;
        });
        assert(!manager.getAssets(), 'Expected the list of assets to be empty');
        assert(had_error, 'Expected an error');
    });

    it('should index the contents of the static assets directory', function () {
        var manager = new AssetManager(path.join(fixtures, 'index-directory'));
        manager.indexAssets();
        assert.equal(manager.manifest, 'asset-manifest');
        assert.deepEqual(Object.keys(manager.assets).sort(), [
            'css/styles.css'
          , 'js/libraries/jquery.js'
          , 'js/main.js'
          , 'robots.txt'
        ]);
        assert.deepEqual(manager.compiledAssets, {
            'foo.txt': [ 'asset-de4db33f-foo.txt' ]
          , 'js/all.js': [ 'js/asset-10abe108-all.js', 'js/asset-1234567-all.js' ]
        });
    });

});
