import React, {PureComponent} from 'react';
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types';
//css
import styles from '../../../styles/main.css'

class WindowModal extends PureComponent {

	constructor(props) {
		super(props)
		this.el = document.createElement('div')
		this.externalWindow = null
	}

	copyStyles(sourceDoc, targetDoc) {
		Array.from(sourceDoc.styleSheets).forEach(styleSheet => {
			if (styleSheet.cssRules) { // for <style> elements
				const newStyleEl = sourceDoc.createElement('style');

				Array.from(styleSheet.cssRules).forEach(cssRule => {
					// write the text of each rule into the body of the style element
					newStyleEl.appendChild(sourceDoc.createTextNode(cssRule.cssText));
				});

				targetDoc.head.appendChild(newStyleEl);
			} else if (styleSheet.href) { // for <link> elements loading CSS from a URL
				const newLinkEl = sourceDoc.createElement('link');

				newLinkEl.rel = 'stylesheet';
				newLinkEl.href = styleSheet.href;
				targetDoc.head.appendChild(newLinkEl);
			}
		});
	}

	componentDidMount() {
		// STEP 3: open a new browser window and store a reference to it
		this.externalWindow = window.open(this.props.path, '', 'width=680,height=1500');

		// STEP 4: append the container <div> (that has props.children appended to it) to the body of the new window
		this.externalWindow.document.body.appendChild(this.el);
	}

	componentWillUnmount() {
		this.externalWindow.close()
	}

	render() {
		return ReactDOM.createPortal(this.props.children,this.el)
	}
}

WindowModal.propTypes = {
	children: PropTypes.node
};

export default WindowModal
