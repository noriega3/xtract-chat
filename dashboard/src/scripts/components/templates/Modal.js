import React, {Component} from 'react';
import PropTypes from 'prop-types';
import Button from 'muicss/lib/react/button'

class Modal extends Component {
	render() {
		// Render nothing if the "show" prop is false
		if(!this.props.show) {
			return null;
		}

		// The gray background
		const backdropStyle = {
			position: 'fixed',
			top: 0,
			bottom: 0,
			left: 0,
			right: 0,
			backgroundColor: 'rgba(0,0,0,0.3)',
			padding: 50,
			zIndex: 1,
		};

		// The modal "window"
		const modalStyle = {
			backgroundColor: '#fff',
			borderRadius: 5,
			maxWidth: "95%",
			maxHeight: "80%",
			margin: '0 auto',
			overflow: 'scroll',
			padding: 30,
			zIndex: 2
		};

		// The modal footer
		const footerStyle = {
			width: '100%',
			textAlign: 'center',
			justifyContent: 'center'
		};

		return (
			<div className="backdrop" style={backdropStyle}>
				<div className="modal" style={modalStyle}>
					{this.props.children}
				</div>
				<div className="footer" style={footerStyle}>
					{this.props.showClose && <Button onClick={this.props.onClose} variant={'primary'} size={this.props.closeSize}
						disabled={this.props.closeDisabled}>
						{this.props.closeText}
					</Button>}
				</div>
			</div>
		);
	}
}
Modal.defaultProps = {
	showClose: true,
	closeText: 'Close',
	closeSize: '',
	closeDisabled: false
}
Modal.propTypes = {
	onClose: PropTypes.func.isRequired,
	show: PropTypes.bool,
	header: PropTypes.string,
	children: PropTypes.node,
	modalClassName: PropTypes.string,
	showClose: PropTypes.bool,
	closeDisabled: PropTypes.bool,
	closeText: PropTypes.string,
	closeSize: PropTypes.oneOf(['small', 'large', '']),
	backdrop: PropTypes.bool
};

export default Modal;
