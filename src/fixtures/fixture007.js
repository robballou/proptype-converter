import React from 'react';
import PropTypes from 'prop-types';

/**
 * Check if we can detect the beginning of this component's comment...
 */
function MyComponent({ className }) {
	return <div className={className}></div>;
}

MyComponent.propTypes = {
	className: PropTypes.string.isRequired,
};
