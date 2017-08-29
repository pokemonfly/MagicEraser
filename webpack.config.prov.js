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
                test: /\.js[x]?$/,
                loaders: ['babel?cacheDirectory=true'],
                exclude: path.join( rootPath, 'node_modules' )
            }, {
                test: /\.json$/,
                loader: 'json'
            }, {
                test: /\.html$/,
                loader: 'html'
            }
        ]
    },
    plugins: [
        // new webpack.optimize.DedupePlugin( ), new webpack.optimize.UglifyJsPlugin({     compress: {         warnings: false     } }), new
        // webpack.optimize.OccurenceOrderPlugin( )
    ],
    externals: {
        'jquery': 'window.jquery'
    }
};
