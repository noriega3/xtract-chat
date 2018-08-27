import PropTypes from 'prop-types'
import React, {Component} from 'react'
import { connect } from 'react-redux'
import moment from 'moment'
import Panel from 'muicss/lib/react/panel'
import Button from 'muicss/lib/react/button'
import Container from 'muicss/lib/react/container'
import Col from 'muicss/lib/react/col'
import Row from 'muicss/lib/react/row'

import {
	dataRequest,
	dataRequestProgress,
	dataRequestDownload
} from '../actions/apiProfileActions'

import {
	dataRequested,
	dataRequestReady,
	dataRequestTime,
} from '../reducers'

class ServerLogs extends Component {

	constructor(props){
		super(props)
	}

	componentDidMount(){
		this.props.fetchRequestProgress()
	}

	onRequestData(){
		this.props.fetchRequestData()
	}

	downloadData(){
		this.props.fetchDownload()
	}

	expireTime(){
		if(!this.props.requestReady || !this.props.requestReadyTime) return null

		let expireTime = moment(this.props.requestReadyTime).add(14, 'days').calendar(null, {
			sameDay: '[Today]',
			nextDay: '[Tomorrow]',
			nextWeek: 'dddd',
			lastDay: '[Yesterday]',
			lastWeek: '[Last] dddd',
			sameElse: 'DD/MM/YYYY'
		})
		return (<div className="mui--text-caption">Expires: {expireTime}</div>)

	}

	renderDownload(){
		try {
			let isFileSaverSupported = !!new Blob;
			console.log('blobs are valid', isFileSaverSupported)
			return <Button onClick={(e) => this.downloadData(e)} disabled={!this.props.hasRequested || !this.props.requestReady}>Download</Button>
		} catch (e) {
			return <Button onClick={(e) => this.downloadData(e)} disabled={true}>Download</Button>
		}
	}

	render() {
		return (
			<div>
				<ApiLog />
			</div>
		)
	}
}

ServerLogs.defaultProps = {
	hasRequested: true,
	requestReady: false
}
ServerLogs.propTypes = {

	hasRequested: PropTypes.bool,
	requestReady: PropTypes.bool,
	requestReadyTime: PropTypes.number,

	fetchRequestData: PropTypes.func,
	fetchRequestProgress: PropTypes.func,
	fetchDownload: PropTypes.func
}

const mapStateToProps = state => ({
	hasRequested:  dataRequested(state),
	requestReady:  dataRequestReady(state),
	requestReadyTime:  dataRequestTime(state)
})

const mapDispatchToProps = {
	fetchRequestData: dataRequest,
	fetchRequestProgress: dataRequestProgress,
	fetchDownload: dataRequestDownload,
}
export default connect(mapStateToProps, mapDispatchToProps)(ServerLogs)
