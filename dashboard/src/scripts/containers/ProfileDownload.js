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

class ProfileDownload extends Component {

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
				<Panel>
					<p>Most of the personal data that APP NAME has about you is accessible throughout our apps (e.g. score, username, level, etc..). If you would like to get a consolidated copy of this data, you can download it by following the steps below.</p>

					<p>The download will include a copy of your user account data and game stats since first installing the app.</p>

					<p>As the downloadable file you will receive will contain your profile information, you should keep it secure and be careful when storing, sending, or uploading it to any other services.</p>

					<p>If you have any questions or concerns about the personal data contained in your downloadable file, please contact us.</p>
				<Container>
					<Row>
						<Col md={4} className={"mui--text-center"}>
							<Panel className={(this.props.requestReady || this.props.hasRequested) ? 'mui--text-dark-hint' : ''}>
								<div className="mui--text-title">Step 1</div>
								<div className="mui--text-body2">
									Click the button to start the process of collecting your data.
								</div>
								<div>
									<Button onClick={(e) => this.onRequestData(e)} disabled={this.props.hasRequested}>Request</Button>
								</div>
							</Panel>
						</Col>
						<Col md={4} className={"mui--text-center"}>
							<Panel className={(this.props.requestReady || !this.props.hasRequested) ? 'mui--text-dark-hint' : ''}>
								<div className="mui--text-title">Step 2</div>
								<div className="mui--text-body2">
									We are preparing your data file. This can take up to 30 days to complete.
								</div>
								<div className="mui--text-body2">
									You'll receive an email (if you are registered) when it is ready to download.
								</div>
							</Panel>
						</Col>
						<Col md={4} className={"mui--text-center"}>
							<Panel className={(!this.props.requestReady) ? 'mui--text-dark-hint' : ''}>
								<div className="mui--text-title">Step 3</div>
								<div className="mui--text-body2">
									Click the button below to download your data file. It is available to download for 14 days.
								</div>
								<div>
									{this.renderDownload()}
									</div>
								{this.expireTime()}
							</Panel>
						</Col>
					</Row>
				</Container>
				</Panel>
			</div>
		)
	}
}

ProfileDownload.defaultProps = {
	hasRequested: true,
	requestReady: false
}
ProfileDownload.propTypes = {

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
export default connect(mapStateToProps, mapDispatchToProps)(ProfileDownload)
