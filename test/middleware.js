var assert = require('assert')
  , path = require('path')
  , http = require('http')
  , less = require('less')
  , rimraf = require('rimraf')
  , express = require('express')
  , nunjucks = require('nunjucks')
  , fs = require('fs')
  , port = 12435;

var Ferguson = require('../').Ferguson
  , fixtures = path.join(__dirname, 'fixtures')
  , temp = path.join(__dirname, 'tmp')
  , temp2 = path.join(__dirname, 'tmp2');

function mocks(callback) {
    var app = express()
      , port_ = port++;
    app.use(function (request, response, next) {
        response.render = function (template) {
            var locals = {};
            for (var key in response.locals) {
                locals[key] = response.locals[key];
            }
            response.send(nunjucks.renderString(template, locals));
        };
        next();
    });
    var server = app.listen(port_);
    function request(uri, callback) {
        http.request({
            hostname: 'localhost'
          , port: port_
          , method: 'GET'
          , path: uri
        }, function (response) {
            var body = '';
            response.setEncoding('utf8');
            response.on('data', function (chunk) {
                body += chunk;
            }).on('end', function () {
                callback(null, response, body);
            });
        }).end();
    }
    var complete = false;
    callback(app, request, function (done) {
        if (complete) return;
        complete = true;
        server.close();
        done();
    });
}

