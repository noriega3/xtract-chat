//TODO: change all .jsx to .js (https://github.com/facebookincubator/create-react-app/issues/87#issuecomment-234627904)

//TODO: change components to use the cleaner ES7/ES6 combo.
// https://reactjs.org/docs/typechecking-with-proptypes.html#default-prop-values
// though could break in certain plugins due to possible auto binding problems (https://hackernoon.com/writing-clean-and-concise-react-components-by-making-full-use-of-es6-7-features-and-the-container-4ba0473b7b01

//css
import './styles/normalize.css'
import './styles/main.css'
import 'react-virtualized/styles.css'
import 'react-toastify/dist/ReactToastify.css';
import './styles/custom.scss'

//react
import React from 'react'
import ReactDOM from 'react-dom'
import { AppContainer } from 'react-hot-loader'
import { createBrowserHistory } from 'history'
import { ToastContainer } from 'react-toastify'

//main 'App' component
import App from './scripts/components/App.js'
import configureStore from './scripts/store'
import { ConnectedRouter } from 'connected-react-router'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'

const appRoot = document.getElementById('content')

import {Route, Switch} from 'react-router-dom'
import Login from './scripts/containers/Login';
import PrivateRoute from './scripts/containers/PrivateRoute';
/*
import {
	BrowserRouter as Router,
} from 'react-router-dom'
*/


if (process.env.NODE_ENV !== 'production') {
	localStorage.setItem('debug', '*');
}

const history = createBrowserHistory({
	basename: '',             // The base URL of the app (see below)
	forceRefresh: false,      // Set true to force full page refreshes
	keyLength: 6,             // The length of location.key
	// A function to use to confirm navigation with the user (see below)
	getUserConfirmation: (message, callback) => callback(window.confirm(message))
})
const {store, persistor} = configureStore(history)

//Wrap the original 'App' component renderer for hot reloading
const render = (Component) => {
	ReactDOM.render(
			<AppContainer>
				<Provider store={store}>
					<PersistGate loading={<div />} persistor={persistor}>
					<ConnectedRouter history={history}>
						<React.Fragment>
							<ToastContainer />
							<Switch>
								<Route exact path="/login/" component={Login} />
								<PrivateRoute path="/" component={Component}/>
							</Switch>
						</React.Fragment>
					</ConnectedRouter>
					</PersistGate>
				</Provider>
			</AppContainer>,
		appRoot
	);
}

render(App)

// Webpack Hot Module Replacement API
if (module.hot) {
	module.hot.accept('./scripts/components/App', () => {
		//const NextApp = require('./scripts/components/App.js').default
		render(App)
	})
}
