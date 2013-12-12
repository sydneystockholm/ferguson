var assert = require('assert')
  , rimraf = require('rimraf')
  , path = require('path')
  , fs = require('fs');

var AssetManager = require('../lib/assets').AssetManager
  , fixtures = path.join(__dirname, 'fixtures')
  , temp = path.join(__dirname, 'tmp');

describe('Indexing', function () {

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

    it('should emit an error if the static assets directory doesn\'t exist', function () {
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

    it('should hash the contents of assets and cache the results in a manifest', function () {
        rimraf.sync(temp);
        fs.mkdirSync(temp);
        fs.writeFileSync(path.join(temp, 'jquery.js'), 'var foo');
        var manager = new AssetManager(temp);
        manager.indexAssets();
        //Note: hashAssets() returns true when the manifest required an update
        //(i.e. at least one file needed to be rehashed).
        assert(manager.hashAssets(), 'Expected hashAssets() to return true');
        assert.equal(manager.assets['jquery.js'].hash, '6535b4d330f12366c3f7e50afd63dd04');
        var manifest = JSON.parse(fs.readFileSync(path.join(temp, '.asset-manifest')).toString());
        assert.deepEqual(Object.keys(manifest), ['jquery.js']);
        assert.equal(manifest['jquery.js'].hash, '6535b4d330f12366c3f7e50afd63dd04');
        assert(!manager.hashAssets(), 'Expected hashAssets() to return false');
        assert.equal(manager.assets['jquery.js'].hash, '6535b4d330f12366c3f7e50afd63dd04');
    });

    it('should recover from an invalid manifest', function () {
        rimraf.sync(temp);
        fs.mkdirSync(temp);
        fs.writeFileSync(path.join(temp, 'jquery.js'), 'var foo');
        fs.writeFileSync(path.join(temp, '.asset-manifest'), '<not-json>');
        var manager = new AssetManager(temp);
        manager.indexAssets();
        //Note: hashAssets() returns true when the manifest required an update
        //(i.e. at least one file needed to be rehashed).
        assert(manager.hashAssets(), 'Expected hashAssets() to return true');
        assert.equal(manager.assets['jquery.js'].hash, '6535b4d330f12366c3f7e50afd63dd04');
        var manifest = JSON.parse(fs.readFileSync(path.join(temp, '.asset-manifest')).toString());
        assert.deepEqual(Object.keys(manifest), ['jquery.js']);
        assert.equal(manifest['jquery.js'].hash, '6535b4d330f12366c3f7e50afd63dd04');
    });

    it('should emit an error when the manifest can\'t be written to', function () {
        var manager = new AssetManager(path.join(fixtures, 'invalid-manifest'))
          , had_error = false;
        manager.on('error', function (err) {
            assert(err.message && err.message.indexOf('EISDIR') >= 0, 'Expected an EISDIR error');
            had_error = true;
        });
        manager.indexAssets();
        manager.hashAssets();
        assert(had_error, 'Expected an error');
    });

    it('should allow for the file hash to be set via options', function () {
        rimraf.sync(temp);
        fs.mkdirSync(temp);
        fs.writeFileSync(path.join(temp, 'jquery.js'), 'var foo');
        var manager = new AssetManager(temp, { hash: 'sha1' });
        manager.indexAssets();
        manager.hashAssets();
        assert.equal(manager.assets['jquery.js'].hash, '7a0b376193fcfec6f5619caf59df33140f93252e');
    });

});
