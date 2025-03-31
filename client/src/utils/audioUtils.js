export const checkDolbyAtmosSupport = async () => {
  try {
    // Check if the browser supports Web Audio API
    if (!window.AudioContext && !window.webkitAudioContext) {
      return false;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();

    // Check if the browser supports spatial audio
    const capabilities = await audioContext.destination.getChannelCount();

    // Dolby Atmos typically requires at least 7.1 channels
    // However, we'll consider 5.1 as minimum for basic spatial audio support
    return capabilities >= 6;
  } catch (error) {
    console.error('Error checking Dolby Atmos support:', error);
    return false;
  }
}; 