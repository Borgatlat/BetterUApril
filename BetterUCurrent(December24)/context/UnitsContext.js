import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatNumber } from '../utils/formatUtils';

const UnitsContext = createContext();

export const UnitsProvider = ({ children }) => {
  const [useImperial, setUseImperial] = useState(false);

  useEffect(() => {
    loadUnitsPreference();
  }, []);

  const loadUnitsPreference = async () => {
    try {
      const savedPreference = await AsyncStorage.getItem('useImperial');
      if (savedPreference !== null) {
        setUseImperial(JSON.parse(savedPreference));
      }
    } catch (error) {
      console.error('Error loading units preference:', error);
    }
  };

  const toggleUnits = async (value) => {
    setUseImperial(value);
    await AsyncStorage.setItem('useImperial', JSON.stringify(value));
  };

  // Conversion functions
  const convertWeight = (kg) => {
    if (!kg) return null;
    return useImperial ? formatNumber(kg * 2.20462) : formatNumber(kg);
  };

  const convertHeight = (cm) => {
    if (!cm) return null;
    return useImperial ? formatNumber(cm / 2.54) : formatNumber(cm);
  };

  const convertWeightBack = (value) => {
    if (!value) return null;
    return useImperial ? parseFloat(value) / 2.20462 : parseFloat(value);
  };

  const convertHeightBack = (value) => {
    if (!value) return null;
    return useImperial ? parseFloat(value) * 2.54 : parseFloat(value);
  };

  const getWeightUnit = () => useImperial ? 'lbs' : 'kg';
  const getHeightUnit = () => useImperial ? 'in' : 'cm';

  return (
    <UnitsContext.Provider value={{
      useImperial,
      toggleUnits,
      convertWeight,
      convertHeight,
      convertWeightBack,
      convertHeightBack,
      getWeightUnit,
      getHeightUnit
    }}>
      {children}
    </UnitsContext.Provider>
  );
};

export const useUnits = () => useContext(UnitsContext); 