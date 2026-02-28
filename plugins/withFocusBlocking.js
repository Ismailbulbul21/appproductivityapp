// Family Controls entitlement removed so iOS builds without requiring that capability.
// Focus blocking still works on Android. On iOS, native app blocking is not used.
function withFocusBlocking(config) {
  return config;
}

module.exports = withFocusBlocking;
