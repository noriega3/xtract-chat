module.exports = {
	/**
	 * Application configuration section
	 * http://pm2.keymetrics.io/docs/usage/application-declaration/
	 */
	apps: [
		{
			name: 'pubsub-server',
			//cwd : "/srv/pubSub",
			script: './pubsub_server.js',
			max_memory_restart: '500M',
			ignore_watch : ["[\\/\\\\]\\./", "ecosystem.config.js","node_modules","logs"],
			exec_mode: "cluster",
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
			min_uptime: 1000,
			max_restarts: 10,
			wait_ready: true,
			node_args: "--trace-warnings --harmony --max_old_space_size=800 --nouse-idle-notification --inspect",
			env: {
				DEBUG_COLORS: true,
				DEBUG_HIDE_DATE: true,
				NODE_ENV: "development",
				DEBUG: "*,-not_this,-ioredis:*,-bull",
				NODE_DEBUG: "*,-not_this,-ioredis:*,-bull",
				PM2_GRACEFUL_LISTEN_TIMEOUT: 4000,
				VERSION:2,
				SERVER_NAME:'blue',
				TCP_CLIENT_BUFFER_SIZE:8192,
				TCP_SERVER_PORT:7776,
				HTTP_SERVER_PORT:8080,
				HTTP_API_PATH:'/api/v1',
				WS_SERVER_SIMULATOR_PORT:8083,
				WS_CLIENT_SIMULATOR_PATH:'/webclient',
				WS_SERVER_CONNECTOR_PORT:8084,
				WS_CLIENT_CONNECTOR_PATH:'/ws',
				REDIS_DEFAULT:{"host":"localhost","port": 6379,"db": 0,"password": ""},
				REDIS_SUBSCRIBER:{"host":"localhost","port": 6379,"db": 0,"password": "","connectionName": "subscriber","showFriendlyErrorStack": true},
				REDIS_CLIENT:{"host":"localhost","port": 6379,"db": 0,"password": "","connectionName": "client","showFriendlyErrorStack": true},
				BULL_CLIENT:{"host":"localhost","port": 6379,"db": 0,"password": "","connectionName": "bull","showFriendlyErrorStack": true},
				SETTINGS_CLIENT:{"host":"localhost","port": 6379,"db": 1,"password": "","connectionName": "settings","showFriendlyErrorStack": true},

			},
			env_staging: {
				NODE_ENV: "staging",
			},
			env_production: {
				NODE_ENV: "production",
			}
		},
		{
			name: 'http-server',
			//cwd : "/srv/pubSub",
			script: './http_server.js',
			max_memory_restart: '100M',
			log_type: "json",
			ignore_watch : ["[\\/\\\\]\\./", "node_modules", "logs"],
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
			min_uptime: 1000,
			max_restarts: 10,
			wait_ready: true,
			node_args: "--trace-warnings --harmony --max_old_space_size=500",
			env: {
				DEBUG_COLORS: true,
				DEBUG_HIDE_DATE: true,
				NODE_ENV: "development",
				DEBUG: "*,-not_this,-ioredis:redis,-express:*,-body-parser:*",
				PM2_GRACEFUL_LISTEN_TIMEOUT: 4000,
				VERSION:2,
				SERVER_NAME:'blue',
				TCP_CLIENT_BUFFER_SIZE:8192,
				TCP_SERVER_PORT:7776,
				HTTP_SERVER_PORT:8080,
				HTTP_API_PATH:'/api/v1',
				WS_SERVER_SIMULATOR_PORT:8083,
				WS_CLIENT_SIMULATOR_PATH:'/webclient',
				WS_SERVER_CONNECTOR_PORT:8084,
				WS_CLIENT_CONNECTOR_PATH:'/ws',
				REDIS_DEFAULT:{"host":"localhost","port": 6379,"db": 0,"password": ""},
				REDIS_SUBSCRIBER:{"host":"localhost","port": 6379,"db": 0,"password": "","connectionName": "subscriber","showFriendlyErrorStack": true},
				REDIS_CLIENT:{"host":"localhost","port": 6379,"db": 0,"password": "","connectionName": "client","showFriendlyErrorStack": true},
				BULL_CLIENT:{"host":"localhost","port": 6379,"db": 0,"password": "","connectionName": "bull","showFriendlyErrorStack": true},
				SETTINGS_CLIENT:{"host":"localhost","port": 6379,"db": 1,"password": "","connectionName": "settings","showFriendlyErrorStack": true},

			},
			env_staging: {
				NODE_ENV: "staging",
			},
			env_production: {
				NODE_ENV: "production",
			}
		},
		{
			name: 'dashboard-connector',
			max_memory_restart: '400M',
			script: './dashboard-connector-server.js',
			ignore_watch : ["[\\/\\\\]\\./", "ecosystem.config.js","node_modules","logs"],
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
			min_uptime: 1000,
			max_restarts: 10,
			wait_ready: true,
			node_args: "--harmony --max_old_space_size=500 --nouse-idle-notification",
			env: {
				DEBUG_COLORS: true,
				DEBUG_HIDE_DATE: true,
				NODE_ENV: "development",
				DEBUG: "*,-not_this,-ioredis:*",
				PM2_GRACEFUL_LISTEN_TIMEOUT: 4000,
				VERSION:2,
				SERVER_NAME:'blue',
				TCP_CLIENT_BUFFER_SIZE:8192,
				TCP_SERVER_PORT:7776,
				HTTP_SERVER_PORT:8080,
				HTTP_API_PATH:'/api/v1',
				WS_SERVER_SIMULATOR_PORT:8083,
				WS_CLIENT_SIMULATOR_PATH:'/webclient',
				WS_SERVER_CONNECTOR_PORT:8084,
				WS_CLIENT_CONNECTOR_PATH:'/ws',
				REDIS_DEFAULT:{"host":"localhost","port": 6379,"db": 0,"password": ""},
				REDIS_SUBSCRIBER:{"host":"localhost","port": 6379,"db": 0,"password": "","connectionName": "subscriber","showFriendlyErrorStack": true},
				REDIS_CLIENT:{"host":"localhost","port": 6379,"db": 0,"password": "","connectionName": "client","showFriendlyErrorStack": true},
				BULL_CLIENT:{"host":"localhost","port": 6379,"db": 0,"password": "","connectionName": "bull","showFriendlyErrorStack": true},
				SETTINGS_CLIENT:{"host":"localhost","port": 6379,"db": 1,"password": "","connectionName": "settings","showFriendlyErrorStack": true},

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
