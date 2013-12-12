var assert = require('assert')
  , path = require('path');

var AssetManager = require('../lib/assets').AssetManager
  , fixtures = path.join(__dirname, 'fixtures');

function setup(directory, options) {
    var manager = new AssetManager(path.join(fixtures, directory), options);
    manager.indexAssets();
    manager.hashAssets();
    return manager;
}

describe('Filenames', function () {

    it('should emit an error when the asset could not be found', function () {
        var manager = setup('simple-assets')
          , had_error = false;
        manager.on('error', function (err) {
            assert.equal(err.message, 'Asset "bootstrap.js" could not be found');
            had_error = true;
        });
        assert.equal(manager.asset('bootstrap.js'), '');
        assert(had_error, 'Expected an error');
    });

    it('should generate filenames for assets', function () {
        var manager = setup('simple-assets');
        assert.equal(manager.asset('jquery.js'), 'asset-82470a0982f62504a81cf60128ff61a2-jquery.js');
    });

});
