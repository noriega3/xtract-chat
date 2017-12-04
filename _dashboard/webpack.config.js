const path = require('path');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const webpack = require('webpack');

module.exports = {
    //devtool: 'cheap-module-eval-source-map',
    devtool: 'cheap-source-map',
	devServer:{
		historyApiFallback: true, //When using BrowserRouter , you need to add historApiFallback: true in your webpack.
		contentBase: './devserver_files',
		hot: true,
		inline: true,
	},
    entry: [
		'react-hot-loader/patch',
		'./source/main'
    ],
	plugins: [
		new CleanWebpackPlugin(['build']),
		//new webpack.optimize.ModuleConcatenationPlugin(),
		new webpack.HotModuleReplacementPlugin()
	],
    output: {
		path: path.resolve(__dirname, 'build'),
        filename: 'bundle.js'
    },
    module: {
        rules: [
            // babel is configured in `.babelrc`
            {
            	test: /\.js$/,
				loader: 'babel-loader',
				exclude: path.resolve(__dirname, 'node_modules/')
			},
            {
            	test: /\.css/,
				use: ['style-loader', 'css-loader']
			},
            {
            	test: /\.png/,
				loader: 'url-loader',
				options: {
            		limit: 1000,
					mimetype: 'image/png'
				}
			},
            {
            	test: /\.gif/,
				loader: 'url-loader',
				options: {
            		limit: 1000,
					mimetype: 'image/gif'
				}
			},
            {
            	test: /\.jpg/,
				loader: 'file-loader'
            }
        ]
    }
};
