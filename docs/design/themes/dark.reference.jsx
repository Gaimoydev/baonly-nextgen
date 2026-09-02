// ========== App.tsx ==========

import React from 'react';
import { ConfigProvider, theme } from 'antd';

export default () => {
  const configProps = { theme: { algorithm: theme.darkAlgorithm, components: {
    Layout: {
      bodyBg: '#050505',
      footerBg: '#050505',
      headerBg: '#111111',
      headerColor: 'rgba(255, 255, 255, 0.88)',
      siderBg: '#050505',
      triggerBg: '#111111',
      triggerColor: 'rgba(255, 255, 255, 0.88)',
    },
    Menu: {
      darkItemBg: 'transparent',
      darkItemColor: 'rgba(255, 255, 255, 0.68)',
      darkItemHoverBg: 'rgba(255, 255, 255, 0.08)',
      darkItemHoverColor: '#fff',
      darkItemSelectedBg: 'rgba(22, 119, 255, 0.28)',
      darkItemSelectedColor: '#fff',
      darkSubMenuItemBg: 'transparent',
    },
    Button: {},
    Alert: {},
    Modal: {},
    Card: {},
    Tooltip: {},
    Checkbox: {},
    Radio: {},
    Select: {},
    Input: {},
    Switch: {},
    Progress: {
      circleTextColor: 'rgba(255, 255, 255, 0.88)',
      defaultColor: '#1677FF',
      remainingColor: 'rgba(255, 255, 255, 0.12)',
    },
    Steps: {},
    Slider: {},
    ColorPicker: {},
    Notification: {},
  } } };
  return (
    <ConfigProvider {...configProps}>
      {/* Your App */}
    </ConfigProvider>
  );
};