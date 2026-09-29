const React = require("react");

const MockIcon = (props) =>
  React.createElement("span", {
    "data-testid": "icon",
    "data-name": props.name,
    className: props.className,
  });

module.exports = {
  Feather: MockIcon,
  Ionicons: MockIcon,
  AntDesign: MockIcon,
  FontAwesome: MockIcon,
  MaterialIcons: MockIcon,
  MaterialCommunityIcons: MockIcon,
};
