const webpack = require( 'webpack' );
const path = require( 'path' );

const rootPath = path.resolve( __dirname, '..' );
module.exports = {
    entry: "./src/app.js",
    output: {
        path: path.resolve( __dirname, "dist" ),
        filename: 'magicEraser.js',
        publicPath: '/dist/'
    },
    resolve: {
        alias: {},
        extensions: [ '', '.js', '.jsx', '.json' ]
    },
    module: {
        loaders: [
            {
                test: /\.js$/,
                loader: 'babel',
                exclude: /(node_modules|bower_components)/,
                query: {
                    presets: [
                        [
                            "es2015", {
                                "loose": true
                            }
                        ],
                        "stage-0"
                    ],
                    plugins: [ "add-module-exports" ]
                }
            }, {
                test: /\.css$/,
                loader: 'style-loader!css-loader'
            }, {
                test: /\.json$/,
                loader: 'json'
            }, {
                test: /\.scss$/,
                loader: 'css-loader!sass-loader'
            }, {
                test: /\.html$/,
                loader: 'html-loader'
            }
        ]
    },
    externals: {
        'jquery': 'window.jquery'
    },
    devServer: {
        port: 12345
    }
};
