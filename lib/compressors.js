var uglify = require('uglify-js')
  , CleanCSS = require('clean-css')
  , compressors = exports;

/**
 * Minifier singletons.
 */

var cssMinifier = new CleanCSS({ processImport: false })
  , jsMinifier = uglify.Compressor();

/**
 * Minify and obfuscate a JavaScript asset.
 *
 * @param {String} contents
 * @param {Object} options
 * @param {Function} callback
 */


compressors['.js'] = function (contents, options, callback) {
    try {
        var ast = uglify.parse(contents, options.parser);
        ast.figure_out_scope();
        var compressed_ast = ast.transform(jsMinifier);
        compressed_ast.figure_out_scope();
        compressed_ast.compute_char_frequency();
        compressed_ast.mangle_names();
        var output = uglify.OutputStream(options.output);
        compressed_ast.print(output);
        callback(null, output.toString());
    } catch (err) {
        callback(err);
    }
};

/**
 * Compress a CSS stylesheet.
 *
 * @param {String} contents
 * @param {Object} options
 * @param {Function} callback
 */

compressors['.css'] = function (contents, options, callback) {
    callback(null, cssMinifier.minify(contents));
};
