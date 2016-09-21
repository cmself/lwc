/*jshint node: true */

'use strict'

const fs = require('fs');
const babel = require('rollup-plugin-babel');
const commonjs = require('rollup-plugin-commonjs');
const uglify = require('rollup-plugin-uglify');
const strip = require('rollup-plugin-strip');
const flow = require('rollup-plugin-flow');
const nodeResolve = require('rollup-plugin-node-resolve');
const replace = require('rollup-plugin-replace');
const rollup = require('rollup');

const isProduction = process.env.NODE_ENV === 'production';

let babelConfig = JSON.parse(fs.readFileSync('src/.babelrc', 'utf8'));
babelConfig.babelrc = false;
babelConfig.presets = babelConfig.presets.map((preset) => {
    return preset === 'es2015' ? 'es2015-rollup' : preset;
});

const plugins = [
    flow(),
    replace({
        DEVELOPMENT: !isProduction
    }),
    babel(babelConfig),
    commonjs({
        sourceMap: true
    })
];

if (isProduction) {
    plugins.push(
        uglify({
            warnings: false
        })
    );
    plugins.push(
        strip({
            debugger: true,
            functions: [ 'console.*', 'assert.*' ],
        })
    );
}

function buildBundle(bundleConfig) {
    return rollup.rollup(bundleConfig.input)
        .then(function(bundle) {
            return bundle.write(bundleConfig.output);
        }).then(() => bundleConfig.output.dest);
}

function buildBundles(configs) {
    const promises = configs.map(buildBundle);
    return Promise.all(promises)
        .then((bundles) => {
            console.log('-> built %d bundles', configs.length)
            return bundles;
        });
}

// eventually this configuration can be generated by resolving
// all components using a glob or something similar.
const configs = [{
    folder: 'src/namespaces/abc/components/bar',
    input: {
        entry: 'src/namespaces/abc/components/bar/bar.js',
        plugins,
    },
    output: {
        dest: 'fake-cdn/bar.js',
        format: 'amd',
        moduleId: 'abc:bar',
        sourceMap: true,
        globals: {
            aura: '$A',
        },
    },
}, {
    folder: 'src/namespaces/abc/components/foo',
    input: {
        entry: 'src/namespaces/abc/components/foo/foo.js',
        plugins,
    },
    output: {
        dest: 'fake-cdn/foo.js',
        format: 'amd',
        moduleId: 'abc:foo',
        sourceMap: true,
        globals: {
            aura: '$A',
        },
    },
}];

// framework configuration
const fwConfig = {
    folder: 'src/framework',
    input: {
        entry: 'src/framework/main.js',
        plugins: plugins.concat(nodeResolve({
            jsnext: true,
        })),
    },
    output: {
        dest: 'fake-cdn/fw.js',
        format: 'umd',
        moduleName: '$A',
        sourceMap: true,
    }
};
// adding the framework as the first config
configs.unshift(fwConfig);

if (!isProduction) {
    console.log('watching...');

    const watch = require('watch');
    const EventEmitter = require('events');
    const watcher = new EventEmitter();

    configs.forEach((bundleConfig) => {
        watch.watchTree(bundleConfig.folder, function onFileChange() {
            buildBundle(bundleConfig)
                .then((dest) => {
                    console.log('-> built [%s] bundle', dest);
                    watcher.emit('rolled');
                })
                .catch((err) => {
                    console.error(err.stack)
                });
        })
    });
} else {
    console.log('building...');

    buildBundles(configs).catch((err) => {
        console.error(err.stack)
    });
}
