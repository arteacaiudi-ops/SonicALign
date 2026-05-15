import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'sonicalign_calibration_data';

export function useCalibration() {
  const [splOffset, setSplOffset] = useState(0);
  const [rtaComp, setRtaComp] = useState(new Array(31).fill(0));

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.splOffset !== undefined) setSplOffset(parsed.splOffset);
      if (parsed.rtaComp) setRtaComp(parsed.rtaComp);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ splOffset, rtaComp }));
  }, [splOffset, rtaComp]);

  const applyCompensatedData = useCallback((rawBands) => {
    if (!rawBands) return null;
    return rawBands.map((val, i) => val + rtaComp[i]);
  }, [rtaComp]);

  const getCompensatedSpl = useCallback((avgLevel) => {
    return avgLevel + 100 + splOffset;
  }, [splOffset]);

  const resetCalibration = () => {
    setSplOffset(0);
    setRtaComp(new Array(31).fill(0));
  };

  return { splOffset, setSplOffset, rtaComp, setRtaComp, applyCompensatedData, getCompensatedSpl, resetCalibration };
}
