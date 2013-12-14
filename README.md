**Ferguson** is a highly-configurable asset manager for node.js with the following features

- Framework-agnostic compilation and compression
- Hot-reloading
- Cache-busting
- Asset bundles

## Overview

Install the library with npm

```bash
$ npm install ferguson
```

Setup a ferguson instance and bind it to an [express][express] application

```javascript
var ferguson = require('ferguson');

var assetManager = ferguson('/path/to/assets', options);

assetManager.init(app);
```

Your templates now have access to a view helper

```html
{{ asset('favicon.ico') }}
<!--[if lt IE 9]>
  {{ asset('js/ie8.js', { include: ['js/html5shiv.js', 'js/respond.js'] });
<![endif]-->
{{ asset('css/styles.less') }}
```

which generates something like

```html
<link rel="shortcut icon" href="/asset-a2029888991a8a83-favicon.ico" />
<!--[if lt IE 9]>
  <script src="/js/asset-0ba08226c3bd0e46-ie8.js" type="text/javascript"></script>
<![endif]-->
<link rel="stylesheet" href="/css/asset-b5d5d67465f661c1-styles.css" />
```

Assets are compiled and compressed on demand. Compiled asset filenames only change when one of the included assets is modified, i.e. they're safe to cache forever.

Adding your own formats is easy

```javascript
var stylus = require('stylus');
assetManager.registerCompiler('.styl', '.css', function (str, options, callback) {
    stylus.render(str, callback);
});
```

Now you can call `asset('css/foo.styl')` to generate a `<link>` tag that references a compiled CSS asset.

## Options

The following options are available when creating a new ferguson instance with `ferguson(dir, options)`

- **hash** (default: `md5`) - the hashing algorithm to use.
- **hashLength** (default: `16`) - the maximum length of the hash in the filenames of compiled assets.
- **viewHelper** (default: `asset`) - the name of the view helper.
- **servePrefix** (default: `/`) - the path to serve assets from.
- **urlPrefix** (default: `null`) - prefix asset URLs with this.
- **maxAge** (default: `2419200000` - 4 weeks) - the *Cache-Control* *max-age* value (in milliseconds).
- **compress** (default: `false`) - whether to compress assets.
- **hotReload** (default: `false`) - whether to enable hot-reloading of assets.
- **wrapJavascript** (default: `false`) - whether to wrap compiled JS in an IIFE.
- **separateBundles** (default: `false`) - generate separate tags for each asset in a bundle.
- **html5** (default: `false`) - generate HTML5-compatible tags, e.g. omit the *type* attribute from a `<script>` tag.

The following setup is recommended

```javascript
var production = process.env.NODE_ENV === 'production';
var assetManager = ferguson('/path/to/assets', {
    compress: production
  , hotReload: !production
  , separateBundles: !production
});
```

## Asset Definitions

The following options are available when defining an asset with `asset(file, options)`

- **include** - one or more files that make up the asset bundle. Glob is supported.
- **urlPrefix** - prefix the asset URL with this. This overrides the library's `urlPrefix` option.
- **attributes** - an object containing additional HTML attributes.
- **dependencies** - one or more files that ferguson should take into account when generating cache-busting hashes (see the Compilers section below for an explanation). Glob is supported.

Here's an example definition

```
{{ asset('foo.jpg', { attributes: { alt: 'Foo & bar' }, urlPrefix: 'http://example.com' }) }}
```

which generates

```html
<img src="http://example.com/asset-d3b07384d113edec-foo.jpg" alt="Foo &amp; bar" />
```

