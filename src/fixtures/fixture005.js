import React from 'react';
import PropTypes from 'prop-types';

function MyComponent({ someObject, requiredProp }) {
	return <div></div>;
}

MyComponent.propTypes = {
	someObject: PropTypes.shape({
		key: PropTypes.string,
	}),
	requiredProp: PropTypes.shape({
		key: PropTypes.string,
	}).isRequired,
};
