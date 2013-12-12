var assert = require('assert')
  , path = require('path');

var AssetManager = require('../lib/assets').AssetManager
  , fixtures = path.join(__dirname, 'fixtures');

describe('Assets', function () {

    it('should index a directory', function () {
        var asset = new AssetManager(path.join(fixtures, 'index-directory'));
        var files = asset.getStaticAssets().map(function (file) {
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
        var asset = new AssetManager(path.join(fixtures, 'not-existent'))
          , had_error = false;
        asset.on('error', function (err) {
            assert(err.message && err.message.indexOf('ENOENT') >= 0, 'Expected an ENOENT error');
            had_error = true;
        });
        assert(!asset.getStaticAssets(), 'Expected the list of static assets to be empty');
        assert(had_error, 'Expected an error');
    });

});
