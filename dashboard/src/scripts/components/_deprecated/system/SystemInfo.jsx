import React, {Component} from 'react'
import PropTypes from 'prop-types'
import SystemInfoTree from './SystemInfoTree.jsx'
import moment from 'moment'
import _ from "lodash";

function bytesToSize(bytes) {
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	if (bytes === 0) return '0 Byte';
	const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
	return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

class SystemInfo extends Component {
    render() {

    	if(_.size(this.props.data) == 0) return null

		const percentage = _.multiply(_.floor(this.props.data.usagePercent, 2), 100)
        return (<div>
			<div>
				<div>System Uptime: {moment.duration(this.props.data.upTime, "seconds").humanize()}</div>
				<div>Memory Usage: {percentage}%</div>
				<div>Process Usage: {bytesToSize(this.props.data.processUsage)}</div>
				<div>Load Average (1 min): {_.multiply(_.floor(this.props.data.loadAverages[0], 2), 100)}%</div>
				<div>Load Average (5 min): {_.multiply(_.floor(this.props.data.loadAverages[1], 2), 100)}%</div>
				<div>Load Average (15 min): {_.multiply(_.floor(this.props.data.loadAverages[2], 2), 100)}%</div>

				<div>System Memory: {bytesToSize(this.props.data.totalMem)} ({bytesToSize(this.props.data.freeMem)} Free)</div>
			</div>
			<SystemInfoTree data={this.props.data}/>
        </div>)
    }
}

SystemInfo.defaultProps = {
	data: {
		upTime: 0,
		freeMem: 0,
		loadAverages: [0,0,0],
		processUsage: 0,
		totalMem: 0,
		usagePercent: 0
	}
}

SystemInfo.propTypes = {
	data: PropTypes.shape({
		upTime: PropTypes.number,
		freeMem: PropTypes.number,
		loadAverages: PropTypes.arrayOf(PropTypes.number),
		processUsage: PropTypes.number,
		totalMem: PropTypes.number,
		usagePercent: PropTypes.number
	}).isRequired
};

export default SystemInfo
