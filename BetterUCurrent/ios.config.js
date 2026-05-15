module.exports = {
  ios: {
    buildConfiguration: "Release",
    deploymentTarget: "16.0",
    // Keep iOS pods in default static-library mode to avoid
    // react-native-maps module import errors during archive.
    otherCplusplusFlags: "-DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1 -DFOLLY_HAVE_CLOCK_GETTIME=1",
    postInstall: `
      installer.pods_project.targets.each do |target|
        target.build_configurations.each do |config|
          config.build_settings['OTHER_CPLUSPLUSFLAGS'] = '-DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1 -DFOLLY_HAVE_CLOCK_GETTIME=1'
        end
      end
    `
  }
}; 