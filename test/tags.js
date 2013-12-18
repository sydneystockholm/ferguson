var assert = require('assert')
  , path = require('path')
  , format = require('util').format
  , rimraf = require('rimraf')
  , fs = require('fs');

var Ferguson = require('../').Ferguson
  , fixtures = path.join(__dirname, 'fixtures')
  , temp = path.join(__dirname, 'tmp');

function setup(directory, options) {
    return new Ferguson(path.join(fixtures, directory), options);
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

    it('should let users specify custom tag formats through options', function () {
        var manager = setup('simple-assets', {
            hashLength: 6
          , tags: { '.txt': function (url) {
                return format('<custom src="%s" />', url);
            }}
        });
        assert.equal(manager.asset('robots.txt'), '<custom src="/asset-74be16-robots.txt" />');
    });

    it('should provide a helper for defining custom tag formats', function () {
        var manager = setup('simple-assets', { hashLength: 6 });
        manager.registerTagFormat('.txt', function (url) {
            return format('<custom src="%s" />', url);
        });
        assert.equal(manager.asset('robots.txt'), '<custom src="/asset-74be16-robots.txt" />');
    });

    it('should normalise the extname when defining custom tags', function () {
        var manager = setup('simple-assets', { hashLength: 6 });
        manager.registerTagFormat('TXT', function (url) {
            return format('<custom src="%s" />', url);
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

    it('should prefix the asset URLs with a custom prefix defined with the asset', function () {
        var manager = setup('simple-assets', { hashLength: 6 });
        assert.equal(manager.asset('image.png', { urlPrefix: 'http://cdn.foo.com/' }),
            '<img src="http://cdn.foo.com/asset-74be16-image.png" />');
    });

    it('should prefix the asset URLs with a custom prefix defined in options', function () {
        var manager = setup('simple-assets', {
            urlPrefix: 'http://cdn.foo.com/'
          , hashLength: 6
        });
        assert.equal(manager.asset('image.png'),
            '<img src="http://cdn.foo.com/asset-74be16-image.png" />');
    });

    it('should prefer the prefix specified with the asset definition', function () {
        var manager = setup('simple-assets', {
            urlPrefix: 'http://cdn.foo.com/'
          , hashLength: 6
        });
        assert.equal(manager.asset('image.png', { urlPrefix: 'http://elsewhere.com' }),
            '<img src="http://elsewhere.com/asset-74be16-image.png" />');
    });

    it('should prefix the asset URLs with the path prefix from options', function () {
        var manager = setup('simple-assets', {
            hashLength: 6
          , servePrefix: '/static'
        });
        assert.equal(manager.asset('image.png'),
            '<img src="/static/asset-74be16-image.png" />');
        assert.equal(manager.asset('image.png', { urlPrefix: 'http://cdn.foo.com/' }),
            '<img src="http://cdn.foo.com/static/asset-74be16-image.png" />');
        assert.equal(manager.asset('image.png', { urlPrefix: 'http://cdn.foo.com' }),
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

    it('should let users reference compiler\'s extensions instead of output extensions', function () {
        var compilers = {
            '.less': { output: '.css', compile: function () {} }
        };
        var manager = setup('less-assets', { compilers: compilers });
        assert.equal(manager.asset('foo.less'),
            '<link href="/asset-a2029888991a8a83-foo.css" rel="stylesheet" />');
    });

    it('should only require the user to define an asset once', function () {
        var manager = setup('simple-assets');
        assert.equal(manager.asset('ie8.js',
            { include: [ 'html5shiv.js', 'respond.js' ], attributes: { 'class': 'bar' }}),
            '<script src="/asset-b5d5d67465f661c1-ie8.js" ' +
                'class="bar" type="text/javascript"></script>');
        assert.equal(manager.asset('ie8.js', { attributes: { id: 'foo' }}),
            '<script src="/asset-b5d5d67465f661c1-ie8.js" ' +
                'class="bar" id="foo" type="text/javascript"></script>');
    });

    it('should generate separate tags for each asset when using separateBundles', function () {
        var manager = setup('simple-assets', { separateBundles: true });
        var tags = manager.asset('ie8.js', { include: [ 'html5shiv.js', 'respond.js' ],
            attributes: { 'class': 'bar' }});
        var expected = '<script src="/asset-b001d4af398c297f-html5shiv.js" ' +
                'class="bar" type="text/javascript"></script>\n' +
            '<script src="/asset-0ba08226c3bd0e46-respond.js" ' +
                'class="bar" type="text/javascript"></script>';
        assert.equal(tags, expected);
    });

    it('should generate separate tags for each asset when using separateBundles (2)', function () {
        var manager = setup('simple-assets', { separateBundles: true });
        var tags = manager.asset('ie8.js', { include: '*.js' });
        var expected = '<script src="/asset-b001d4af398c297f-html5shiv.js" ' +
                'type="text/javascript"></script>\n' +
            '<script src="/asset-82470a0982f62504-jquery.js" ' +
                'type="text/javascript"></script>\n' +
            '<script src="/asset-0ba08226c3bd0e46-respond.js" ' +
                'type="text/javascript"></script>';
        assert.equal(tags, expected);
    });

    it('should emit an error when a bundle can\'t be split into multiple tags', function () {
        var manager = setup('simple-assets', { separateBundles: true })
          , had_error = false;
        manager.on('error', function (err) {
            assert.equal(err.message, 'No assets matched the pattern "*.missing" ' +
                'when building asset "ie8.js"');
            had_error = true;
        });
        manager.asset('ie8.js', { include: '*.missing' });
        assert(had_error, 'Expected an error');
    });

    it('should let users override options when referencing predefined assets', function () {
        var manager = setup('simple-assets', { hashLength: 6, html5: true });
        manager.asset('ie8.js', { include: ['html5shiv.js', 'respond.js'] });
        assert.equal(manager.asset('ie8.js', { attributes: { 'class': 'foo' }}),
            '<script src="/asset-b5d5d6-ie8.js" class="foo"></script>');
        assert.equal(manager.asset('ie8.js', { attributes: { 'id': 'foo' }}),
            '<script src="/asset-b5d5d6-ie8.js" id="foo"></script>');
    });

    it('should omit inline type attributes in html5 mode', function () {
        var manager = setup('simple-assets', { html5: true, compress: true });
        assert.equal(manager.asset('style.css', { inline: true }),
            '<style>body{color:red}</style>');
        assert.equal(manager.asset('jquery.js', { inline: true }),
            '<script>window.jQuery={};</script>');
    });

    it('should separate bundles when using inline and separateBundles', function () {
        var manager = setup('simple-assets', { html5: true, compress: true, separateBundles: true });
        var html = manager.asset('jquery.js', { inline: true, include: ['html5shiv.js', 'respond.js'] });
        assert.equal(html, '<script>window.shiv={};</script>\n<script>window.respond={};</script>');
    });

    it('should wrap inline assets in an IIFE when using wrapJavascript', function () {
        var manager = setup('simple-assets', { html5: true, compress: true, wrapJavascript: true });
        var html = manager.asset('jquery.js', { inline: true, attributes: { 'class': 'foo' } });
        assert.equal(html, '<script class="foo">!function(){window.jQuery={}}();</script>');
    });

    it('should emit an error when a read error occurs while inlining', function () {
        rimraf.sync(temp);
        fs.mkdirSync(temp);
        var jqueryPath = path.join(temp, 'jquery.js');
        fs.writeFileSync(jqueryPath, 'var foo');
        var manager = new Ferguson(temp)
          , had_error = false;
        manager.init();
        //Let's be pathological and replace jquery.js with a directory
        fs.unlinkSync(jqueryPath);
        fs.mkdirSync(jqueryPath);
        manager.on('error', function (err) {
            assert.equal(err.message, 'Failed to read file "jquery.js": ' +
                'EISDIR, illegal operation on a directory');
            had_error = true;
        });
        manager.asset('jquery.js', { inline: true });
        assert(had_error, 'Expected an error');
    });

    it('should emit an error when an asset can\'t be inlined because it doesn\'t exist', function () {
        var manager = new Ferguson(path.join(fixtures, 'simple-assets'))
          , had_error = false;
        manager.on('error', function (err) {
            assert.equal(err.message, 'Asset "unknown.js" could not be found');
            had_error = true;
        });
        assert.equal(manager.asset('unknown.js', { inline: true }), '');
        assert(had_error, 'Expected an error');
    });

    it('should emit an error when an asset can\'t be inlined because it doesn\'t exist (2)', function () {
        var manager = new Ferguson(path.join(fixtures, 'simple-assets'))
          , had_error = false;
        manager.on('error', function (err) {
            assert.equal(err.message, 'Asset "unknown.js" could not be found');
            had_error = true;
        });
        assert.equal(manager.assetInline('unknown.js'), '');
        assert(had_error, 'Expected an error');
    });

    it('should emit an error when an asset can\'t be inlined because a compiler is async', function () {
        var manager = new Ferguson(path.join(fixtures, 'less-assets'))
          , had_error = false;
        manager.registerCompiler('.less', '.css', function (path, str, options, callback) {
            callback();
        });
        manager.on('error', function (err) {
            assert.equal(err.message, 'Cannot compile "foo.less" synchronously because ' +
                'the .less compiler is async');
            had_error = true;
        });
        assert.equal(manager.assetInline('foo.css'), '');
        assert(had_error, 'Expected an error');
    });

    it('should emit an error when an asset can\'t be inlined because a compressor is async', function () {
        var manager = new Ferguson(path.join(fixtures, 'simple-assets'), { compress: true })
          , had_error = false;
        manager.registerCompressor('.css', function (str, options, callback) {
            callback();
        });
        manager.on('error', function (err) {
            assert.equal(err.message, 'Cannot compress "/asset-688f09569f1e9594-style.css" ' +
                'synchronously because the .css compressor is async');
            had_error = true;
        });
        assert.equal(manager.assetInline('style.css'), '');
        assert(had_error, 'Expected an error');
    });

    it('should emit an error when an asset can\'t be inlined because a compiler fails', function () {
        var manager = new Ferguson(path.join(fixtures, 'less-assets'))
          , had_error = false;
        manager.registerCompiler('.less', '.css', function () {
            throw new Error('Oops');
        });
        manager.on('error', function (err) {
            assert.equal(err.message, 'Failed to compile file "foo.less": Oops');
            had_error = true;
        });
        assert.equal(manager.assetInline('foo.css'), '');
        assert(had_error, 'Expected an error');
    });

    it('should emit an error when an asset can\'t be inlined because a compressor fails', function () {
        var manager = new Ferguson(path.join(fixtures, 'simple-assets'), { compress: true })
          , had_error = false;
        manager.registerCompressor('.css', function () {
            throw new Error('Oops');
        });
        manager.on('error', function (err) {
            assert.equal(err.message, 'Failed to compress asset ' +
                '"/asset-688f09569f1e9594-style.css": Oops');
            had_error = true;
        });
        assert.equal(manager.assetInline('style.css'), '');
        assert(had_error, 'Expected an error');
    });

    it('should let users define custom inline formatters', function () {
        var manager = setup('simple-assets', { compress: true });
        manager.registerInlineFormat('.js', function (contents) {
            return format('<foo>%s</foo>', contents);
        });
        assert.equal(manager.asset('jquery.js', { inline: true }),
            '<foo>window.jQuery={};</foo>');
    });

});
