import PropTypes from 'prop-types'
import React, {Component} from 'react'
import _ from 'lodash'

import Panel from 'muicss/lib/react/panel'
import Button from 'muicss/lib/react/button'
import { connect } from 'react-redux'
import {logout} from '../actions/apiAuthActions'
import {refreshToken, authErrors, apiBusy} from '../reducers'

class Logout extends Component {

	constructor(props){
		super(props)
		this.state = {
			lastLogout: Date.now(),
			showRetry: false
		}
	}

	componentDidMount(){
		this.setState({forceLogout: true}, this.requestLogout)
	}

	componentDidUpdate(prevProps, prevState){
		if(!_.isEqual(prevProps.rToken, this.props.rToken) && _.isEmpty(this.props.authErrors))
			this.requestLogout()
		else if(!_.isEqual(prevState.showRetry, this.state.showRetry) && _.isEqual(this.state.showRetry, false))
			this.setState({showRetry: true})
	}

	componentWillUnmount(){
		console.log('will unmount')
	}

	requestLogout(e){
		if(_.has(e, 'preventDefault')) e.preventDefault()
		if(this.props.rToken)
			this.props.sendLogout({rtk: this.props.rToken})
	}

	render() {
		return (
			<Panel>
				<div className="mui--text--title">Logging You Out.</div>
				{this.state.showRetry && <Button color={"primary"} disabled={this.props.processing} onClick={(e) => this.requestLogout(e)}>Retry</Button>}
			</Panel>
		)
	}
}

Logout.defaultProps = {}
Logout.propTypes = {
	dispatch: PropTypes.func,
	sendLogout: PropTypes.func,
	rToken: PropTypes.string,
	authErrors: PropTypes.object,
	processing:PropTypes.bool
}

const mapStateToProps = state => ({
	rToken: refreshToken(state),
	authErrors: authErrors(state),
	processing: apiBusy(state)
})

const mapDispatchToProps = {
	sendLogout: logout
}
export default connect(mapStateToProps,mapDispatchToProps)(Logout)
