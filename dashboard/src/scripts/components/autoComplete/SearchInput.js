import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Input from 'muicss/lib/react/input'
import _debounce from 'lodash/debounce'

/**
 * The component to the search input, forwards everything to the AutoComplete component
 *
 * 		Order of Components:
 *
 * 		1) App
 * 		2) AutoComplete
 * 	>> 	3) SearchInput
 * 		4) ResultList
 * 		5) BoldHighlighter - (Item text modifier)
 *
 */
export class SearchInput extends Component {
	constructor(props) {
		super(props)
		this.state = {
			value: props.query || ''
		}

		this.handleInputChange = this.handleInputChange.bind(this) //handles spam typing
		this.handleKeyDown = this.handleKeyDown.bind(this)
		this.handleOnClick = this.handleOnClick.bind(this)
		this.handleOnBlur = this.handleOnBlur.bind(this)
	}

	componentDidMount(){
		console.log('this element', this.inputField.controlEl)
		this.inputField.controlEl.onClick = this.handleOnClick
		this.inputField.controlEl.onBlur = this.handleOnBlur
	}

	//move to parent
	handleInputChange(){
		console.log('onchange')
		this.setState({value: this.inputField.controlEl.value})
		this.props.onUserInput(this.inputField.controlEl.value)
	}

	//move to parent
	handleKeyDown(event){
		console.log('key down')
		this.props.onKeyDown(event)
	}

	//move to parent
	handleOnClick(event){
		if(this.props.onFocus)
			this.props.onFocus(event)
	}

	//move to parent
	handleOnBlur(event){
		if(this.props.onBlur)
			this.props.onBlur(event)
	}

	render() {
		const {name, label, placeholder, autoFocus, searching} = this.props
		return (<div className={"search-input"}>
				<Input
					ref={(e) => this.inputField = e}
					disabled={searching}
					tabIndex={1}
					name={name}
					value={this.state.value}
					hint={placeholder}
					label={label}
					placeholder={placeholder}
					autoFocus={autoFocus}
					onFocus={this.handleOnClick}
					onChange={this.handleInputChange}
					onKeyDown={this.handleKeyDown}
				/>
			</div>

		)
	}
}

SearchInput.defaultProps = {
	name: 'autoCompleteField',
	label: "",
	autoFocus: false,
	placeholder: 'Enter a value',
	searching: false
}

SearchInput.propTypes = {
	onUserInput: PropTypes.func.isRequired,
	onKeyDown: PropTypes.func.isRequired,
	onFocus: PropTypes.func,
	onBlur: PropTypes.func,

	name: PropTypes.string,
	label: PropTypes.string,
	placeholder: PropTypes.string,
	autoFocus: PropTypes.bool,
	searching: PropTypes.bool,
}


export default SearchInput

