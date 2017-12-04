import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Input from 'muicss/lib/react/input'

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

		this.handleInputChange = this.handleInputChange.bind(this)
		this.handleKeyDown = this.handleKeyDown.bind(this)
	}

	componentDidUpdate(prevProps, prevState) {
		//focus on update if this is on cursor 1
		if(this.props.cursor === 1){
			this.inputField.controlEl.focus()
		}
	}

	//move to parent
	handleInputChange(){
		this.props.onUserInput(this.inputField.controlEl.value)
	}

	//move to parent
	handleKeyDown(event){
		this.props.onKeyDown(event)
	}

	render() {
		const {searchText, name, label, placeholder, autoFocus} = this.props
		return (
				<Input
					tabIndex={1}
					name={name}
					hint={placeholder}
					label={label}
					placeholder={placeholder}
					autoFocus={autoFocus}
					value={searchText}
					onChange={this.handleInputChange}
					onKeyDown={this.handleKeyDown}
					ref={(e) => this.inputField = e}
				/>
		)
	}
}

SearchInput.defaultProps = {
	name: 'autoCompleteField',
	label: "",
	autoFocus: false,
	placeholder: 'Enter a value'
}

SearchInput.propTypes = {
	searchText: PropTypes.string.isRequired,
	onUserInput: PropTypes.func.isRequired,
	onKeyDown: PropTypes.func.isRequired,

	name: PropTypes.string,
	label: PropTypes.string,
	placeholder: PropTypes.string,
	autoFocus: PropTypes.bool,
}


export default SearchInput