describe('Middleware', function () {

    it('should provide express middleware', function (done) {
        var manager = new Ferguson(path.join(fixtures, 'empty'));
        mocks(function (app, request, next) {
            manager.bind(app);
            app.get('/foo.txt', function (request, response) {
                response.send('foo');
            });
            request('/foo.txt', function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(body, 'foo');
                next(done);
            });
        });
    });

    it('should provide a view helper for defining assets', function (done) {
        var manager = new Ferguson(path.join(fixtures, 'empty'));
        manager.asset = function () {
            return 'foo';
        };
        mocks(function (app, request, next) {
            manager.bind(app);
            app.get('/', function (request, response) {
                response.render('{{ asset("foo.css") }}');
            });
            request('/', function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(body, 'foo');
                next(done);
            });
        });
    });

    it('should provide a view helper for defining asset paths', function (done) {
        var manager = new Ferguson(path.join(fixtures, 'empty'));
        manager.assetPath = function () {
            return 'foo';
        };
        mocks(function (app, request, next) {
            manager.bind(app);
            app.get('/', function (request, response) {
                response.render('{{ asset.path("foo.css") }}');
            });
            request('/', function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(body, 'foo');
                next(done);
            });
        });
    });

    it('should provide a view helper for defining asset urls', function (done) {
        var manager = new Ferguson(path.join(fixtures, 'empty'), {
            urlPrefix: 'http://example.com/'
        });
        manager.assetPath = function (identifier) {
            return '/' + identifier;
        };
        mocks(function (app, request, next) {
            manager.bind(app);
            app.get('/', function (request, response) {
                response.render('{{ asset.url("foo.css") }}');
            });
            request('/', function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(body, 'http://example.com/foo.css');
                next(done);
            });
        });
    });

    it('should let users modify the view helper name', function (done) {
        var manager = new Ferguson(path.join(fixtures, 'empty'), {
            viewHelper: 'foobarbaz'
        });
        manager.asset = function () {
            return 'foo';
        };
        mocks(function (app, request, next) {
            manager.bind(app);
            app.get('/', function (request, response) {
                response.render('{{ foobarbaz("foo.css") }}');
            });
            request('/', function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(body, 'foo');
                next(done);
            });
        });
    });

    it('should serve static assets', function (done) {
        var manager = new Ferguson(path.join(fixtures, 'simple-assets'));
        mocks(function (app, request, next) {
            manager.bind(app);
            request('/jquery.js', function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(response.headers['content-type'], 'application/javascript');
                assert.equal(body.trim(), 'window.jQuery = {};');
                next(done);
            });
        });
    });

    it('should serve static assets with a configurable max-age', function (done) {
        var manager = new Ferguson(path.join(fixtures, 'simple-assets'), {
            maxAge: 86400000
        });
        mocks(function (app, request, next) {
            manager.bind(app);
            request('/jquery.js', function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(response.headers['content-type'], 'application/javascript');
                assert.equal(response.headers['cache-control'], 'public, max-age=86400');
                assert.equal(body.trim(), 'window.jQuery = {};');
                next(done);
            });
        });
    });

    it('should serve static assets from a configurable prefix', function (done) {
        var manager = new Ferguson(path.join(fixtures, 'simple-assets'), {
            servePrefix: '/static'
        });
        mocks(function (app, request, next) {
            manager.bind(app);
            request('/static/jquery.js', function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(response.headers['content-type'], 'application/javascript');
                assert.equal(body.trim(), 'window.jQuery = {};');
                next(done);
            });
        });
    });

    it('should 404 when a compiled asset that\'s unknown to the manager is encountered', function (done) {
        var manager = new Ferguson(path.join(fixtures, 'simple-assets'), {
            servePrefix: '/static'
        });
        mocks(function (app, request, next) {
            manager.bind(app);
            request('/static/asset-123456-jquery.js', function (err, response) {
                assert.ifError(err);
                assert.equal(response.statusCode, 404);
                next(done);
            });
        });
    });

    it('should compile and serve a single file asset', function (done) {
        var assets = path.join(fixtures, 'simple-assets')
          , manager = new Ferguson(assets);
        mocks(function (app, request, next) {
            manager.bind(app);
            var jquery = manager.assetPath('jquery.js');
            rimraf.sync(path.join(assets, jquery));
            request(jquery, function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(response.headers['content-type'], 'application/javascript');
                assert.equal(body.trim(), 'window.jQuery = {};');
                next(done);
            });
        });
    });

    it('should 500 when an asset read error occurs', function (done) {
        rimraf.sync(temp);
        fs.mkdirSync(temp);
        var jqueryPath = path.join(temp, 'jquery.js');
        fs.writeFileSync(jqueryPath, 'var foo');
        var manager = new Ferguson(temp);
        mocks(function (app, request, next) {
            manager.bind(app);
            var requestError;
            app.use(function (err, request, response, next) {
                requestError = err;
                next = next; //-jshint
                response.send(500);
            });
            //Let's be pathological and replace jquery.js with a directory
            fs.unlinkSync(jqueryPath);
            fs.mkdirSync(jqueryPath);
            var jquery = manager.assetPath('jquery.js');
            request(jquery, function (err, response) {
                assert.ifError(err);
                assert(requestError && requestError.message.indexOf('EISDIR') >= 0,
                    'Expected an EISDIR error');
                assert.equal(response.statusCode, 500);
                next(done);
            });
        });
    });

    it('should serve up bundles of assets', function (done) {
        var assets = path.join(fixtures, 'simple-assets')
          , manager = new Ferguson(assets);
        mocks(function (app, request, next) {
            manager.bind(app);
            var ie8 = manager.assetPath('ie8.js', { include: [ 'html5shiv.js', 'respond.js' ] });
            rimraf.sync(path.join(assets, ie8));
            request(ie8, function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(body.trim(), 'window.shiv = {};\nwindow.respond = {};');
                next(done);
            });
        });
    });

    it('should serve up bundles of assets from a subdirectory', function (done) {
        var assets = path.join(fixtures, 'simple-assets')
          , manager = new Ferguson(assets);
        mocks(function (app, request, next) {
            manager.bind(app);
            var ie8 = manager.assetPath('js/ie8.js',
                { include: [ 'js/html5shiv.js', 'js/respond.js' ] });
            rimraf.sync(path.join(assets, ie8));
            request(ie8, function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(body.trim(), 'window.shiv = {};\nwindow.respond = {};');
                next(done);
            });
        });
    });

    it('should compress javascript assets', function (done) {
        var assets = path.join(fixtures, 'simple-assets')
          , manager = new Ferguson(assets, { compress: true });
        mocks(function (app, request, next) {
            manager.bind(app);
            var ie8 = manager.assetPath('ie8.js', { include: [ 'html5shiv.js', 'respond.js' ] });
            rimraf.sync(path.join(assets, ie8));
            request(ie8, function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(body.trim(), 'window.shiv={},window.respond={};');
                next(done);
            });
        });
    });

    it('should compress css assets', function (done) {
        var assets = path.join(fixtures, 'simple-assets')
          , manager = new Ferguson(assets, { compress: true });
        mocks(function (app, request, next) {
            manager.bind(app);
            var style = manager.assetPath('style.css');
            rimraf.sync(path.join(assets, style));
            request(style, function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(body.trim(), 'body{color:red}');
                next(done);
            });
        });
    });

    it('should support custom compressors', function (done) {
        var compressors = {
            '.css': function (contents, options, callback) {
                callback(null, contents.replace(/[\n ]/g, '').replace('red', 'blue'));
            }
        };
        var assets = path.join(fixtures, 'simple-assets')
          , manager = new Ferguson(assets, { compress: true, compressors: compressors });
        mocks(function (app, request, next) {
            manager.bind(app);
            var style = manager.assetPath('style.css');
            rimraf.sync(path.join(assets, style));
            request(style, function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(body.trim(), 'body{color:blue;}');
                next(done);
            });
        });
    });

    it('should send a 500 when a compressor fails', function (done) {
        var assets = path.join(fixtures, 'invalid-assets')
          , manager = new Ferguson(assets, { compress: true });
        mocks(function (app, request, next) {
            manager.bind(app);
            var requestError;
            app.use(function (err, request, response, next) {
                requestError = err;
                next = next; //-jshint
                response.send(500);
            });
            var invalid = manager.assetPath('invalid.js');
            rimraf.sync(path.join(assets, invalid));
            request(invalid, function (err, response) {
                assert.ifError(err);
                assert.equal(response.statusCode, 500);
                assert(requestError && requestError.message.indexOf('Failed to compress asset') >= 0,
                    'Expected an UglifyJS error');
                next(done);
            });
        });
    });

    it('should serve up less assets', function (done) {
        var assetPath;
        var compilers = {
            '.less': {
                output: '.css'
              , compile: function (path, contents, options, callback) {
                    assetPath = path;
                    less.render(contents, callback);
                }
            }
        };
        var assets = path.join(fixtures, 'less-assets')
          , manager = new Ferguson(assets, { compress: true, compilers: compilers });
        mocks(function (app, request, next) {
            manager.bind(app);
            var style = manager.assetPath('foo.css');
            rimraf.sync(path.join(assets, style));
            request(style, function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(body.trim(), 'body{color:red}');
                assert.equal(assetPath, path.join(assets, 'foo.less'));
                next(done);
            });
        });
    });

    it('should serve up less assets from a subdirectory', function (done) {
        var compilers = {
            '.less': {
                output: '.css'
              , compile: function (path, contents, options, callback) {
                    less.render(contents, callback);
                }
            }
        };
        var assets = path.join(fixtures, 'less-assets')
          , manager = new Ferguson(assets, { compress: true, compilers: compilers });
        mocks(function (app, request, next) {
            manager.bind(app);
            var style = manager.assetPath('css/foo.less');
            rimraf.sync(path.join(assets, style));
            request(style, function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(body.trim(), 'body{color:red}');
                next(done);
            });
        });
    });

    it('should serve up bundles of less assets', function (done) {
        var compilers = {
            '.less': {
                output: '.css'
              , compile: function (path, contents, options, callback) {
                    less.render(contents, callback);
                }
            }
        };
        var assets = path.join(fixtures, 'less-assets')
          , manager = new Ferguson(assets, { compress: true, compilers: compilers });
        mocks(function (app, request, next) {
            manager.bind(app);
            var style = manager.assetPath('styles.css', { include: [ 'foo.css', 'bar.css' ] });
            rimraf.sync(path.join(assets, style));
            request(style, function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(body.trim(), 'body{color:red}a{color:#00f}');
                next(done);
            });
        });
    });

    it('should send a 500 when a compilation error occurs', function (done) {
        var compilers = {
            '.less': {
                output: '.css'
              , compile: function (path, contents, options, callback) {
                    less.render(contents, callback);
                }
            }
        };
        var assets = path.join(fixtures, 'less-assets')
          , manager = new Ferguson(assets, { compress: true, compilers: compilers });
        mocks(function (app, request, next) {
            manager.bind(app);
            var requestError;
            app.use(function (err, request, response, next) {
                requestError = err;
                next = next; //-jshint
                response.send(500);
            });
            var style = manager.assetPath('invalid.css');
            rimraf.sync(path.join(assets, style));
            request(style, function (err, response) {
                assert.ifError(err);
                assert.equal(response.statusCode, 500);
                assert(requestError &&
                    requestError.message.indexOf('Failed to compile file "invalid.less"') >= 0,
                    'Expected a request error when compilation fails');
                next(done);
            });
        });
    });

    it('should be safe to add the middleware to multiple express apps', function (done) {
        var manager = new Ferguson(path.join(fixtures, 'empty'));
        mocks(function (app, request, next) {
            manager.bind(app);
            app.get('/foo.txt', function (request, response) {
                response.send('foo');
            });
            request('/foo.txt', function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(body, 'foo');
                mocks(function (app2, request2, next2) {
                    manager.bind(app2);
                    app2.get('/foo.txt', function (request, response) {
                        response.send('foo');
                    });
                    request2('/foo.txt', function (err, response, body) {
                        assert.ifError(err);
                        assert.equal(response.statusCode, 200);
                        assert.equal(body, 'foo');
                        next2(function () {
                            next(done);
                        });
                    });
                });
            });
        });
    });

    it('should provide helpers for registering compilers and compressors', function (done) {
        var assets = path.join(fixtures, 'less-assets')
          , manager = new Ferguson(assets, { compress: true });
        manager.registerCompiler('.less', '.css', function (path, contents, options, callback) {
            callback(new Error('Oops')); //To be replaced
        });
        manager.registerCompiler('.less', '.css', function (path, contents, options, callback) {
            less.render(contents, callback);
        });
        manager.registerCompressor('.css', function (contents, options, callback) {
            callback(null, contents.replace(/[\n ]/g, '').replace('body', 'h1'));
        });
        mocks(function (app, request, next) {
            manager.bind(app);
            var style = manager.assetPath('foo.css');
            rimraf.sync(path.join(assets, style));
            request(style, function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(body.trim(), 'h1{color:#ff0000;}');
                next(done);
            });
        });
    });

    it('should have an option to wrap Javascript in an IIFE', function (done) {
        var assets = path.join(fixtures, 'simple-assets')
          , manager = new Ferguson(assets, { wrapJavascript: true, compress: true });
        mocks(function (app, request, next) {
            manager.bind(app);
            var ie8 = manager.assetPath('ie8.js', { include: [ 'html5shiv.js', 'respond.js' ] });
            rimraf.sync(path.join(assets, ie8));
            request(ie8, function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(body.trim(), '!function(){window.shiv={},window.respond={}}();');
                next(done);
            });
        });
    });

    it('should only compile assets once, even with multiple concurrent requests', function (done) {
        var assets = path.join(fixtures, 'simple-assets')
          , manager = new Ferguson(assets);
        mocks(function (app, request, next) {
            manager.bind(app);
            var jquery = manager.assetPath('jquery.js');
            rimraf.sync(path.join(assets, jquery));
            var compilations = 0;
            var compile = manager.compileAsset;
            manager.compileAsset = function () {
                compilations++;
                compile.apply(this, arguments);
            };
            var requests = 3
              , complete = false
              , remaining = requests
              , pos = 0;
            while (++pos <= requests) {
                request(jquery, function (err, response, body) {
                    if (complete) {
                        return;
                    } else if (err) {
                        complete = true;
                        throw err;
                    }
                    assert.equal(response.statusCode, 200);
                    assert.equal(response.headers['content-type'], 'application/javascript');
                    assert.equal(body.trim(), 'window.jQuery = {};');
                    if (!--remaining) {
                        assert.equal(compilations, 1);
                        next(done);
                    }
                });
            }
        });
    });

    it('should send 500 to all concurrent requests when compilation fails', function (done) {
        var assets = path.join(fixtures, 'invalid-assets')
          , manager = new Ferguson(assets, { compress: true });
        mocks(function (app, request, next) {
            manager.bind(app);
            var requestErrors = [];
            app.use(function (err, request, response, next) {
                requestErrors.push(err);
                next = next; //-jshint
                response.send(500);
            });
            var jquery = manager.assetPath('invalid.js');
            rimraf.sync(path.join(assets, jquery));
            var compilations = 0;
            var compile = manager.compileAsset;
            manager.compileAsset = function () {
                compilations++;
                compile.apply(this, arguments);
            };
            var requests = 3
              , complete = false
              , remaining = requests
              , pos = 0;
            while (++pos <= requests) {
                request(jquery, function (err, response) {
                    if (complete) {
                        return;
                    } else if (err) {
                        complete = true;
                        throw err;
                    }
                    assert.equal(response.statusCode, 500);
                    if (!--remaining) {
                        assert.equal(compilations, 1);
                        assert.equal(requestErrors.length, 3);
                        next(done);
                    }
                });
            }
        });
    });

    it('should cleanup old assets', function (done) {
        rimraf.sync(temp);
        fs.mkdirSync(temp);
        fs.writeFileSync(path.join(temp, 'jquery.js'), 'var foo');
        var old = path.join(temp, 'asset-12345678-jquery.js');
        fs.writeFileSync(old, '');
        var manager = new Ferguson(temp);
        mocks(function (app, request, next) {
            manager.bind(app);
            var deleted;
            manager.on('delete', function (file) {
                deleted = file;
            });
            var jquery = manager.assetPath('jquery.js');
            request(jquery, function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(body.trim(), 'var foo');
                assert.equal(deleted, 'asset-12345678-jquery.js');
                var files = fs.readdirSync(temp);
                assert.equal(files.length, 3);
                assert.equal(files.indexOf('asset-12345678-jquery.js'), -1);
                jquery = manager.assetPath('jquery.js');
                manager.destroy();
                next(done);
            });
        });
    });

    it('should watch the directory for changes when the hotReload option is set', function (done) {
        rimraf.sync(temp);
        fs.mkdirSync(temp);
        var jquery = path.join(temp, 'jquery.js');
        fs.writeFileSync(jquery, 'var foo');
        var manager = new Ferguson(temp, {
            hotReload: true
        });
        mocks(function (app, request, next) {
            manager.bind(app);
            var compiled = manager.assetPath('jquery.js');
            request(compiled, function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(body.trim(), 'var foo');
                manager.on('change', function () {
                    var updated = manager.assetPath('jquery.js');
                    assert.notEqual(compiled, updated);
                    request(updated, function (err, response, body) {
                        assert.ifError(err);
                        assert.equal(response.statusCode, 200);
                        assert.equal(body.trim(), 'var bar');
                        manager.destroy();
                        next(done);
                    });
                });
                fs.writeFileSync(jquery, 'var bar');
            });
        });
    });

    it('should watch the directory for deletions when the hotReload option is set', function (done) {
        rimraf.sync(temp);
        fs.mkdirSync(temp);
        var jquery = path.join(temp, 'jquery.js');
        fs.writeFileSync(jquery, 'var foo');
        var manager = new Ferguson(temp, {
            hotReload: true
        });
        mocks(function (app, request, next) {
            manager.bind(app);
            var compiled = manager.assetPath('jquery.js');
            request(compiled, function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(body.trim(), 'var foo');
                manager.on('change', function (filename) {
                    if (filename !== 'jquery.js') return;
                    manager.on('error', function (err) {
                        assert.equal(err.message, 'Asset "jquery.js" could not be found');
                        manager.destroy();
                        next(done);
                    });
                    manager.assetPath('jquery.js');
                });
                fs.unlinkSync(jquery);
            });
        });
    });

    it('should watch the directory for additions when the hotReload option is set', function (done) {
        rimraf.sync(temp);
        fs.mkdirSync(temp);
        var jquery = path.join(temp, 'jquery.js');
        fs.writeFileSync(jquery, 'var foo');
        var manager = new Ferguson(temp, {
            hotReload: true
        });
        mocks(function (app, request, next) {
            manager.bind(app);
            var compiled = manager.assetPath('jquery.js');
            request(compiled, function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(body.trim(), 'var foo');
                manager.on('change', function (filename) {
                    if (filename !== 'bootstrap.js') return;
                    var updated = manager.assetPath('bootstrap.js');
                    assert.notEqual(compiled, updated);
                    request(updated, function (err, response, body) {
                        assert.ifError(err);
                        assert.equal(response.statusCode, 200);
                        assert.equal(body.trim(), 'var bar');
                        manager.destroy();
                        next(done);
                    });
                });
                fs.writeFileSync(path.join(temp, 'bootstrap.js'), 'var bar');
            });
        });
    });

    it('should detect new directories when the hotReload option is set', function (done) {
        rimraf.sync(temp);
        rimraf.sync(temp2);
        fs.mkdirSync(temp);
        fs.mkdirSync(temp2);
        var jquery = path.join(temp, 'jquery.js')
          , jquery2 = path.join(temp2, 'jquery.js')
          , css = path.join(temp, 'css');
        fs.writeFileSync(jquery, 'var foo');
        fs.writeFileSync(jquery2, 'var bar');
        var manager = new Ferguson(temp, {
            hotReload: true
        });
        mocks(function (app, request, next) {
            manager.bind(app);
            var compiled = manager.assetPath('jquery.js');
            request(compiled, function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(body.trim(), 'var foo');
                manager.on('change', function (filename) {
                    if (filename !== 'css') return;
                    var asset = manager.assetPath('css/jquery.js');
                    request(asset, function (err, response, body) {
                        assert.ifError(err);
                        assert.equal(response.statusCode, 200);
                        assert.equal(body.trim(), 'var bar');
                        manager.destroy();
                        next(done);
                    });
                });
                fs.renameSync(temp2, css);
            });
        });
    });

});
