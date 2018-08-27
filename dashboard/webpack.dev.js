const webpack = require('webpack')
const common = require('./webpack.common.js')
const merge = require('webpack-merge')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const path = require('path')

module.exports = merge(common, {
	mode: 'development',
	devtool: 'source-map',
	entry: [
		'react-hot-loader/patch',
		'./src/index.js'
	],
	devServer:{
		contentBase : './dist',
		host: '0.0.0.0',
		port: 8081,
		hot: true,
		historyApiFallback: true,
		inline: true,
		proxy: {
			"/api": "http://0.0.0.0:6656",
		}
	},
	module: {
		rules: [
			{
				test: /\.scss$/,
				use: [
					'style-loader',
					'css-loader',
					'sass-loader',
				],
			},
			{
				test: /\.css$/,
				use: [
					'style-loader',
					'css-loader'
				],
			},
		]
	},
	plugins: [
		new webpack.NamedModulesPlugin(),
		new webpack.HotModuleReplacementPlugin(),
		new HtmlWebpackPlugin({
			template: path.resolve(__dirname, 'public/') + '/index.html',
			filename: 'index.html'
		})
	]
})
