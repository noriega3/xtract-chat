import React, {Component} from 'react';
import Panel from 'muicss/lib/react/panel'
import PropTypes from 'prop-types';
import './TogglePanel.css';

export class TogglePanel extends Component {
	constructor(props){
		super(props)
		this.state = {
			show: !props.hideOnMount
		}

		this.togglePanel = this.togglePanel.bind(this)
	}

	togglePanel(e){
		e.preventDefault()
		this.setState({
			show: !this.state.show
		})
	}
	render() {
		return (
			<Panel className={`toggle-panel ${this.state.show ? 'show-content' : 'hide-content'}`}>
				<div className={'toggle-header'} onClick={this.togglePanel} >
					{this.props.title && <div className="mui--pull-left mui--text-title">{this.props.title}</div>}
					<div className="mui--pull-right" ><span className="mui-caret" /></div>
					<div className="mui--clearfix" />
				</div>
				<div className={`toggle-content ${this.state.show ? 'active' : ''} `}>
					{this.state.show  && this.props.children}
				</div>
			</Panel>
		);
	}
}

TogglePanel.defaultProps ={
	hideOnMount: false
}

TogglePanel.propTypes = {
	title: PropTypes.string,
	children: PropTypes.node,
	modalClassName: PropTypes.string,
	hideOnMount: PropTypes.bool
};

export default TogglePanel
