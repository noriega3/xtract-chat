import { createStore, applyMiddleware, combineReducers } from 'redux'
import { persistReducer, persistStore } from 'redux-persist'
import { loadingBarMiddleware } from 'react-redux-loading-bar'
import storage from 'redux-persist/lib/storage'
import { createFilter } from 'redux-persist-transform-filter'

//middleware to store
import thunk from 'redux-thunk'
import logger from 'redux-logger'
import websocket from '../middleware/websocket'
import wsStart, { createWsMiddleware } from '../middleware/socketio-client'
import { connectRouter, routerMiddleware } from 'connected-react-router' //react-router-redux is now deprecated
import createApiMiddleware from '../middleware'
import { composeWithDevTools } from 'redux-devtools-extension'
import rootReducer from '../reducers'

const persistedFilter = createFilter('auth', ['access', 'refresh'])
const persistConfig = {
	key: 'polls',
	storage,
	whitelist: ['auth'],
	transforms: [persistedFilter]
}

const middlewareList = [createApiMiddleware, routerMiddleware(history), thunk, websocket, loadingBarMiddleware(), createWsMiddleware(), logger]

const persistedReducer = persistReducer(persistConfig,rootReducer)

export default function configureStore(history) {
	let store = createStore(
		connectRouter(history)(persistedReducer),
		composeWithDevTools(applyMiddleware(...middlewareList))
	)
	let persistor = persistStore(store)

	if (module.hot) {
		// Enable Webpack hot module replacement for reducers
		module.hot.accept('../reducers', () => {
			store.replaceReducer(connectRouter(history)(persistedReducer))
		})
	}
	wsStart(store)

	return {store, persistor}
}
