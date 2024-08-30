import React from 'react';
import PropTypes from 'prop-types';

function MyComponent({ className }) {
	return <div className={className}></div>;
}

MyComponent.propTypes = {
	className: PropTypes.string.isRequired,
	item: PropTypes.shape({
		numberProp: PropTypes.number,
		boolProp: PropTypes.bool,
		expireDate: PropTypes.instanceOf(Date),
		folders: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, name: PropTypes.string })),
		isSelected: PropTypes.oneOfType([PropTypes.bool, PropTypes.oneOf(['single', 'multi'])]),
		reviewStatus: PropTypes.oneOf(['APPROVED', 'PENDING', 'REJECTED', null]),
	}).isRequired,
	onDrag: PropTypes.func,
};

MyComponent.defaultProps = {
	onDrag: () => { },
};
