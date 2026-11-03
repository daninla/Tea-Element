import { getRequestConfig } from 'next-intl/server';
import messages from '../../messages/uk.json';
export default getRequestConfig(async () => ({ locale: 'uk', messages }));
