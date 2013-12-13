var assert = require('assert')
  , path = require('path')
  , format = require('util').format;

var Manager = require('../').Manager
  , fixtures = path.join(__dirname, 'fixtures');

function setup(directory, options) {
    var manager = new Manager(path.join(fixtures, directory), options);
    manager.indexAssets();
    manager.hashAssets();
    return manager;
}

describe('Tags', function () {

    it('should generate script tags for javascript assets', function () {
        var manager = setup('simple-assets', { hashLength: 6 });
        assert.equal(manager.asset('jquery.js'),
            '<script src="/asset-82470a-jquery.js" type="text/javascript"></script>');
    });

    it('should let users specify additional tag attributes', function () {
        var manager = setup('simple-assets', { hashLength: 6 });
        var tag = manager.asset('jquery.js', { attributes: {
            type: 'text/x-template'
          , id: 'my-template'
        }});
        assert.equal(tag, '<script src="/asset-82470a-jquery.js" id="my-template" ' +
            'type="text/x-template"></script>');
    });

    it('should omit the script type attribute in html5 mode', function () {
        var manager = setup('simple-assets', { hashLength: 6, html5: true });
        assert.equal(manager.asset('jquery.js'),
            '<script src="/asset-82470a-jquery.js"></script>');
    });

    it('should generate link tags for css assets', function () {
        var manager = setup('simple-assets', { hashLength: 6 });
        assert.equal(manager.asset('style.css'),
            '<link href="/asset-688f09-style.css" rel="stylesheet" />');
    });

    it('should emit an error when the manager doesn\'t know how to output a tag', function () {
        var manager = setup('simple-assets')
          , had_error = false;
        manager.on('error', function (err) {
            assert.equal(err.message, 'Unable to create an HTML tag for type ".txt"');
            had_error = true;
        });
        assert.equal(manager.asset('robots.txt'), '');
        assert(had_error, 'Expected an error');
    });

    it('should let users specify custom tag formats', function () {
        var manager = setup('simple-assets', {
            hashLength: 6
          , tags: { '.txt': function (url) {
                return format('<custom src="%s" />', url);
            }}
        });
        assert.equal(manager.asset('robots.txt'), '<custom src="/asset-74be16-robots.txt" />');
    });

    it('should output tags for icons', function () {
        var manager = setup('simple-assets', { hashLength: 6 });
        assert.equal(manager.asset('favicon.ico'),
            '<link href="/asset-74be16-favicon.ico" rel="shortcut icon" />');
    });

    it('should output tags for images', function () {
        var manager = setup('simple-assets', { hashLength: 6 });
        assert.equal(manager.asset('image.png'),
            '<img src="/asset-74be16-image.png" />');
        assert.equal(manager.asset('image.gif'),
            '<img src="/asset-74be16-image.gif" />');
    });

    it('should escape certain chars in attribute values', function () {
        var manager = setup('simple-assets', { hashLength: 6 });
        assert.equal(manager.asset('image.png', { attributes: { alt: 'Foo & bar' }}),
            '<img src="/asset-74be16-image.png" alt="Foo &amp; bar" />');
    });

    it('should prefix the asset URLs with a custom prefix', function () {
        var manager = setup('simple-assets', { hashLength: 6 });
        assert.equal(manager.asset('image.png', { prefix: 'http://cdn.foo.com/' }),
            '<img src="http://cdn.foo.com/asset-74be16-image.png" />');
    });

    it('should prefix the asset URLs with the path prefix from options', function () {
        var manager = setup('simple-assets', {
            hashLength: 6
          , servePrefix: '/static'
        });
        assert.equal(manager.asset('image.png'),
            '<img src="/static/asset-74be16-image.png" />');
        assert.equal(manager.asset('image.png', { prefix: 'http://cdn.foo.com/' }),
            '<img src="http://cdn.foo.com/static/asset-74be16-image.png" />');
        assert.equal(manager.asset('image.png', { prefix: 'http://cdn.foo.com' }),
            '<img src="http://cdn.foo.com/static/asset-74be16-image.png" />');
    });

    it('should return an empty string when an error occurs', function () {
        var manager = setup('simple-assets')
          , had_error = false;
        manager.on('error', function () {
            had_error = true;
        });
        assert.equal(manager.asset('unknown.js'), '');
        assert(had_error, 'Expected an error');
    });

});
