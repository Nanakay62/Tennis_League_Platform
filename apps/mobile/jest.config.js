module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": "babel-jest",
  },
  moduleNameMapper: {
    "^react-native$": "react-native-web",
    "^@expo/vector-icons$": "<rootDir>/__mocks__/vector-icons.js",
    "^expo/virtual/env$": "<rootDir>/__mocks__/expo-env.js",
    "^expo-secure-store$": "<rootDir>/__mocks__/expo-secure-store.js",
  },
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"],
};
