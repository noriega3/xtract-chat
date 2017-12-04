module.exports = {
	/**
	 * Application configuration section
	 * http://pm2.keymetrics.io/docs/usage/application-declaration/
	 */
	apps: [
		{
			name: 'pubsub-server',
			script: './pubsub_server.js',
			ignore_watch : ["node_modules", "logs"],
			exec_mode: "fork",
			log_type: "json",
			error_file: "err.log",
			out_file: "out.log",
			merge_logs: true,
			log_date_format: "YYYY-MM-DD HH:mm:ss Z",
			instances: 1,
			autorestart: true,
			kill_timeout: 4000,
			restart_delay: 3000,
			listen_timeout: 4000,
			max_restarts: 10,
			vizion: false,
			wait_ready: true,
			node_args: ["--harmony", "--max_old_space_size=500", "--nouse-idle-notification"],
			env: {
				DEBUG_COLORS: false,
				DEBUG_HIDE_DATE: true,
				NODE_ENV: "development",
				NODE_DEBUG: "*,-not_this,-ioredis:*",
				DEBUG: "*,-not_this,-ioredis:*",
				PM2_GRACEFUL_LISTEN_TIMEOUT: 4000,
			},
			env_staging: {
				NODE_ENV: "staging",
				PORT: 8888
			},
			env_production: {
				NODE_ENV: "production",
				PORT: 7777
			}
		},
		{
			name: 'reservation-server',
			script: './reservation_server.js',
			log_type: "json",
			ignore_watch : ["node_modules", "logs"],
			exec_mode: "cluster",
			error_file: "err.log",
			out_file: "out.log",
			merge_logs: true,
			log_date_format: "YYYY-MM-DD HH:mm:ss Z",
			instances: 1,
			autorestart: true,
			kill_timeout: 4000,
			restart_delay: 3000,
			listen_timeout: 4000,
			max_restarts: 10,
			vizion: false,
			wait_ready: true,
			node_args: ["--harmony", "--max_old_space_size=500"],
			env: {
				DEBUG_COLORS: false,
				DEBUG_HIDE_DATE: true,
				NODE_ENV: "development",
				NODE_DEBUG: "bull",
				DEBUG: "*,-not_this,-ioredis:redis,-express:*,-body-parser:*",
				PM2_GRACEFUL_LISTEN_TIMEOUT: 4000,
				PORT: 8080
			},
			env_staging: {
				NODE_ENV: "staging",
				PORT: 6655
			},
			env_production: {
				NODE_ENV: "production",
				PORT: 1010
			}
		},
		{
			name: 'websocket-server',
			script: './websocket_server.js',
			ignore_watch : ["node_modules", "logs"],
			exec_mode: "cluster",
			log_type: "json",
			error_file: "err.log",
			out_file: "out.log",
			merge_logs: true,
			log_date_format: "YYYY-MM-DD HH:mm:ss Z",
			autorestart: true,
			kill_timeout: 4000,
			restart_delay: 3000,
			listen_timeout: 4000,
			max_restarts: 10,
			vizion: false,
			wait_ready: true,
			node_args: ["--harmony", "--max_old_space_size=500", "--nouse-idle-notification"],
			env: {
				DEBUG_COLORS: false,
				DEBUG_HIDE_DATE: true,
				NODE_ENV: "development",
				NODE_DEBUG: "*,-not_this,-ioredis:*",
				DEBUG: "*,-not_this,-ioredis:*",
				PM2_GRACEFUL_LISTEN_TIMEOUT: 4000,
			},
			env_staging: {
				NODE_ENV: "staging",
			},
			env_production: {
				NODE_ENV: "production",
			}
		},
		{
			name: 'redsmin-connector',
			script: 'redsmin',
			exec_mode: "cluster",
			autorestart: true,
			log_type: "json",
			error_file: "redsmin-err.log",
			out_file: "redsmin-out.log",
			merge_logs: true,
			log_date_format: "YYYY-MM-DD HH:mm Z",
			kill_timeout: 4000,
			restart_delay: 3000,
			max_restarts: 10,
			vizion: false,
			instances: 1,
			env: {
				NODE_ENV: "development",
				REDSMIN_KEY: "xxx", //TODO: change
				REDIS_AUTH: "xxx" //TODO: change
			},
			env_staging: {
				NODE_ENV: "staging",
			},
			env_production: {
				NODE_ENV: "production",
			}
		}
	],

	/**
	 * Deployment section
	 * http://pm2.keymetrics.io/docs/usage/deployment/
	 */
/*	deploy: {
		production: {
			user: 'node',
			host: '212.83.163.1',
			ref: 'origin/master',
			repo: 'git@github.com:repo.git',
			path: '/var/www/production',
			'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
		},
		dev: {
			user: 'node',
			host: '212.83.163.1',
			ref: 'origin/master',
			repo: 'git@github.com:repo.git',
			path: '/var/www/development',
			'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env dev',
			env: {
				NODE_ENV: 'dev'
			}
		}
	}*/
};
