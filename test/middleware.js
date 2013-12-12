var assert = require('assert')
  , path = require('path')
  , http = require('http')
  , express = require('express')
  , nunjucks = require('nunjucks')
  , port = 12435;

var AssetManager = require('../lib/assets').AssetManager
  , fixtures = path.join(__dirname, 'fixtures');

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
    callback(app, request, function (done) {
        server.close();
        done();
    });
}

describe('Middleware', function () {

    it('should provide express middleware', function (done) {
        var manager = new AssetManager(path.join(fixtures, 'empty'));
        mocks(function (app, request, next) {
            manager.init(app);
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
        var manager = new AssetManager(path.join(fixtures, 'empty'));
        manager.asset = function () {
            return 'foo';
        };
        mocks(function (app, request, next) {
            manager.init(app);
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

    it('should let users modify the view helper name', function (done) {
        var manager = new AssetManager(path.join(fixtures, 'empty'), {
            viewHelper: 'foobarbaz'
        });
        manager.asset = function () {
            return 'foo';
        };
        mocks(function (app, request, next) {
            manager.init(app);
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
        var manager = new AssetManager(path.join(fixtures, 'simple-assets'));
        mocks(function (app, request, next) {
            manager.init(app);
            request('/jquery.js', function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(response.headers['content-type'], 'application/javascript');
                assert.equal(response.headers['cache-control'], 'public, max-age=0');
                assert.equal(body.trim(), 'window.jQuery = {};');
                next(done);
            });
        });
    });

    it('should serve static assets with a configurable max-age', function (done) {
        var manager = new AssetManager(path.join(fixtures, 'simple-assets'), {
            maxAge: 86400000
        });
        mocks(function (app, request, next) {
            manager.init(app);
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
        var manager = new AssetManager(path.join(fixtures, 'simple-assets'), {
            prefix: '/static'
        });
        mocks(function (app, request, next) {
            manager.init(app);
            request('/static/jquery.js', function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                assert.equal(body.trim(), 'window.jQuery = {};');
                next(done);
            });
        });
    });

});
