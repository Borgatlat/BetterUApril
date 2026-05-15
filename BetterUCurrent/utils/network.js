// Simple network connectivity check using fetch
export const checkNetworkConnectivity = async () => {
  try {
    // Try to fetch a small resource from a reliable server
    const response = await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      timeout: 5000
    });
    
    return response.ok;
  } catch (error) {
    console.log('Network connectivity check failed:', error.message);
    return false;
  }
}; 