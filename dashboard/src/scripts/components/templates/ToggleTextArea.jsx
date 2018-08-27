import React, {Component} from 'react';
import Button from 'muicss/lib/react/button'
import Textarea from 'muicss/lib/react/textarea'
import PropTypes from 'prop-types';

export class ToggleTextArea extends Component {
	constructor(props){
		super(props)
		this.state = {
			show: props.show
		}

		this.toggleArea = this.toggleArea.bind(this)
	}

	toggleArea(e){
		e.preventDefault()
		this.setState({
			show: !this.state.show
		})
		this.props.onToggle(e)
	}
	render() {
		return (<div className="mui--text-center" key={this.props.id+'-txtarea'}>
			<Button size="small" variant="flat" color={"primary"} onClick={(e) => this.toggleArea(e)}>{this.state.show ? "Hide " : "Show "}{this.props.label}</Button>
			<div className={this.state.show ? "mui--show" : "mui--hide"}>
				<Textarea name={"message"} onChange={(e) => this.props.onChange(e)} className={"autoresize"} value={this.props.value} rows={(this.props.value.split(/\r\n|\r|\n/).length)} disabled={this.props.disabled}/>
				{this.props.children}
			</div>
		</div>);
	}
}

ToggleTextArea.defaultProps ={
  value: "",
  hideOnMount: false,
  onToggle: () => {}
}

ToggleTextArea.propTypes = {
  children: PropTypes.any,
  disabled: PropTypes.bool,
  hideOnMount: PropTypes.bool,
  id: PropTypes.string,
  label: PropTypes.string,
  modalClassName: PropTypes.string,
  onChange: PropTypes.func,
  onToggle: PropTypes.func,
  show: PropTypes.bool,
  title: PropTypes.string,
  value: PropTypes.any.isRequired
};

export default ToggleTextArea
