import React from 'react'
import ReactDOM from 'react-dom'
import { AppContainer } from 'react-hot-loader'

//css
import './styles/main.css'
import 'react-virtualized/styles.css'

import App from './scripts/components/App'

const render = Component => {
	ReactDOM.render(
		<AppContainer>
			<Component />
		</AppContainer>,
		document.getElementById('content')
	);
}

render(App)

// Webpack Hot Module Replacement API
if (module.hot) {
	module.hot.accept('./scripts/components/App', () => {
		const NextApp = require('./scripts/components/App')
		render(NextApp)
	})
}
