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
            response.send(nunjucks.renderString(template, {
                asset: response.locals.asset
            }));
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
            app.use(manager.middleware());
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

    it('should serve the same middleware function on each invocation of middleware()', function () {
        var manager = new AssetManager(path.join(fixtures, 'empty'))
          , middleware = manager.middleware();
        middleware._id_ = 'foo';
        assert.equal(manager.middleware()._id_, 'foo');
    });

    it('should provide a view helper for defining assets', function (done) {
        var manager = new AssetManager(path.join(fixtures, 'empty'));
        mocks(function (app, request, next) {
            app.use(manager.middleware());
            app.get('/', function (request, response) {
                response.render('{{ asset("foo.css") }}');
            });
            request('/', function (err, response, body) {
                assert.ifError(err);
                assert.equal(response.statusCode, 200);
                next(done);
            });
        });
    });

});
