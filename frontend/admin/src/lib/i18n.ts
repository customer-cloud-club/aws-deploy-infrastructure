import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import jaCommon from '@/locales/ja/common.json';
import enCommon from '@/locales/en/common.json';

const resources = {
  ja: {
    common: jaCommon,
  },
  en: {
    common: enCommon,
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'ja',
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
