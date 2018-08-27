import PropTypes from 'prop-types'
import React, {Component} from 'react'
import { connect } from 'react-redux'
import moment from 'moment'
import Panel from 'muicss/lib/react/panel'
import Button from 'muicss/lib/react/button'
import Container from 'muicss/lib/react/container'
import Col from 'muicss/lib/react/col'
import Row from 'muicss/lib/react/row'
import ServerStatus from './admin/ServerStatus'
import ApiLog from './admin/ApiLog'

import * as reducers from '../reducers'

class Admin extends Component {

	componentDidMount(){

	}
	render() {
		return (
			<div>
				<ServerStatus />
				<ApiLog />
			</div>
		)
	}
}

Admin.defaultProps = {
	wsIsReady: false
}
Admin.propTypes = {
	wsIsReady: PropTypes.bool,
}

const mapStateToProps = state => ({
	wsIsReady:  reducers.wsIsReady(state),
})

const mapDispatchToProps = {
}
export default connect(mapStateToProps, mapDispatchToProps)(Admin)
