import React from 'react';
import PropTypes from 'prop-types';

function MyComponent({ className }) {
	return <div className={className}></div>;
}

MyComponent.propTypes = {
	/** JSDoc we want to keep */
	className: PropTypes.string.isRequired,
	/**
	 * A bigger JSDoc comment
	 *
	 * See more details...
	 */
	optional: PropTypes.string,
	optionalFlag: PropTypes.bool,
};

MyComponent.defaultProps = {
	optional: 'default',
	optionalFlag: true,
};
