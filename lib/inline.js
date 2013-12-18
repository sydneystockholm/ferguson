var format = require('util').format
  , tags = require('./tags')
  , inline = exports;

/**
 * Generate a <script> tag for inline JavaScript.
 *
 * @param {String} content
 * @param {Object} options
 * @param {Object} attributes
 * @return {String} html
 */

inline['.js'] = function (content, options, attributes) {
    if (!options.html5 && !('type' in attributes)) {
        attributes.type = 'text/javascript';
    }
    return format('<script%s>%s</script>',
        tags.stringify(attributes, options), content);
};

/**
 * Generate a <style> tag for inline CSS.
 *
 * @param {String} content
 * @param {Object} options
 * @param {Object} attributes
 * @return {String} html
 */

inline['.css'] = function (content, options, attributes) {
    if (!options.html5 && !('type' in attributes)) {
        attributes.type = 'text/css';
    }
    return format('<style%s>%s</style>',
        tags.stringify(attributes, options), content);
};
