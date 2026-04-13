module.exports = {
  ios: {
    buildConfiguration: "Release",
    deploymentTarget: "16.0",
    useFrameworks: "static",
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