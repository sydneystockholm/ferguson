var uglify = require('uglify-js')
  , CleanCSS = require('clean-css')
  , compressors = exports;

/**
 * Minifier singletons.
 */

var cssCompressor = new CleanCSS({ processImport: false })
  , jsCompressor = uglify.Compressor();

/**
 * Minify and obfuscate a JavaScript asset.
 *
 * @param {Buffer} buffer
 */

compressors['.js'] = function (buffer) {
    var ast = uglify.parse(buffer.toString());
    ast.figure_out_scope();
    var compressed_ast = ast.transform(jsCompressor);
    compressed_ast.figure_out_scope();
    compressed_ast.compute_char_frequency();
    compressed_ast.mangle_names();
    var output = uglify.OutputStream();
    compressed_ast.print(output);
    return output.toString();
};

/**
 * Compress a CSS stylesheet.
 *
 * @param {Buffer} buffer
 */

compressors['.css'] = function (buffer) {
    return cssCompressor.minify(buffer.toString());
};