There are two variations of the view helper: one to output the asset's path and another to output the asset's full URL (if you've provided a `urlPrefix`)

```html
<script type="text/javascript" src="{{ asset.url('foo.js') }}"></script>
<script type="text/javascript" src="//example.com{{ asset.path('foo.js') }}"></script>
```

It's also possible to define assets when you create a ferguson instance

```javascript
var assetManager = ferguson('/path/to/assets');

assetManager.asset('ie8.js', { include: ['html5shiv.js', 'respond.js'] });
```

Once defined, assets can be referenced by name, i.e. you don't need to specify the options each time

```html
{{ asset('ie8.js') }}
```

## Caching

Ferguson generates a cache-busting hash based on the contents of each included asset. This means that the compiled assets are safe to cache indefinitely. Any modifications to your assets will cause the hash (and filename) to change, forcing clients to re-download the asset. The library will automatically cleanup old compiled assets.

Ferguson will write the compiled assets to the static assets directory that you specify. This allows you to serve up raw and compiled assets from the same place. For example, it allows nginx users to use a `try_files` to serve up all assets directly.

Ferguson keeps an index (filename, hash, mtime) of each file in your static assets directory. The index is persisted across restarts using a manifest file, `.asset-manifest`. This reduces the amount of hashing required; assets are only hashed when a modification or new file is detected.

If your static assets live in a folder named `static` then you might want to add the following two lines to your `.gitignore`

```
static/.asset-manifest
static/**/asset-*
```

## Compilers

Ferguson does not ship with any compilers since it's trivial to add your own

```javascript
var less = require('less');
assetManager.registerCompiler('.less', '.css', function (str, options, callback) {
    less.render(str, callback);
});
```

Since ferguson is framework-agnostic, there are some cases where you will need to manually specify an asset's dependencies. For example, [less][less] allows you to `@import` a file and [browserify][browserify] allows you to `require()` a file. In order to generate a correct cache-busting hash, ferguson needs to know about these imports, since the hash is based on the contents of the final compiled asset.

Let's say you have a file called `style.less` which `@import`'s a `variables.less`. You'll need to define your asset like so

```html
{{ asset('style.less', { dependencies: ['variables.less'] }) }}
```

Ferguson will generate the cache-busting hash based on the contents of both `style.less` and `variables.less`. Without specifying the dependency, only updates to `style.less` would cause a new hash to be generated.

A lazy way to specify dependencies is to use a glob pattern that matches everything

```html
{{ asset('style.less', { dependencies: '**/*.less' }) }}
```

## Compressors

Ferguson ships with a JS minifier ([uglifyjs][uglifyjs]) and CSS compressor ([clean-css][clean-css]) which are both enabled when the `compress` option is true.

You can add additional compressors or override an existing one

```javascript
var yui = require('yuicompressor');
assetManager.registerCompressor('.js', function (str, options, callback) {
    yui.compress(str, options, callback);
});
```

## Tag Formats

Ferguson knows how to generate HTML tags for `css`, `js`, `ico`, `jpg`, `gif`, `png`, `svg` and `bmp` assets.

You can add and override tag formats if necessary

```javascript
assetManager.registerTagFormat('.js', function (url, options, attributes) {
    return '<custom-tag src="' + url + '" />';
})
```

Alternatively, you could use the `asset.url()` view helper to output the asset URL directly

```html
<custom-tag src="{{ asset.url('foo.js') }}" />
```

## Error Handling

The ferguson instance is an event emitter and will emit `error` events when something goes wrong

```javascript
assetManager.on('error', function (err) {
	//handle error
})
```

## Multi-process Environments

Ferguson doesn't know how to serve up compiled assets until they are defined. If you plan on using the [cluster][cluster] module, there's a chance that only one process could render a template which contains the asset definition. If another process in the cluster gets a request for the compiled asset and a cached copy doesn't exist, then it won't know what to do since only the process that defines the asset knows how to compile it.

The solution is to define your assets when you initialise the library. That way, all processes in the cluster will see the definition

```javascript
var assetManager = ferguson('/path/to/assets');

assetManager.asset('ie8.js', { include: ['html5shiv.js', 'respond.js'] });
```

## Developers

The test suite can be run with

```bash
$ make test
```

To increase verbosity use `V=1 make test`. To run a subset of tests use `TEST=<pattern> make test`

To run coverage analysis and view a HTML report

```bash
$ make coverage-html
```

To run the lint tool

```bash
$ make lint
```

## License (MIT)

Copyright (c) 2013 Sydney Stockholm <opensource@sydneystockholm.com>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


[express]: https://github.com/visionmedia/express
[uglifyjs]: https://github.com/mishoo/UglifyJS2
[clean-css]: https://github.com/GoalSmashers/clean-css
[cluster]: http://nodejs.org/api/cluster.html
[less]: https://github.com/less/less.js/
[browserify]: https://github.com/substack/node-browserify
