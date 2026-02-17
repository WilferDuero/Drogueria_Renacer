const { withAppBuildGradle, withProjectBuildGradle } = require("@expo/config-plugins");

const GOOGLE_SERVICES_CLASSPATH = "classpath('com.google.gms:google-services:4.4.2')";
const GOOGLE_SERVICES_PLUGIN = 'apply plugin: "com.google.gms.google-services"';

function ensureProjectGoogleServicesClasspath(contents) {
  if (contents.includes("com.google.gms:google-services")) {
    return contents;
  }

  const dependenciesBlockPattern = /dependencies\s*\{[\s\S]*?\}/m;
  const match = contents.match(dependenciesBlockPattern);
  if (!match) {
    return contents;
  }

  const dependenciesBlock = match[0];
  const updatedDependenciesBlock = dependenciesBlock.replace(
    /(\n\s*classpath\([^\n]+\)\s*)+$/m,
    (tail) => `${tail}\n    ${GOOGLE_SERVICES_CLASSPATH}`
  );

  if (updatedDependenciesBlock === dependenciesBlock) {
    return contents.replace(
      /dependencies\s*\{/m,
      `dependencies {\n    ${GOOGLE_SERVICES_CLASSPATH}`
    );
  }

  return contents.replace(dependenciesBlock, updatedDependenciesBlock);
}

function ensureAppGoogleServicesPlugin(contents) {
  if (contents.includes("com.google.gms.google-services")) {
    return contents;
  }

  if (contents.includes('apply plugin: "com.facebook.react"')) {
    return contents.replace(
      'apply plugin: "com.facebook.react"',
      `apply plugin: "com.facebook.react"\n${GOOGLE_SERVICES_PLUGIN}`
    );
  }

  return `${contents}\n${GOOGLE_SERVICES_PLUGIN}\n`;
}

const withAndroidPushSetup = (config) => {
  config = withProjectBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== "groovy") {
      return gradleConfig;
    }
    gradleConfig.modResults.contents = ensureProjectGoogleServicesClasspath(
      gradleConfig.modResults.contents
    );
    return gradleConfig;
  });

  config = withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== "groovy") {
      return gradleConfig;
    }
    gradleConfig.modResults.contents = ensureAppGoogleServicesPlugin(
      gradleConfig.modResults.contents
    );
    return gradleConfig;
  });

  return config;
};

module.exports = withAndroidPushSetup;
