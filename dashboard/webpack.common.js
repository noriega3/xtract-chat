const path = require('path')
const Dotenv = require('dotenv-webpack')

module.exports = {
	entry: {
		app: './src/index.js'
	},
	resolve: {
		extensions: ['.js', '.jsx']
	},
	output: {
		filename: '[name].bundle.js',
		path: path.resolve(__dirname, 'dist'),
		publicPath: "/"
	},
	plugins: [
		new Dotenv()
	],
	module: {
		rules: [
			// babel is configured in `.babelrc`
			{
				test: /\.jsx?$/,
				exclude: path.resolve(__dirname, 'node_modules/'),
				use: {
					loader: 'babel-loader',
					options: {
						cacheDirectory: true,
						compact: true
					}
				}
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
}
