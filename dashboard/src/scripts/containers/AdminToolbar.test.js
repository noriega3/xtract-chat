// Link.react.test.js
import React from 'react';
import AdminToolbar from './AdminToolbar';
import renderer from 'react-test-renderer';

test('AdminToolbar disables buttons when processing', () => {
	const component = renderer.create(
		<AdminToolbar page="http://www.facebook.com">Facebook</AdminToolbar>,
	);
	let tree = component.toJSON();
	expect(tree).toMatchSnapshot();

	// manually trigger the callback
	tree.props.onMouseEnter();
	// re-rendering
	tree = component.toJSON();
	expect(tree).toMatchSnapshot();

	// manually trigger the callback
	tree.props.onMouseLeave();
	// re-rendering
	tree = component.toJSON();
	expect(tree).toMatchSnapshot();
});
