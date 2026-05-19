export const generateTelemetrySnapshot = (engineData, calibrationData, analysisResults) => {
  const now = new Date();
  return {
    metadata: {
      timestamp: now.toISOString(),
      userAgent: navigator.userAgent,
      version: "1.0.8",
      sampleRate: engineData.sampleRate,
    },
    settings: {
      inputGain: engineData.inputGain,
      threshold: engineData.threshold,
      calibration: calibrationData,
    },
    signal: {
      rawBuffer: Array.from(engineData.rawBuffer),
      filteredBuffer: Array.from(engineData.filteredBuffer),
    },
    analysis: analysisResults
  };
};
