import React from 'react';
import PropTypes from 'prop-types';

function MyComponent({ someObject }) {
	return <div></div>;
}

MyComponent.propTypes = {
	someObject: PropTypes.arrayOf(
		PropTypes.shape({
			key: PropTypes.string,
		}),
	),
};
