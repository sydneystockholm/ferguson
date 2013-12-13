var format = require('util').format
  , entities = require('entities')
  , tags = exports;

tags['.js'] = function (url, options, attributes) {
    if (!options.html5 && !('type' in attributes)) {
        attributes.type = 'text/javascript';
    }
    return format('<script src="%s"%s></script>',
        url, tags.stringify(attributes, options));
};

tags['.css'] = function (url, options, attributes) {
    attributes.rel = attributes.rel || 'stylesheet';
    return format('<link href="%s"%s />',
        url, tags.stringify(attributes, options));
};

tags['.ico'] = function (url, options, attributes) {
    attributes.rel = attributes.rel || 'shortcut icon';
    return format('<link href="%s"%s />',
        url, tags.stringify(attributes, options));
};

function image(url, options, attributes) {
    return format('<img src="%s"%s />',
        url, tags.stringify(attributes, options));
}

['.jpg', '.jpeg', '.gif', '.png', '.bmp', '.svg'].forEach(function (ext) {
    tags[ext] = image;
});

tags.stringify = function (attributes, options) {
    var level = options.html5 ? 2 : 1;
    return Object.keys(attributes).sort().reduce(function (accumulator, key) {
        var attribute = format(' %s="%s"', key, entities.encode(attributes[key], level));
        return accumulator + attribute;
    }, '');
};
