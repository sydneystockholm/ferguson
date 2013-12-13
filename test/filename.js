var assert = require('assert')
  , path = require('path');

var Manager = require('../').Manager
  , fixtures = path.join(__dirname, 'fixtures');

function setup(directory, options) {
    var manager = new Manager(path.join(fixtures, directory), options);
    manager.indexAssets();
    manager.hashAssets();
    return manager;
}

describe('Filenames', function () {

    it('should generate filenames for assets', function () {
        var manager = setup('simple-assets');
        assert.equal(manager.assetPath('jquery.js'), '/asset-82470a0982f62504a81cf60128ff61a2-jquery.js');
    });

    it('should allow for a configurable hash length', function () {
        var manager = setup('simple-assets', { hashLength: 8 });
        assert.equal(manager.assetPath('jquery.js'), '/asset-82470a09-jquery.js');
    });

    it('should emit an error when the asset could not be found', function () {
        var manager = setup('simple-assets')
          , had_error = false;
        manager.on('error', function (err) {
            assert.equal(err.message, 'Asset "bootstrap.js" could not be found');
            had_error = true;
        });
        assert.equal(manager.assetPath('bootstrap.js'), '');
        assert(had_error, 'Expected an error');
    });

    it('should generate filenames for asset bundles', function () {
        var manager = setup('simple-assets');
        assert.equal(manager.assetPath('ie8.js', { include: [ 'html5shiv.js', 'respond.js' ] }),
            '/asset-b5d5d67465f661c1a12da394e502b391-ie8.js');
    });

    it('should emit an error when an asset in the bundle could not be found', function () {
        var manager = setup('simple-assets')
          , had_error = false;
        manager.on('error', function (err) {
            assert.equal(err.message, 'Asset "bootstrap.js" could not be found ' +
                'when building asset "libraries.js"');
            had_error = true;
        });
        manager.assetPath('libraries.js', { include: [ 'jquery.js', 'bootstrap.js' ] });
        assert(had_error, 'Expected an error');
    });

    it('should only require the user to define an asset once', function () {
        var manager = setup('simple-assets');
        var expected = '/asset-b5d5d67465f661c1a12da394e502b391-ie8.js';
        assert.equal(manager.assetPath('ie8.js',
            { include: [ 'html5shiv.js', 'respond.js' ] }), expected);
        assert.equal(manager.assetPath('ie8.js'), expected);
    });

    it('should ignore duplicates in the list of assets in a bundle', function () {
        var manager = setup('simple-assets');
        var tag = manager.assetPath('ie8.js', { include: [ 'html5shiv.js', 'respond.js' ] });
        assert.equal(tag, '/asset-b5d5d67465f661c1a12da394e502b391-ie8.js');
        tag = manager.assetPath('ie8-b.js', { include: [
            'respond.js', 'html5shiv.js', 'respond.js', 'respond.js', 'html5shiv.js'
        ] });
        assert.equal(tag, '/asset-b5d5d67465f661c1a12da394e502b391-ie8-b.js');
    });

    it('should require a populated include array when defining asset bundles', function () {
        var manager = setup('simple-assets')
          , had_error = false;
        manager.on('error', function () {
            had_error = true;
        });
        manager.assetPath('libraries.js', { include: [] });
        assert(had_error, 'Expected an error');
    });

    it('should support glob when including assets in a bundle', function () {
        var manager = setup('simple-assets');
        var tag = manager.assetPath('all.js', { include: [
            'html5shiv.js', 'respond.js', 'jquery.js'
        ] });
        assert.equal(tag, '/asset-c919d0e16fda90c516ca98655b7b6222-all.js');
        tag = manager.assetPath('all-b.js', { include: '*.js' });
        assert.equal(tag, '/asset-c919d0e16fda90c516ca98655b7b6222-all-b.js');
        tag = manager.assetPath('all-c.js', { include: [
            '{jquery,respond}.js', 'html*.js'
        ] });
        assert.equal(tag, '/asset-c919d0e16fda90c516ca98655b7b6222-all-c.js');
    });

    it('should emit an error when a glob pattern doesn\'t match any assets', function () {
        var manager = setup('simple-assets')
          , had_error = false;
        manager.on('error', function (err) {
            assert.equal(err.message, 'No assets matched the pattern "*.min.js" ' +
                'when building asset "libraries.js"');
            had_error = true;
        });
        manager.assetPath('libraries.js', { include: '*.min.js' });
        assert(had_error, 'Expected an error');
    });

    it('should use uncompiled asset hashes when generating asset filenames', function () {
        var manager = setup('less-assets', { compilers: {
            '.less': { output: '.css', compile: function () {} }
        }});
        assert.equal(manager.assetPath('foo.css'), '/asset-a2029888991a8a83377fea454686b636-foo.css');
    });

    it('should provide helpful error message when an uncompiled asset can\'t be found', function () {
        var compilers = {
            '.less': { output: '.css', compile: function () {} }
          , '.styl': { output: '.css', compile: function () {} }
        };
        var manager = setup('simple-assets', { compilers: compilers })
          , had_error = false;
        manager.on('error', function (err) {
            assert.equal(err.message, 'Asset "unknown.css" could not be found ' +
                '(tried "unknown.less", "unknown.styl")');
            had_error = true;
        });
        manager.assetPath('unknown.css');
        assert(had_error, 'Expected an error');
    });

    it('should provide helpful error message when an uncompiled asset can\'t be found (2)', function () {
        //Some compilers (e.g. browserify) have the same input/output extname
        var compilers = {
            '.js': { output: '.js', compile: function () {} }
        };
        var manager = setup('simple-assets', { compilers: compilers })
          , had_error = false;
        manager.on('error', function (err) {
            assert.equal(err.message, 'Asset "unknown.js" could not be found');
            had_error = true;
        });
        manager.assetPath('unknown.js');
        assert(had_error, 'Expected an error');
    });

    it('should provide helpful error message when an uncompiled asset can\'t be found (3)', function () {
        var compilers = {
            '.less': { output: '.css', compile: function () {} }
          , '.styl': { output: '.css', compile: function () {} }
        };
        var manager = setup('simple-assets', { compilers: compilers })
          , had_error = false;
        manager.on('error', function (err) {
            assert.equal(err.message, 'Asset "css/unknown.css" could not be found ' +
                '(tried "css/unknown.less", "css/unknown.styl")');
            had_error = true;
        });
        manager.assetPath('css/unknown.css');
        assert(had_error, 'Expected an error');
    });

    it('should let users manually specify a list of a file\'s dependencies', function () {
        var compilers = {
            '.less': { output: '.css', compile: function () {} }
        };
        var manager = setup('less-assets', { compilers: compilers });
        var tag = manager.assetPath('foo.css', { dependencies: [ 'bar.less' ] });
        assert.equal(tag, '/asset-656773a8fada8539b9c29914d7ffae3a-foo.css');
    });

    it('should support glob when specifying a list of a file\'s dependencies', function () {
        var compilers = {
            '.less': { output: '.css', compile: function () {} }
        };
        var manager = setup('less-assets', { compilers: compilers });
        var tag = manager.assetPath('foo.css', { dependencies: 'b*.less' });
        assert.equal(tag, '/asset-656773a8fada8539b9c29914d7ffae3a-foo.css');
    });

    it('should emit an error when no assets match a dependency', function () {
        var compilers = {
            '.less': { output: '.css', compile: function () {} }
        };
        var manager = setup('less-assets', { compilers: compilers })
          , had_error = false;
        manager.on('error', function (err) {
            assert.equal(err.message, 'Failed to locate "unknown.less" ' +
                'when finding dependencies for "foo.css"');
            had_error = true;
        });
        manager.assetPath('foo.css', { dependencies: 'unknown.less' });
        assert(had_error, 'Expected an error');
    });

    it('should emit an error when no assets match a dependency glob pattern', function () {
        var compilers = {
            '.less': { output: '.css', compile: function () {} }
        };
        var manager = setup('less-assets', { compilers: compilers })
          , had_error = false;
        manager.on('error', function (err) {
            assert.equal(err.message, 'No assets matched the pattern "*.unknown" ' +
                'when finding dependencies for "foo.css"');
            had_error = true;
        });
        manager.assetPath('foo.css', { dependencies: '*.unknown' });
        assert(had_error, 'Expected an error');
    });

});
