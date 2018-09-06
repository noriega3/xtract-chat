import React, { Component } from 'react'
import PropTypes from 'prop-types'

/**
 * This component will modify a block of text fed in (fullText) and will bold(ify) by matching (matchText), adding span/strong where appropriate
 *
 * 		Order of Components:
 *
 * 		1) App
 * 		2) AutoComplete
 * 	 	3) SearchInput
 * 		4) ResultList
 * 	>>	5) BoldHighlighter - (Item text modifier)
 *
 */
export class BoldHighlighter extends Component {

	shouldComponentUpdate(nextProps, nextState) {
		if (this.props.matchText !== nextProps.matchText) {
			return true
		} else if (this.props.fullText !== nextProps.fullText) {
			return true
		}
		return false
	}

	render() {
		const {fullText, matchText} = this.props

		const charLength = fullText.length
		const matchWords = matchText.trim().split(" ").join("|")
		const regex = new RegExp(matchWords, 'ig')
		let charIndex = 0
		let allChars = []
		let boldChars = []
		let matched, start, end

		//Will append to the allChars to render what at the end
		const append = (start, end, bold) => {
			if (end - start > 0) {
				allChars.push({
					start,
					end,
					bold
				})
			}
		}

		//Set a loop to go through each area of the text that matches the current match text
		while (matched = regex.exec(fullText)) {
			start = matched.index
			end = regex.lastIndex

			//Add the chars to bold between start->end indexes
			boldChars.push({
				start,
				end
			})
		}

		if (boldChars.length === 1 && start === 0 && end === charLength)
			//If the length of bold chars is 1, and the start and end equal to the entire length of string, then return the entire fullText as bold
			return (<strong>{fullText}</strong>)

		if (boldChars.length === 0)
			//If the length of bold chars is 0, then the string is not bold at all.. (could be an error if not inside an autoComplete component)
			return (<span>{fullText}</span>)

		//Loop through each of the bolded arr matches and add it to the overall array to process
		boldChars.forEach((chars) => {
			start = chars.start
			end = chars.end

			//Set from current pointer (charIndex) to the pointer of bold start pointer as not bold (ex.  Jes**ic**ca  the 'Jes' area
			append(charIndex,start,false)
			//Send from start -> end of bold pointer values as bold(ex.  Jes**ic**ca  the 'ic' area
			append(start,end,true)

			//update the charIndex to end(or last) bolded char arr pointer
			charIndex = end
		})

		//Send from charIndex -> charLength (number from last bold area to the end of string as not bold (ex.  Jes**ic**ca  the 'ca' area
		append(charIndex, charLength, false)

		//Loop through allChars to properly render each of the bold/non-bold strings either surrounded by spans or strong tags
		return (
			<span>
				{allChars.map((char, index) => {
					const text = fullText.substr(char.start, char.end - char.start)

					if (char.bold) {
						return (<strong key={index}>{text}</strong>)
					} else {
						return(<span key={index}>{text}</span>)
					}
				})}
			</span>)
	}
}

BoldHighlighter.propTypes = {
	matchText: PropTypes.string.isRequired,
	fullText: PropTypes.string.isRequired
}

export default BoldHighlighter

