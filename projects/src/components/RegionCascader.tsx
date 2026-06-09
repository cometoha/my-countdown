'use client';

import { useState, useEffect } from 'react';
import { listProvinces, listCities, listDistricts, type RegionNode } from '@/lib/region';

interface RegionCascaderProps {
  value?: string;  // 当前选中的code
  onChange: (code: string, displayText: string, province: string, city?: string, district?: string) => void;
  maxLevel?: 1 | 2 | 3;  // 最深选到哪一级，默认3
  placeholder?: string;
  required?: boolean;  // 是否必须选到最深层级
}

export default function RegionCascader({
  value,
  onChange,
  maxLevel = 3,
  placeholder = '请选择',
  required = true,
}: RegionCascaderProps) {
  const [provinces, setProvinces] = useState<RegionNode[]>([]);
  const [cities, setCities] = useState<RegionNode[]>([]);
  const [districts, setDistricts] = useState<RegionNode[]>([]);

  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');

  // 加载省份
  useEffect(() => {
    setProvinces(listProvinces());
  }, []);

  // 加载城市
  useEffect(() => {
    if (selectedProvince) {
      setCities(listCities(selectedProvince));
      setDistricts([]);
    } else {
      setCities([]);
      setDistricts([]);
    }
  }, [selectedProvince]);

  // 加载区县
  useEffect(() => {
    if (selectedCity && maxLevel >= 3) {
      setDistricts(listDistricts(selectedCity));
    } else {
      setDistricts([]);
    }
  }, [selectedCity, maxLevel]);

  const handleProvinceChange = (code: string) => {
    setSelectedProvince(code);
    setSelectedCity('');
    setSelectedDistrict('');
    if (!code) {
      onChange('', '', '', undefined, undefined);
      return;
    }
    const province = provinces.find(p => p.code === code);
    if (maxLevel === 1 || !required) {
      onChange(code, province?.name || '', province?.name || '', undefined, undefined);
    }
  };

  const handleCityChange = (code: string) => {
    setSelectedCity(code);
    setSelectedDistrict('');
    if (!code) {
      // 回退到省份级别
      const province = provinces.find(p => p.code === selectedProvince);
      if (!required && maxLevel >= 2) {
        onChange(selectedProvince, province?.name || '', province?.name || '', undefined, undefined);
      }
      return;
    }
    const province = provinces.find(p => p.code === selectedProvince);
    const city = cities.find(c => c.code === code);
    const displayText = `${province?.name || ''} / ${city?.name || ''}`;
    if (maxLevel === 2 || !required) {
      onChange(code, displayText, province?.name || '', city?.name || '', undefined);
    }
  };

  const handleDistrictChange = (code: string) => {
    setSelectedDistrict(code);
    if (!code) {
      // 回退到城市级别
      const province = provinces.find(p => p.code === selectedProvince);
      const city = cities.find(c => c.code === selectedCity);
      if (!required) {
        const displayText = `${province?.name || ''} / ${city?.name || ''}`;
        onChange(selectedCity, displayText, province?.name || '', city?.name || '', undefined);
      }
      return;
    }
    const province = provinces.find(p => p.code === selectedProvince);
    const city = cities.find(c => c.code === selectedCity);
    const district = districts.find(d => d.code === code);
    const displayText = `${province?.name || ''} / ${city?.name || ''} / ${district?.name || ''}`;
    onChange(code, displayText, province?.name || '', city?.name || '', district?.name || '');
  };

  return (
    <div className="flex gap-2">
      {/* 省份选择 */}
      <select
        value={selectedProvince}
        onChange={(e) => handleProvinceChange(e.target.value)}
        className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-[#E7E5E4] bg-white text-sm focus:outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] transition-colors"
      >
        <option value="">{maxLevel === 1 ? placeholder : '选择省份'}</option>
        {provinces.map((p) => (
          <option key={p.code} value={p.code}>
            {p.name}
          </option>
        ))}
      </select>

      {/* 城市选择 */}
      {maxLevel >= 2 && selectedProvince && (
        <select
          value={selectedCity}
          onChange={(e) => handleCityChange(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-[#E7E5E4] bg-white text-sm focus:outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] transition-colors step-enter"
        >
          <option value="">{!required ? '不指定城市' : '选择城市'}</option>
          {cities.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      {/* 区县选择 */}
      {maxLevel >= 3 && selectedCity && districts.length > 0 && (
        <select
          value={selectedDistrict}
          onChange={(e) => handleDistrictChange(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-[#E7E5E4] bg-white text-sm focus:outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] transition-colors step-enter"
        >
          <option value="">{!required ? '不指定区县' : '选择区县'}</option>
          {districts.map((d) => (
            <option key={d.code} value={d.code}>
              {d.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
