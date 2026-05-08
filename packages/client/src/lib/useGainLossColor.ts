import { useSettings } from '../context/SettingsContext';

export function useGainLossColor() {
  const { settings, gainColor, lossColor, gainBg, lossBg } = useSettings();

  const isGreenGain = settings.gainLossColor === 'green-red';
  const gainHex = isGreenGain ? '#16a34a' : '#dc2626';
  const lossHex = isGreenGain ? '#dc2626' : '#16a34a';

  const colorFor = (value: number | null | undefined): string => {
    if (value == null) return 'text-gray-500';
    return value >= 0 ? gainColor : lossColor;
  };

  const bgFor = (value: number | null | undefined): string => {
    if (value == null) return 'bg-gray-50';
    return value >= 0 ? gainBg : lossBg;
  };

  const hexFor = (value: number | null | undefined): string => {
    if (value == null) return '#6b7280';
    return value >= 0 ? gainHex : lossHex;
  };

  return { gainColor, lossColor, gainBg, lossBg, gainHex, lossHex, colorFor, bgFor, hexFor };
}
