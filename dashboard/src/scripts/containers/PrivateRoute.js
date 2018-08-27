import React from 'react'
import { Route, Redirect } from 'react-router-dom'
import { connect } from 'react-redux'
import * as reducers from '../reducers'
import PropTypes from 'prop-types'

const PrivateRoute = ({ component: Component, isAuthenticated, ...rest }) => (
	<Route {...rest} render={props => {
		console.log(props)
		if(isAuthenticated){
			return (<Component {...props}/>)
		} else {
			return (<Redirect to={{pathname: '/login', state: {from: props.location}}}/>)
		}
	}}/>
)

PrivateRoute.defaultProps = {}
PrivateRoute.propTypes = {
	location: PropTypes.object,
	component: PropTypes.any,
	isAuthenticated: PropTypes.bool,
}

const mapStateToProps = (state) => ({
	isAuthenticated: reducers.isAuthenticated(state)
})
export default connect(mapStateToProps, null)(PrivateRoute);
